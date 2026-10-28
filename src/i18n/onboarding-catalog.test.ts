import { expect, it } from "vitest"
import desktopEn from "./locales/en.json"
import desktopZh from "./locales/zh.json"
import mobileEn from "@/mobile/en.json"
import mobileZh from "@/mobile/zh.json"

it("keeps both onboarding catalog pairs in lockstep", () => {
  const keys = (catalog: Record<string, string>) => Object.keys(catalog).sort()
  expect(keys(desktopZh)).toEqual(keys(desktopEn))
  expect(keys(mobileZh)).toEqual(keys(mobileEn))
  expect(keys(mobileEn)).not.toContain("onboarding.deeper.pro")
})
