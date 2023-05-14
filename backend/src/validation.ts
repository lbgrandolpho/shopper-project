import { packs, products } from '@prisma/client';
import { z } from 'zod';

export const UpdateProduct = z.object({
  product_code: z.coerce.number().int().positive(),
  new_price: z.coerce.number().positive(),
});

export type UpdateProduct = z.infer<typeof UpdateProduct>;

export type ValidationResult = string[];

export type packWithProducts = (products & {
  packs_packs_pack_idToproducts: (packs & {
    products_packs_product_idToproducts: products;
  })[];
});

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
        `custo (${newPrice} < ${currentPrice})`
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

export function validatePackPriceIsntDifferentFromSumOfUnitProducts(
  products: packWithProducts[], newPriceMapping: Map<BigInt, number>
): ValidationResult {
  const errors: string[] = [];

  for (const pack of products) {
    if (pack.packs_packs_pack_idToproducts.length === 0) {
      continue;
    }

    let newPackagePrice = newPriceMapping.get(BigInt(pack.code)) || Number(pack.sales_price);

    let sumOfUnitProducts = pack.packs_packs_pack_idToproducts.map((product) => {
      const productWithData = product.products_packs_product_idToproducts;
      const productPrice = newPriceMapping.get(BigInt(productWithData.code)) || Number(productWithData.sales_price);
      return productPrice * Number(product.qty);
    }).reduce((sum, product) => sum + product);

    if (newPackagePrice !== sumOfUnitProducts) {
      errors.push(
        `O preço do pacote ${pack.code} é diferente da soma dos preços dos ` +
        `produtos que o compõem (${newPackagePrice} != ${sumOfUnitProducts})`
      );
    }
  }

  return errors;
}
