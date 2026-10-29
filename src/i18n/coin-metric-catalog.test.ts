import { expect, it } from "vitest";
import desktopEn from "./locales/en.json";
import desktopZh from "./locales/zh.json";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";

it.each([
  ["desktop", desktopEn, desktopZh],
  ["mobile", mobileEn, mobileZh],
])("%s coin metric copy is accurate in both complete catalogs", (_name, en, zh) => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
  expect(en["coin.costPrice"]).toBe("Avg. buy price (selected range)");
  expect(en["coin.sellPrice"]).toBe("Avg. sell price (selected range)");
  expect(en["coin.costPriceHelp"]).toBe(
    "Holdings at the start of the range are counted at the market price of the first day.",
  );
  expect(en["coin.breakevenHelp"]).toBe("Cost price minus realised profit per coin held.");
  for (const key of ["coin.costPrice", "coin.sellPrice", "coin.costPriceHelp", "coin.breakevenHelp"] as const) {
    expect(zh[key]).toBeTruthy();
    expect(zh[key]).not.toBe(en[key]);
  }
});
