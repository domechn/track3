import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import { installTauriBridge } from "./tauri-bridge"

test.use({ viewport: { width: 1280, height: 800 } })
const steps = ["welcome", "sources", "history", "deeper", "backup"]

test("fresh desktop guide skips once, supports keyboard, and traps focus", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  mkdirSync("test-results/desktop", { recursive: true })
  await page.waitForTimeout(2800)
  await page.screenshot({ path: "test-results/desktop/onboarding-welcome-light-en.png" })
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab")
    expect(await page.evaluate(() => document.querySelector('[data-testid="onboarding-dialog"]')?.contains(document.activeElement))).toBe(true)
  }
  await dialog.focus()
  await page.keyboard.press("Enter")
  await expect(dialog).toHaveAttribute("data-step", "sources")
  await page.keyboard.press("ArrowLeft")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBe("skipped")
  await page.reload()
  await expect(dialog).toHaveCount(0)
})

test("desktop guide completes, captures every frame, and makes no HTTP calls", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("track3-ui-locale", "zh")
    localStorage.setItem("track3-ui-theme", "dark")
  })
  const bridge = await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  const before = bridge.httpRequests()
  mkdirSync("test-results/desktop", { recursive: true })
  for (const [index, step] of steps.entries()) {
    await expect(dialog).toHaveAttribute("data-step", step)
    await page.waitForTimeout(2800)
    await page.screenshot({ path: `test-results/desktop/onboarding-${step}-dark-zh.png` })
    const violations = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
    expect(violations.violations).toEqual([])
    if (index < 4) await dialog.press("ArrowRight")
  }
  expect(bridge.httpRequests()).toBe(before)
  await page.getByTestId("onboarding-cta-add-source").click()
  await expect(page).toHaveURL(/#\/settings\/configuration$/)
  expect(await page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBe("completed")
})

test("existing desktop user can replay from System and focus returns", async ({ page }) => {
  await installTauriBridge(page, { onboarding: true })
  await page.goto("/#/settings/systemInfo")
  await expect(page.getByTestId("onboarding-dialog")).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBe("existing")
  const replay = page.getByTestId("onboarding-replay")
  await replay.click()
  await expect(page.getByTestId("onboarding-dialog")).toHaveAttribute("data-step", "welcome")
  await page.keyboard.press("Escape")
  await expect(replay).toBeFocused()
})

test("narrow desktop guide fits its viewport", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 640 })
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toBeVisible()
  await dialog.press("ArrowRight")
  mkdirSync("test-results/desktop", { recursive: true })
  await page.waitForTimeout(2600)
  await page.screenshot({ path: "test-results/desktop/onboarding-sources-narrow-light.png" })
  expect(await dialog.evaluate((root) => {
    const rect = root.getBoundingClientRect()
    if (rect.left < 0 || rect.top < 0 || rect.right > innerWidth || rect.bottom > innerHeight) return false
    return [...root.querySelectorAll("button, h2, p, li")].every((element) => {
      const child = element.getBoundingClientRect()
      return child.left >= rect.left && child.top >= rect.top && child.right <= rect.right && child.bottom <= rect.bottom
    })
  })).toBe(true)
})

test("reduced motion shows static art and remains accessible", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" })
  await page.addInitScript(() => localStorage.setItem("track3-ui-theme", "dark"))
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toBeVisible()
  await dialog.press("ArrowRight")
  await dialog.press("ArrowRight")
  await expect(page.getByTestId("onboarding-illustration-history")).toHaveAttribute("data-reduced", "true")
  await page.waitForTimeout(200)
  mkdirSync("test-results/desktop", { recursive: true })
  await page.screenshot({ path: "test-results/desktop/onboarding-history-reduced-dark.png" })
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  expect(results.violations).toEqual([])
})

test("desktop backdrop dismissal remembers Skip", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  await expect(page.getByTestId("onboarding-dialog")).toBeVisible()
  const overlay = page.locator(".ob-overlay")
  await expect(overlay).toHaveCSS("opacity", "1")
  await overlay.click({ position: { x: 24, y: 24 } })
  await expect(page.getByTestId("onboarding-dialog")).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem("track3-onboarding-v1"))).toBe("skipped")
})

test("turning on reduced motion mid-step reveals the final illustration", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toBeVisible()
  for (let i = 0; i < 4; i++) await dialog.press("ArrowRight")
  const illustration = page.getByTestId("onboarding-illustration-backup")
  await expect(illustration).toBeAttached()
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(illustration).toHaveAttribute("data-reduced", "true")
  const check = illustration.locator('circle[cx="282"][cy="108"]').locator("..")
  expect(await check.evaluate((node) => getComputedStyle(node).opacity)).toBe("1")
})

