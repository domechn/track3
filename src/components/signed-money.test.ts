import { expect, it } from "vitest";
import { formatSignedMoney } from "./signed-money";

it("keeps the sign, currency, and digits together for CNY and JPY", () => {
  const cny = { currency: "CNY", rate: 1, alias: "Yuan", symbol: "¥" };
  const jpy = { currency: "JPY", rate: 1, alias: "Yen", symbol: "¥" };
  expect(formatSignedMoney(-600_061.17, cny)).toBe("−¥600,061.17");
  expect(formatSignedMoney(93_837.08, cny)).toBe("+¥93,837.08");
  expect(formatSignedMoney(-123_456_789, jpy, 0)).toBe("−¥123,456,789");
  expect(formatSignedMoney(-600_061.17, cny)).not.toMatch(/\s/);
});
