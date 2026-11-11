import { expect, it } from "vitest";
import { partialEndpointKeys } from "@/middlelayers/datafetch/utils/source-failure";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";
import desktopEn from "@/i18n/locales/en.json";
import desktopZh from "@/i18n/locales/zh.json";

it("translates every partial source endpoint on iPhone in English and Chinese", () => {
  for (const key of Object.values(partialEndpointKeys)) {
    expect(mobileEn).toHaveProperty(`refresh.endpoint.${key}`);
    expect(mobileZh).toHaveProperty(`refresh.endpoint.${key}`);
  }
});

it("has IBKR status and guidance copy in both locales on desktop and mobile", () => {
  for (const catalog of [desktopEn, desktopZh, mobileEn, mobileZh]) {
    for (const key of [
      "refresh.detail.ibkrTokenExpired", "refresh.detail.ibkrIpRestricted",
      "refresh.detail.ibkrInvalidToken", "refresh.detail.ibkrInvalidQuery",
      "refresh.detail.ibkrNoPermission", "refresh.detail.ibkrRateLimited",
      "refresh.detail.ibkrNotReady", "refresh.endpoint.ibkrCash",
      "refresh.endpoint.ibkrUnvaluedPositions",
      "fidelity.editor.brokerTokenExpiry", "fidelity.settings.add.flexTokenExpiry",
    ]) {
      expect(catalog).toHaveProperty(key);
    }
  }
  expect(Object.keys(desktopEn).sort()).toEqual(Object.keys(desktopZh).sort());
  expect(Object.keys(mobileEn).sort()).toEqual(Object.keys(mobileZh).sort());
});