test("source and backup checks use the illustration accent", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await dialog.press("ArrowRight")
  await expect(page.getByTestId("onboarding-illustration-sources").locator('circle[cx="248"][cy="102"]')).toHaveCSS("fill", "rgb(99, 102, 241)")
  for (let i = 0; i < 3; i++) await dialog.press("ArrowRight")
  await expect(page.getByTestId("onboarding-illustration-backup").locator('circle[cx="282"][cy="108"]')).toHaveCSS("fill", "rgb(99, 102, 241)")
})

test("source controls stay anchored while Refresh animates", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  await dialog.press("ArrowRight")
  await expect(dialog).toHaveAttribute("data-step", "sources")
  await page.waitForTimeout(1550)
  mkdirSync("test-results/desktop", { recursive: true })
  await page.screenshot({ path: "test-results/desktop/onboarding-sources-mid-motion.png" })
  const anchored = await page.getByTestId("onboarding-illustration-sources").evaluate((svg) => {
    const pill = svg.querySelector<SVGRectElement>('rect[x="196"][y="31"]')!.getBoundingClientRect()
    const icon = svg.querySelector<SVGPathElement>('path[d^="M216.5"]')!.parentElement!.getBoundingClientRect()
    const track = svg.querySelector<SVGRectElement>('rect[x="54"][y="66"][fill="var(--ill-bar)"]')!.getBoundingClientRect()
    const fill = svg.querySelector<SVGRectElement>('rect[x="54"][y="66"][fill="var(--ill-1)"]')!.getBoundingClientRect()
    return {
      iconInsidePill: icon.left >= pill.left && icon.right <= pill.right && icon.top >= pill.top && icon.bottom <= pill.bottom,
      fillStartsAtLeft: Math.abs(fill.left - track.left) < 2,
    }
  })
  expect(anchored.iconInsidePill).toBe(true)
  expect(anchored.fillStartsAtLeft).toBe(true)
})

test("rebalance bars remain inside their tile while settling", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  for (let i = 0; i < 3; i++) await dialog.press("ArrowRight")
  await expect(dialog).toHaveAttribute("data-step", "deeper")
  await page.waitForTimeout(1050)
  mkdirSync("test-results/desktop", { recursive: true })
  await page.screenshot({ path: "test-results/desktop/onboarding-deeper-mid-motion.png" })
  const barsInsideTile = await page.getByTestId("onboarding-illustration-deeper").evaluate((svg) => {
    const tile = svg.querySelector<SVGRectElement>('rect[x="20"][y="124"]')!.getBoundingClientRect()
    return [...svg.querySelectorAll<SVGRectElement>('rect[y="172"][height="34"]')].every((bar) => {
      const rect = bar.getBoundingClientRect()
      return rect.left >= tile.left && rect.right <= tile.right && rect.top >= tile.top && rect.bottom <= tile.bottom
    })
  })
  expect(barsInsideTile).toBe(true)
})

test("shield pulse ring is hidden until its cue", async ({ page }) => {
  await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
  await page.goto("/#/overview")
  const dialog = page.getByTestId("onboarding-dialog")
  await expect(dialog).toHaveAttribute("data-step", "welcome")
  await dialog.press("ArrowRight")
  await dialog.press("ArrowLeft")
  const ring = page.getByTestId("onboarding-illustration-welcome").locator('circle[cx="246"][cy="170"][r="40"]')
  await expect(ring).toBeAttached()
  await page.waitForTimeout(300)
  expect(await ring.evaluate((node) => getComputedStyle(node).opacity)).toBe("0")
})

for (const theme of ["light", "dark"] as const) {
  test(`all guide steps pass axe with reduced motion in ${theme}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: theme })
    await page.addInitScript((theme) => localStorage.setItem("track3-ui-theme", theme), theme)
    await installTauriBridge(page, { emptyPortfolio: true, onboarding: true })
    await page.goto("/#/overview")
    const dialog = page.getByTestId("onboarding-dialog")
    for (const [index, step] of steps.entries()) {
      await expect(dialog).toHaveAttribute("data-step", step)
      await expect(page.getByTestId(`onboarding-illustration-${step}`)).toHaveAttribute("data-reduced", "true")
      await expect(page.getByTestId(`onboarding-step-${step}`)).toHaveCSS("opacity", "1")
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
      expect(results.violations).toEqual([])
      if (index < 4) await page.getByTestId("onboarding-next").click()
    }
  })
}
