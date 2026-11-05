import { expect, it } from "vitest";
import { partialEndpointKeys } from "@/middlelayers/datafetch/utils/source-failure";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";

it("translates every partial source endpoint on iPhone in English and Chinese", () => {
  for (const key of Object.values(partialEndpointKeys)) {
    expect(mobileEn).toHaveProperty(`refresh.endpoint.${key}`);
    expect(mobileZh).toHaveProperty(`refresh.endpoint.${key}`);
  }
});
