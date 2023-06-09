// Setup -----------------------------------------------------------------------

import express from 'express';

import { Router, Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';

import { ZodError, ZodIssue, z } from 'zod';
import { UpdateProduct, validateNewPriceIsntLessThanCostPrice, validatePackPriceIsntDifferentFromSumOfUnitProducts, validatePriceChangeIsntTooBig } from './validation';
import { parseCsv } from './parsing';
import cors from 'cors';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

export const prisma = new PrismaClient();

export const app = express();

const route = Router();

app.use(express.json());
app.use(express.text());

app.use(
  cors({
    origin: [
      'http://localhost:5173',
      'http://172.17.0.1:5173',
    ],
  }),
);

// Routes ----------------------------------------------------------------------

route.get('/products', async (req: Request, res: Response) => {
  res.json(await prisma.products.findMany());
});

// -----------------------------------------------------------------------------

route.post('/products/validate', async (req: Request, res: Response) => {
  const productsUntyped = parseCsv(req.body);

  try {
    const products: UpdateProduct[] = z.array(UpdateProduct).parse(productsUntyped);
    const productIds: number[] = products.map((product) => product.product_code);

    const productsFromDb = (
      await prisma.products.findMany({
        where: {
          code: {
            in: productIds,
          },
        },
        include: {
          packs_packs_pack_idToproducts: {
            include: {
              products_packs_product_idToproducts: true,
            }
          },
          packs_packs_product_idToproducts: {
            include: {
              products_packs_pack_idToproducts: true,
            }
          }
        },
      })
    );

    const productIdsFromDb = productsFromDb.map((product) => product.code);

    const productsMap = new Map<BigInt, number>();
    for (const product of products) {
      productsMap.set(BigInt(product.product_code), product.new_price);
    }

    if (productIds.length !== productIdsFromDb.length) {
      const difference = productIds.filter((id) => !productIdsFromDb.includes(BigInt(id)));
      res.status(400).json({
        error_type: "missing_codes",
        missing_codes: difference,
      });
    }

    else {
      const errors = (
        validateNewPriceIsntLessThanCostPrice(productsFromDb, productsMap)
      ).concat(
        validatePriceChangeIsntTooBig(productsFromDb, productsMap)
      ).concat(
        await validatePackPriceIsntDifferentFromSumOfUnitProducts(productsFromDb, productsMap)
      );

      if (errors.length > 0) {
        res.status(400).json({
          error_type: "validation_error",
          errors: errors,
        });
      }

      else {
        res.status(200).json(
          productsFromDb.map((product) => {
            return {
              code: product.code,
              name: product.name,
              current_price: product.sales_price.toFixed(2),
              new_price: productsMap.get(product.code)?.toFixed(2),
            };
          }
          ));
      }
    }
  }

  catch (error: any) {
    const zodError: ZodError = error;
    const errorStrs: string[] = zodError.issues.map((issue: ZodIssue) => {
      const [line0, columnName] = issue.path;
      const line = + line0 + 2;

      let err = "";

      switch (issue.code) {
        case "invalid_type":
          err = `Tipo incorreto; esperava '${issue.expected}', mas recebi ` +
            `'${issue.received}'.`;
          break;

        case "too_small":
          err = `O valor deve ser maior ou igual a ${issue.minimum}.`;
          break;

        default:
          err = "Erro desconhecido.";
          break;
      }

      return `Linha ${line} (coluna '${columnName}'): ${err}`;
    });

    res.status(400).json({
      error_type: "validation_error",
      errors: errorStrs,
    });
  }

});

route.post('/products/update', async (req: Request, res: Response) => {
  const productsUntyped = parseCsv(req.body);
  const products: UpdateProduct[] = z.array(UpdateProduct).parse(productsUntyped);

  for (const product of products) {
    await prisma.products.update({
      where: {
        code: BigInt(product.product_code),
      },
      data: {
        sales_price: product.new_price,
      },
    });
  }

  res.status(200).end();
});

// -----------------------------------------------------------------------------


app.use(route);
