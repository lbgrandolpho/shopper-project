// Setup -----------------------------------------------------------------------

import express from 'express';

import { Router, Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';

import csv from 'csvtojson';

import { ZodError, ZodIssue, z } from 'zod';
import { UpdateProduct, validateNewPriceIsntLessThanCostPrice, validatePackPriceIsntDifferentFromSumOfUnitProducts, validatePriceChangeIsntTooBig } from './validation';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore: Unreachable code error
BigInt.prototype.toJSON = function (): string {
  return this.toString();
};

const prisma = new PrismaClient();

const app = express();

const route = Router();

app.use(express.json());
app.use(express.text());

// Routes ----------------------------------------------------------------------

route.get('/products', async (req: Request, res: Response) => {
  res.json(await prisma.products.findMany());
});

// -----------------------------------------------------------------------------

route.post('/products/validate', async (req: Request, res: Response) => {
  const products_untyped = await csv().fromString(req.body);
  console.log(products_untyped);

  try {
    const products: UpdateProduct[] = z.array(UpdateProduct).parse(products_untyped);
    const product_ids: number[] = products.map((product) => product.product_code);

    const products_from_db = (
      await prisma.products.findMany({
        where: {
          code: {
            in: product_ids,
          },
        },
        include: {
          packs_packs_pack_idToproducts: {
            include: {
              products_packs_product_idToproducts: true,
            }
          }
        },
      })
    );

    const procut_ids_from_db = products_from_db.map((product) => product.code);

    const products_map = new Map<BigInt, number>();
    for (const product of products) {
      products_map.set(BigInt(product.product_code), product.new_price);
    }

    if (product_ids.length !== procut_ids_from_db.length) {
      const difference = product_ids.filter((id) => !procut_ids_from_db.includes(BigInt(id)));
      res.status(400).json({
        error_type: "missing_codes",
        missing_codes: difference,
      });
    }

    else {
      const errors = (
        validateNewPriceIsntLessThanCostPrice(products_from_db, products_map)
      ).concat(
        validatePriceChangeIsntTooBig(products_from_db, products_map)
      ).concat(
        validatePackPriceIsntDifferentFromSumOfUnitProducts(products_from_db, products_map)
      );

      if (errors.length > 0) {
        res.status(400).json({
          error_type: "validation_error",
          errors: errors,
        });
      }

      else {
        res.status(200).json(
          products_from_db.map((product) => {
            return {
              code: product.code,
              name: product.name,
              current_price: product.sales_price.toFixed(2),
              new_price: products_map.get(product.code)?.toFixed(2),
            };
          }
          ));
      }
    }
  }

  catch (error: any) {
    const zod_error: ZodError = error;
    const error_strs: string[] = zod_error.issues.map((issue: ZodIssue) => {
      const [line0, column_name] = issue.path;
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

      return `Linha ${line} (coluna '${column_name}'): ${err}`;
    });

    res.status(400).json({
      error_type: "validation_error",
      errors: error_strs,
    });
  }

});

// -----------------------------------------------------------------------------


app.use(route);

app.listen(3000, () => 'server running on port 3000');

prisma.$disconnect();
