import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { installTauriBridge } from "./tauri-bridge"

const iPhoneUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
test.use({ userAgent: iPhoneUserAgent, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
const steps = ["welcome", "sources", "history", "deeper", "backup"]

for (const theme of ["light", "dark"] as const) {
  test(`iPhone guide ${theme} shows five screens without overflow or Pro copy`, async ({ page }) => {
    await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme)
    await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
    await page.goto("/#/overview")
    const dialog = page.getByTestId("onboarding-dialog")
    await expect(dialog).toHaveAttribute("data-step", "welcome")
    mkdirSync("test-results/mobile", { recursive: true })
    for (const [index, step] of steps.entries()) {
      await expect(dialog).toHaveAttribute("data-step", step)
      await page.waitForTimeout(2800)
      expect(await dialog.evaluate((root) => root.scrollWidth <= root.clientWidth)).toBe(true)
      expect(await dialog.locator("button").evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))).toBe(true)
      await expect(dialog).not.toContainText(/\bPro\b|\bsubscribe\b|\bpurchase\b|\bprice\b/i)
      await page.screenshot({ path: `test-results/mobile/onboarding-${step}-${theme}-390.png` })
      if (index < 4) await page.getByTestId("onboarding-next").click()
    }
    await page.getByTestId("onboarding-cta-add-source").click()
    await expect(page).toHaveURL(/#\/settings\/configuration\?section=sources$/)
    await expect(page.getByRole("list", { name: "Getting started" })).toBeVisible()
  })
}

test("phone swipe changes steps but never fires the CTA", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  async function swipe(from: number, to: number) {
    await page.mouse.move(from, 400)
    await page.mouse.down()
    await page.mouse.move(to, 400, { steps: 5 })
    await page.mouse.up()
  }
  await swipe(310, 90)
  await expect(dialog).toHaveAttribute("data-step", "sources")
  await swipe(90, 310)
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  for (let i = 0; i < 5; i++) await swipe(310, 90)
  await expect(dialog).toHaveAttribute("data-step", "backup")
  expect(await page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBeNull()
})

test("small phone and iPad layouts are accessible", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  for (const size of [{ width: 320, height: 568 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size)
    await page.goto("/#/overview")
    const dialog = page.getByTestId("onboarding-dialog")
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((root) => root.scrollWidth <= root.clientWidth)).toBe(true)
    const heights = await dialog.locator("button").evaluateAll((buttons) => buttons.map((button) => ({ text: button.textContent, height: button.getBoundingClientRect().height })))
    expect(heights.filter(({ height }) => height < 44), JSON.stringify(size)).toEqual([])
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(results.violations).toEqual([])
    mkdirSync("test-results/mobile", { recursive: true })
    await page.waitForTimeout(2700)
    await page.screenshot({ path: `test-results/mobile/onboarding-welcome-${size.width}.png` })
  }
})

test("replay opens from mobile About", async ({ page }) => {
  await installTauriBridge(page)
  await page.goto("/#/settings/systemInfo?section=about")
  const replay = page.getByTestId("onboarding-replay")
  await replay.click()
  await expect(page.getByTestId("onboarding-dialog")).toHaveAttribute("data-step", "welcome")
  await page.keyboard.press("Escape")
  await expect(replay).toBeFocused()
})

test("startup lock hides the guide", async ({ page }) => {
  await installTauriBridge(page, { lockedStartup: true, onboarding: true, emptyPortfolio: true })
  await page.goto("/#/overview")
  await expect(page.getByTestId("onboarding-dialog")).toHaveCount(0)
})

test("dark Chinese phone guide keeps the same layout and copy", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-theme", "dark")
    localStorage.setItem("track3-ui-locale", "zh")
  })
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toContainText("欢迎使用 Track3")
  expect(await dialog.evaluate((node) => getComputedStyle(node).getPropertyValue("--ill-1").trim())).toBe("#6d97fa")
  await page.waitForTimeout(2700)
  mkdirSync("test-results/mobile", { recursive: true })
  await page.screenshot({ path: "test-results/mobile/onboarding-welcome-dark-zh-390.png" })
  for (let i = 0; i < 4; i++) await page.getByTestId("onboarding-next").click()
  await expect(dialog).toContainText("设置 → 备份")
  await page.waitForTimeout(2700)
  await page.screenshot({ path: "test-results/mobile/onboarding-backup-dark-zh-390.png" })
})

test("iPad backdrop dismissal remembers Skip", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 })
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  await expect(page.getByTestId("onboarding-dialog")).toBeVisible()
  const overlay = page.locator(".ob-overlay")
  await expect(overlay).toHaveCSS("opacity", "1")
  await overlay.click({ position: { x: 24, y: 24 } })
  await expect(page.getByTestId("onboarding-dialog")).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBe("skipped")
})

for (const theme of ["light", "dark"] as const) {
  test(`360px phone and landscape guide pass axe in ${theme}`, async ({ page }) => {
    await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme)
    await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
    await page.setViewportSize({ width: 360, height: 720 })
    await page.goto("/#/overview")
    const dialog = page.getByTestId("onboarding-dialog")
    await expect(dialog).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(results.violations).toEqual([])
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(dialog).toBeVisible()
    expect(await dialog.evaluate((root) => {
      const text = root.querySelector(".ob-text")!.getBoundingClientRect()
      const button = root.querySelector('[data-testid="onboarding-next"]')!.getBoundingClientRect()
      const card = root.getBoundingClientRect()
      return text.height > 0 && button.top >= card.top && button.bottom <= card.bottom
        && root.scrollWidth <= root.clientWidth
    })).toBe(true)
    mkdirSync("test-results/mobile", { recursive: true })
    await page.waitForTimeout(2700)
    await page.screenshot({ path: `test-results/mobile/onboarding-landscape-${theme}.png` })
  })
}

test("dark iPad sizes retain card contrast", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"))
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  for (const size of [{ width: 320, height: 568 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(size)
    await page.goto("/#/overview")
    const dialog = page.getByTestId("onboarding-dialog")
    await expect(dialog).toBeVisible()
    expect(await dialog.locator("button").evaluateAll((buttons) => buttons.every((button) => button.getBoundingClientRect().height >= 44))).toBe(true)
    await page.waitForTimeout(2700)
    mkdirSync("test-results/mobile", { recursive: true })
    await page.screenshot({ path: `test-results/mobile/onboarding-welcome-dark-${size.width}.png` })
  }
})
