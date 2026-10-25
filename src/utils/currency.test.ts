import { expect, it } from "vitest";
import { formatPhoneMoney } from "./currency";

it("formats negative phone money with a true minus", () => {
  expect(formatPhoneMoney(-1234.5, "$", true)).toBe("−$1,234.50");
  expect(formatPhoneMoney(-12, "$")).toBe("−$12.00");
});

it("adds a plus only to positive signed phone money", () => {
  expect(formatPhoneMoney(1234.5, "$", true)).toBe("+$1,234.50");
  expect(formatPhoneMoney(1234.5, "$")).toBe("$1,234.50");
});

it("leaves zero unsigned", () => {
  expect(formatPhoneMoney(0, "$", true)).toBe("$0.00");
  expect(formatPhoneMoney(0, "$")).toBe("$0.00");
});
