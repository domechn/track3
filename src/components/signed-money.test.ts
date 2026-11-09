import { expect, it } from "vitest";
import { formatSignedMoney } from "./signed-money";

it("formats signed money without whitespace between the sign and number", () => {
  const usd = { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" };
  const jpy = { currency: "JPY", rate: 1, alias: "Yen", symbol: "¥" };
  const cny = { currency: "CNY", rate: 7.2, alias: "Yuan", symbol: "¥" };
  const grouped = (value: number) => new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
  expect(formatSignedMoney(-89_876.63, usd)).toBe(`−$${grouped(89_876.63)}`);
  expect(formatSignedMoney(14_054.84, usd)).toBe(`+$${grouped(14_054.84)}`);
  expect(formatSignedMoney(-12_345_678.9, jpy)).toBe(`−¥${grouped(12_345_678.9)}`);
  expect(formatSignedMoney(-2_000_000, cny)).toBe(`−¥${grouped(14_400_000)}`);
  expect(formatSignedMoney(-89_876.63, usd)).not.toMatch(/\s/);
});

it("uses the system number grouping for signed amounts", () => {
  const usd = { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" };
  const grouped = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(1234.5);
  expect(formatSignedMoney(-1234.5, usd)).toBe(`−$${grouped}`);
});
