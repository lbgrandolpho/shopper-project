import request from "supertest";
import { app } from "../src/app";

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Delete All Products
  await prisma.products.deleteMany();
});

describe("Test the root path", () => {
  test("It should response the GET method", async () => {
    const response = await request(app).get("/products");
    expect(response.statusCode).toBe(200);
  });
});
