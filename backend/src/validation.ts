import { packs, products } from '@prisma/client';
import { z } from 'zod';
import { prisma } from './app';


export const UpdateProduct = z.object({
  product_code: z.coerce.number().int().positive(),
  new_price: z.coerce.number().positive(),
});

export type UpdateProduct = z.infer<typeof UpdateProduct>;

export type ValidationResult = string[];

export type packWithProducts = (
  products & {
    packs_packs_pack_idToproducts: (packs & {
      products_packs_product_idToproducts: products;
    })[];
  } & {
    packs_packs_product_idToproducts: (packs & {
      products_packs_pack_idToproducts: products;
    })[];
  }
);

export type productsWithPacks = (
  products & {
    packs_packs_pack_idToproducts: (packs & {
      products_packs_product_idToproducts: products;
    })[];
  }
);

export function validateNewPriceIsntLessThanCostPrice(
  products: products[], newPriceMapping: Map<BigInt, number>
): ValidationResult {
  const errors: string[] = [];

  for (const product of products) {
    const newPrice = newPriceMapping.get(BigInt(product.code));
    const currentPrice = Number(product.cost_price);
    if (newPrice && newPrice < currentPrice) {
      errors.push(
        `Novo preço para o produto ${product.code} é menor que o preço de ` +
        `custo (${newPrice.toFixed(2)} < ${currentPrice.toFixed(2)})`
      );
    }
  }

  return errors;
}

export function validatePriceChangeIsntTooBig(
  products: products[], newPriceMapping: Map<BigInt, number>
): ValidationResult {
  const errors: string[] = [];

  for (const product of products) {
    const newPrice = newPriceMapping.get(BigInt(product.code)) || 0;
    const currentPrice = Number(product.sales_price);

    const priceDifference = Math.abs(newPrice - currentPrice);
    const relativePriceDifference = priceDifference / currentPrice;

    if (relativePriceDifference > 0.1) {
      errors.push(
        `A alteração do valor do produto ${product.code} é maior que 10%`
      );
    }
  }

  return errors;
}

export async function validatePackPriceIsntDifferentFromSumOfUnitProducts(
  products: packWithProducts[], newPriceMapping: Map<BigInt, number>
): Promise<ValidationResult> {

  // At this point we should only evaluate products whose pack's aren't included
  // in the CSV. This is because the previous validation function already
  // evaluated the packs that are included in the CSV.

  const errors: string[] = [];

  // First, drop all packs from the products
  const productsWithoutPacks = products.filter((product) => {
    return product.packs_packs_pack_idToproducts.length === 0;
  });

  // Then, group products by pack
  type productFromPack = {
    code: number,
    sales_price: number,
    qty: number,
  }

  const productsByPack = new Map<BigInt, productFromPack[]>();
  for (const product of productsWithoutPacks) {
    if (product.packs_packs_product_idToproducts.length === 0) {
      continue;
    }
    
    const packId = BigInt(product.packs_packs_product_idToproducts[0].pack_id);
    const productData: productFromPack = {
      code: Number(product.code),
      sales_price: newPriceMapping.get(product.code) || Number(product.sales_price),
      qty: Number(product.packs_packs_product_idToproducts[0].qty),
    };

    if (productsByPack.has(packId)) {
      productsByPack.get(packId)?.push(productData);
    }
    else {
      productsByPack.set(packId, [productData]);
    }
  }

  // Then, fetch the packs from the database
  const packIds = Array.from(productsByPack.keys()).map((packId) => Number(packId));

  const packsFromDb = await prisma.products.findMany({
    where: {
      code: {
        in: packIds,
      },
    },
    include: {
      packs_packs_pack_idToproducts: {
        include: {
          products_packs_product_idToproducts: true,
        }
      },
    },
  });
  
  // Then, push the remaining products into the packs
  for (const pack of packsFromDb) {
    const thisPackProducts = productsByPack.get(BigInt(pack.code));

    for (const addProduct of pack.packs_packs_pack_idToproducts) {
      const productWithData = addProduct.products_packs_product_idToproducts;
      const productData: productFromPack = {
        code: Number(productWithData.code),
        sales_price: Number(productWithData.sales_price),
        qty: Number(addProduct.qty),
      };

      // Avoid adding the same product twice
      if (thisPackProducts?.find((product) => Number(product.code) === Number(productWithData.code))) {
        continue;
      }

      thisPackProducts?.push(productData);
    }
  }

  // Finally, sum the products and compare to the pack price

  for (const pack of packsFromDb) {
    const currentPackagePrice = newPriceMapping.get(pack.code) || Number(pack.sales_price);
    const newPackagePrice = productsByPack.get(BigInt(pack.code))?.reduce((sum, product) => {
      return sum + (product.sales_price * product.qty);
    }, 0);

    if (newPackagePrice && newPackagePrice !== currentPackagePrice) {
      errors.push(
        `O preço do pacote ${pack.code} é diferente da soma dos preços dos ` +
        `produtos que o compõem (${newPackagePrice.toFixed(2)} != ${currentPackagePrice.toFixed(2)})`
      );
    }
  }

  return errors;
}