import request from "supertest";
import { app } from "../src/app";

import { PrismaClient, products } from '@prisma/client';

const prisma = new PrismaClient();

async function clearDatabase() {
  await prisma.packs.deleteMany();
  await prisma.products.deleteMany();
}

beforeAll(clearDatabase);
afterEach(clearDatabase);

beforeEach(async () => {

  /* Setup some products in the database.
   * The products are:
   * 1. Crazy Cola | Costs 10 | Sells for 20
   * 2. Noodles | Costs 4 | Sells for 5
   * 3. Vegan Apples | Costs 1.5 | Sells for 3
   * 100. Crazy Pack - 6 Un. | Costs 60 | Sells for 120
   * - Made out of 6 Crazy Colas
   */

  await prisma.products.createMany({
    data: [
      {
        code: 1,
        name: "Crazy Cola",
        cost_price: "10",
        sales_price: "20",
      },
      {
        code: 2,
        name: "Noodles",
        cost_price: "4.8",
        sales_price: "5",
      },
      {
        code: 3,
        name: "Vegan Apples",
        cost_price: "1.5",
        sales_price: "3",
      },
      {
        code: 100,
        name: "Crazy Pack - 6 Un.",
        cost_price: "60",
        sales_price: "120",
      },
    ]
  });

  await prisma.packs.createMany({
    data: [
      {
        pack_id: 100,
        product_id: 1,
        qty: 6,
      }
    ],
  });
});

describe("Produtcts listing route /products", () => {

  const PRODUCTS_ROUTE = "/products";

  it("Should have no content when the database is emtpy", async () => {

    // Given - A clean database

    await clearDatabase();

    // When - A GET request is made to the products route
    const response = await request(app).get(PRODUCTS_ROUTE);

    // Then - The response should have status code 200 and an empty array

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("Should return a list of products when the database is not empty", async () => {

    // Given - A database with some products

    await clearDatabase();

    const products = [
      {
        code: 1,
        name: "Crazy Cola",
        cost_price: "10",
        sales_price: "20",
      },
      {
        code: 2,
        name: "Noodles",
        cost_price: "4",
        sales_price: "5",
      },
    ];

    await prisma.products.createMany({
      data: products,
    });

    // When - A GET request is made to the products route
    const response = await request(app).get(PRODUCTS_ROUTE);

    // Then - The response should have status code 200 and the list of products

    expect(response.statusCode).toBe(200);
    expect(
      response.body.map((product: any) => {
        // codes are returned as strings becasue they're BigInt.
        // However, this conversion is safe because we've used small values.
        product.code = Number(product.code);
        return product;
      })
    ).toEqual(products);
  });

});

test("Products update route /products/update", async () => {

  // Given - A database with some products

  // When - A POST request is made to update some of the products

  const response = await request(app)
    .post("/products/update")
    .send(
      "product_code,new_price\n" +
      "3,2.5\n" + // Set Vegan Apples price to 2.5
      "1,35\n" // Set Crazy Cola price to 35
    )
    .set("Content-Type", "text/plain");

  // Then - The altered products should have their prices updated, but not the
  // others

  expect(response.statusCode).toBe(200);

  const salesPriceByCode = (await prisma.products.findMany({
    where: {
      code: {
        in: [1, 2, 3],
      },
    },
  }))
    .reduce((acc: any, product: products) => (
      { ...acc, [Number(product.code)]: Number(product.sales_price) }
    ), {});

  expect(salesPriceByCode[1]).toEqual(35);
  expect(salesPriceByCode[2]).toEqual(5); // Unchanged
  expect(salesPriceByCode[3]).toEqual(2.5);

});

describe("CSV Validation route /products/validate", () => {

  const VALIDATE_ROUTE = "/products/validate";
  const CSV_HEADERS = "product_code,new_price\n";

  it("Should return how the items would be updated when there are no errors",
    async () => {

      // Given - A CSV updating the Noodles' price

      const newNoodlePrice = "5.50"; // Not over the 10% margin

      // When - A POST request is made to the validation route

      const response = await request(app).post(VALIDATE_ROUTE)
        .send(
          CSV_HEADERS +
          `2,${newNoodlePrice}\n`
        )
        .set("Content-Type", "text/plain");

      // Then - The response should have status code 200 and only one item
      // should be returned, with the new price

      expect(response.statusCode).toBe(200);
      expect(response.body).toEqual([
        {
          code: "2",
          name: "Noodles",
          current_price: "5.00",
          new_price: newNoodlePrice,
        }
      ]);
    }
  );

  it("Should return an error when the price change is over 10% of the current price",
    async () => {
      // Given - A CSV updating the Noodles' price

      const newNoodlePrice = "5.51"; // Over 10%

      // When - A POST request is made to the validation route

      const response = await request(app).post(VALIDATE_ROUTE)
        .send(
          CSV_HEADERS +
          `2,${newNoodlePrice}\n`
        )
        .set("Content-Type", "text/plain");

      // Then - The response should error out explaining the problem

      expect(response.statusCode).toBe(400);

      expect(response.body).toEqual(
        {
          "error_type": "validation_error",
          "errors": [
            "A alteração do valor do produto 2 é maior que 10%"
          ]
        }
      );
    }
  );

  it("Should return an error when the new price is lower than the cost price",
    async () => {
      // Given - A CSV updating the Noodles' price

      const newNoodlePrice = "4.65"; // Lower than cost price (4.8)

      // When - A POST request is made to the validation route

      const response = await request(app).post(VALIDATE_ROUTE)
        .send(
          CSV_HEADERS +
          `2,${newNoodlePrice}\n`
        )
        .set("Content-Type", "text/plain");

      // Then - The response should error out explaining the problem

      expect(response.statusCode).toBe(400);

      expect(response.body).toEqual(
        {
          "error_type": "validation_error",
          "errors": [
            `Novo preço para o produto 2 é menor que o preço de custo (${newNoodlePrice} < 4.80)`,
          ]
        }
      );
    }
  );

  it("Should return an error when the new price is negative or 0",
    async () => {
      // Given - A CSV updating the Noodles' price

      const newNoodlePrice = "-1";

      // When - A POST request is made to the validation route

      const response = await request(app).post(VALIDATE_ROUTE)
        .send(
          CSV_HEADERS +
          `2,${newNoodlePrice}\n`
        )
        .set("Content-Type", "text/plain");

      // Then - The response should error out explaining the problem

      expect(response.statusCode).toBe(400);

      expect(response.body).toEqual(
        {
          "error_type": "validation_error",
          "errors": [
            "Linha 2 (coluna 'new_price'): O valor deve ser maior ou igual a 0."
          ]
        }
      );
    }
  );

  it("Should return an error when an attempt to update a part of a pack isn't reflected in the pack's price",
    async () => {
      // Given - A CSV updating the Noodles' price

      const newNoodlePrice = "-1";

      // When - A POST request is made to the validation route

      const response = await request(app).post(VALIDATE_ROUTE)
        .send(
          CSV_HEADERS +
          `2,${newNoodlePrice}\n`
        )
        .set("Content-Type", "text/plain");

      // Then - The response should error out explaining the problem

      expect(response.statusCode).toBe(400);

      expect(response.body).toEqual(
        {
          "error_type": "validation_error",
          "errors": [
            "Linha 2 (coluna 'new_price'): O valor deve ser maior ou igual a 0."
          ]
        }
      );
    }
  );

});