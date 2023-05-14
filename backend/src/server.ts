// Setup -----------------------------------------------------------------------

import express from 'express';

import { Router, Request, Response } from 'express';

import { PrismaClient } from '@prisma/client';

import csv from 'csvtojson';

import { z } from 'zod';

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

const UpdateProduct = z.object({
  product_code: z.coerce.number().int().positive(),
  new_price: z.coerce.number().positive(),
});

type UpdateProduct = z.infer<typeof UpdateProduct>;

// Routes ----------------------------------------------------------------------

route.get('/products', async (req: Request, res: Response) => {
  res.json(await prisma.products.findMany());
});

// -----------------------------------------------------------------------------

route.post('/products/update', async (req: Request, res: Response) => {
  const products_untyped = await csv().fromString(req.body);
  console.log(products_untyped);

  try {
    const products: UpdateProduct[] = z.array(UpdateProduct).parse(products_untyped);
    res.json(products);
  }
  catch (error) {
    res.status(400).json(error);
  }

});

// -----------------------------------------------------------------------------


app.use(route);

app.listen(3000, () => 'server running on port 3000');

prisma.$disconnect();
