import { expect, it } from "vitest";
import { persistedTransactionPrice } from "./transaction-price";

it("stores an edited quote price in USD and preserves an untouched USD price", () => {
  expect(persistedTransactionPrice(true, 40, 2, 9)).toBe(20);
  expect(persistedTransactionPrice(false, 40, 2, 9)).toBe(9);
});
