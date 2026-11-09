import { expect, test } from "@playwright/test";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  assertCardFill, assertColumnsBalanced, assertGridSnap, assertNoBlankSlabs,
  assertListBounds, assertNoOverflow, assertRowAligned, collectCards, contentBox,
  type Violation,
} from "./layout-audit";
import { captureLayoutPage, seedLayoutFixture, type LayoutFixture } from "./layout-audit-scenes";

const designRoot = process.env.DESIGN_SOURCE_ROOT ?? "/home/ubuntu/.hermes/projects/track3-design";
const desktopDesign: Record<string, string> = {
  overview: "core-overview.html", summary: "analyze-summary.html", wallets: "analyze-wallets.html",
  "coin-btc": "records-coin-btc.html", "coin-one-source": "records-coin-nova.html",
  "coin-stock": "records-coin-nvda.html", assistant: "plan-assistant-new.html",
  comparison: "analyze-comparison.html", "cost-basis": "records-cost-basis.html",
  history: "records-history.html", rebalance: "plan-rebalance.html", goals: "plan-goals.html",
  sources: "settings-a-sources.html", blacklist: "settings-a-blacklist.html",
  currency: "settings-a-currency.html", appearance: "settings-a-appearance.html",
  language: "settings-a-language.html", license: "settings-b-pro.html",
  backup: "settings-b-backup.html", sync: "settings-b-sync.html", about: "settings-b-about.html",
  "sources-wallets": "settings-a-sources.html#wallets",
};
const phoneDesign: Record<string, string> = {
  overview: "core/overview-phone.jpg", summary: "analyze/summary-phone.jpg",
  wallets: "analyze/wallets-all-phone.jpg", "coin-btc": "records/coin-btc-phone.jpg",
  "coin-one-source": "records/coin-nova-phone.jpg", "coin-stock": "records/coin-nvda-phone.jpg",
  comparison: "analyze/comparison-phone.jpg", "cost-basis": "records/cost-basis-phone.jpg",
  history: "records/history-phone.jpg", rebalance: "plan/rebalance-phone.jpg",
  goals: "plan/goals-phone.jpg", sources: "settings-a/sources-default-phone.jpg",
  blacklist: "settings-a/blacklist-default-phone.jpg", currency: "settings-a/currency-default-phone.jpg",
  appearance: "settings-a/appearance-default-phone.jpg", language: "settings-a/language-default-phone.jpg",
  license: "settings-b/pro-phone.jpg", backup: "settings-b/backup-phone.jpg",
  assistant: "plan/assistant-new-phone.jpg", sync: "settings-b/sync-phone.jpg",
  about: "settings-b/about-phone.jpg",
  "sources-wallets": "settings-a/sources-wallets-phone.jpg",
};

async function pixelDifference(page: import("@playwright/test").Page, actual: Buffer, design: Buffer, width: number, height: number, designType: "png" | "jpeg" = "png") {
  return page.evaluate(async ({ actualUrl, designUrl, width, height }) => {
    const image = async (url: string) => {
      const result = new Image();
      result.src = url;
      await result.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const context = canvas.getContext("2d")!;
      context.drawImage(result, 0, 0, width, height);
      return context.getImageData(0, 0, width, height).data;
    };
    const a = await image(actualUrl), b = await image(designUrl);
    let changed = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 60) changed++;
    }
    return Math.round(changed / (width * height) * 100_000) / 1_000;
  }, {
    actualUrl: `data:image/png;base64,${actual.toString("base64")}`,
    designUrl: `data:image/${designType};base64,${design.toString("base64")}`,
    width, height,
  });
}

const routes = [
  ["overview", "/overview"], ["summary", "/summary"], ["comparison", "/comparison"],
  ["wallets", "/wallets"], ["coin-btc", "/coins/BTC"], ["coin-one-source", "/coins/NOVA"],
  ["coin-stock", "/coins/NVDA?assetType=stock"], ["cost-basis", "/cost-basis"],
  ["history", "/history"], ["rebalance", "/rebalance"], ["goals", "/goals"],
  ["assistant", "/assistant"], ["sources", "/settings/configuration?section=sources"],
  ["blacklist", "/settings/data?section=blacklist"],
  ["currency", "/settings/configuration?section=currency"],
  ["appearance", "/settings/appearance?section=theme"],
  ["language", "/settings/appearance?section=language"],
  ["license", "/settings/systemInfo?section=pro"], ["backup", "/settings/data?section=backup"],
  ["sync", "/settings/sync"], ["about", "/settings/systemInfo?section=about"],
] as const;
export const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const iPad = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const plans = [
  { platform: "desktop", width: 1100, height: 720, theme: "light", fixture: "real", sidebar: "collapsed", all: true },
  { platform: "desktop", width: 1280, height: 800, theme: "light", fixture: "real", sidebar: "collapsed", all: true },
  { platform: "desktop", width: 1280, height: 800, theme: "dark", fixture: "real", sidebar: "collapsed", all: true },
  { platform: "desktop", width: 1280, height: 800, theme: "light", fixture: "real", sidebar: "expanded", all: false },
  { platform: "desktop", width: 1440, height: 900, theme: "dark", fixture: "small", sidebar: "collapsed", all: false },
  { platform: "desktop", width: 1440, height: 900, theme: "dark", fixture: "real", sidebar: "collapsed", all: true },
  { platform: "desktop", width: 1920, height: 1080, theme: "light", fixture: "empty", sidebar: "expanded", all: false },
  { platform: "desktop", width: 1920, height: 1080, theme: "light", fixture: "real", sidebar: "collapsed", all: false, overviewOnly: true },
  { platform: "desktop", width: 1280, height: 800, theme: "light", fixture: "small", sidebar: "collapsed", all: true },
  { platform: "desktop", width: 1280, height: 800, theme: "light", fixture: "empty", sidebar: "collapsed", all: true },
  { platform: "mobile", width: 820, height: 1180, theme: "light", fixture: "real", sidebar: "none", all: true },
  { platform: "mobile", width: 820, height: 1180, theme: "dark", fixture: "small", sidebar: "none", all: false },
  { platform: "mobile", width: 390, height: 844, theme: "light", fixture: "real", sidebar: "none", all: true },
  { platform: "mobile", width: 390, height: 844, theme: "dark", fixture: "real", sidebar: "none", all: true },
  { platform: "mobile", width: 390, height: 844, theme: "light", fixture: "small", sidebar: "none", all: true },
  { platform: "mobile", width: 390, height: 844, theme: "light", fixture: "empty", sidebar: "none", all: true },
] as const;

export function registerLayoutAudit(platform: "desktop" | "mobile") {
for (const plan of plans.filter((item) => item.platform === platform)) {
  test(`layout audit ${plan.platform} ${plan.width} ${plan.theme} ${plan.fixture} ${plan.sidebar}`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== plan.platform);
    test.setTimeout(600_000);
    const context = await browser.newContext({
      viewport: { width: plan.width, height: plan.height },
      colorScheme: plan.theme, reducedMotion: "reduce", timezoneId: "UTC",
      userAgent: plan.platform === "mobile" ? plan.width === 820 ? iPad : iPhone : undefined,
    });
    const page = await context.newPage();
    const start = Date.now();
    const violations: (Violation & { page: string; viewport: string; fixture: LayoutFixture })[] = [];
    const exemptions: { page: string; element: string; reason: string }[] = [];
    const measuredCards: Record<string, Awaited<ReturnType<typeof collectCards>>> = {};
    const designMeasurements: Record<string, { x: number; y: number; width: number; height: number; background: string }[]> = {};
    const diffRatios: Record<string, number> = {};
    const jpegDiffRatios: Record<string, number> = {};
    const desktopHtmlAtPhoneDiffRatios: Record<string, number> = {};
    const viewport = `${plan.width}x${plan.height} ${plan.theme} ${plan.sidebar}`;
    const output = `/tmp/track3-layout-audit/${plan.platform}-${plan.width}-${plan.theme}-${plan.fixture}-${plan.sidebar}`;
    await mkdir(output, { recursive: true });
    try {
      await page.addInitScript((theme) => {
        localStorage.setItem("track3-ui-theme", theme);
        localStorage.setItem("track3-ui-locale", "en");
        localStorage.setItem("track3.ui.assistant.panes", '{"chats":true,"context":true}');
      }, plan.theme);
      await seedLayoutFixture(page, plan.fixture);
      const scale = await page.evaluate(async () => {
        const select = (query: string) =>
          (window as typeof window & { __e2eInvoke: (command: string, arguments_: unknown) => Promise<Record<string, number>[]> })
            .__e2eInvoke("plugin:sql|select", { query, values: [] });
        const latest = (await select("SELECT COUNT(*) AS rows, COUNT(DISTINCT wallet) AS sources, COUNT(DISTINCT symbol) AS assets FROM assets_v2 WHERE uuid = 'fidelity-oct-31'"))[0];
        const snapshots = (await select("SELECT COUNT(DISTINCT uuid) AS count FROM assets_v2"))[0].count;
        const lots = (await select("SELECT COUNT(*) AS count FROM transactions WHERE uuid LIKE 'audit-lot-%'"))[0].count;
        return { latest, snapshots, lots };
      });
      if (plan.fixture === "real") {
        expect(scale.latest).toEqual({ rows: 47, sources: 16, assets: 11 });
        expect(scale.snapshots).toBeGreaterThanOrEqual(1000);
        expect(scale.lots).toBe(40);
      } else if (plan.fixture === "small") {
        expect(scale.latest).toEqual({ rows: 2, sources: 1, assets: 2 });
      } else {
        expect(scale.latest.rows).toBe(0);
      }
      const visited = "overviewOnly" in plan && plan.overviewOnly ? routes.filter(([name]) => name === "overview")
        : plan.all ? routes : routes.filter(([name]) =>
          ["overview", "summary", "wallets", "coin-btc", "history", "goals", "assistant", "sync"].includes(name));
      const chrome = new Map<string, { box: { x: number; y: number; width: number; height: number };
        links: { x: number; y: number; width: number; height: number }[];
        badges: { x: number; y: number; width: number; height: number }[] }>();
      for (const [name, route] of visited) {
        await page.goto(`/#${route}`, { waitUntil: "commit" });
        await expect(page.locator("#app-main-content")).toHaveAttribute("data-route", route, { timeout: 30_000 });
        await expect(page.getByText("Loading page", { exact: true })).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator("#app-main-content [aria-busy='true']")).toHaveCount(0, { timeout: 30_000 });
        await expect(page.locator(".mobile-skeleton")).toHaveCount(0, { timeout: 30_000 });
        await page.waitForTimeout(400);
        await page.evaluate(() => document.fonts.ready);
        if (name === "overview" && plan.fixture !== "empty"
          && plan.width === 1280 && plan.sidebar === "collapsed") {
          const hero = await page.locator(".t3-grid-hero").boundingBox();
          const holdings = await page.locator(".t3-grid-holdings").boundingBox();
          expect(hero && holdings && hero.x + hero.width <= holdings.x + 1
            && Math.abs(hero.y - holdings.y) <= 1, "1280px Overview follows the source two-column row").toBe(true);
        }
        if (name === "history" && plan.fixture !== "empty" && plan.platform === "desktop" && plan.width >= 900) {
          const list = await page.locator(".fidelity-history-list").boundingBox();
          const detail = await page.locator(".fidelity-history-detail").boundingBox();
          expect(list && detail && list.x + list.width <= detail.x + 1
            && Math.abs(list.y - detail.y) <= 1, "merged History panes stay beside each other").toBe(true);
        }
        if (plan.fixture !== "empty") {
          await expect.poll(async () => (await collectCards(page)).length, { timeout: 30_000 }).toBeGreaterThan(0);
        }
        if (name === "assistant" && plan.fixture === "real") {
          if (plan.platform === "desktop") {
            await expect(page.getByTestId("session-sidebar")).toContainText("What drove my gain this week?");
            await expect(page.getByTestId("session-sidebar")).not.toContainText("No conversations yet");
            await expect(page.locator(".t3-assistant-insight-row")).toHaveCount(2);
          } else {
            await expect(page.getByRole("button", { name: "Chats" })).toBeVisible();
          }
        }
        if (plan.sidebar === "expanded") {
          const expand = page.getByRole("button", { name: "Expand sidebar" });
          if (await expand.isVisible()) await expand.click();
          await expect.poll(() => page.locator("aside.t3-desktop-rail").evaluate((rail) =>
            Math.round(rail.getBoundingClientRect().width))).toBe(216);
          await expect.poll(() => page.locator(".t3-desktop-column").evaluate((column) =>
            Math.round(column.getBoundingClientRect().x))).toBe(216);
        }
        const cards = await collectCards(page);
        measuredCards[name] = cards;
        exemptions.push(...cards.filter((card) => card.exempt).map((card) =>
          ({ page: name, element: card.id, reason: card.exempt })));
        const bounds = await contentBox(page);
        const found = [
          ...assertRowAligned(cards), ...assertColumnsBalanced(cards), ...assertNoBlankSlabs(cards, bounds),
          ...assertCardFill(cards), ...assertGridSnap(cards, bounds),
          ...await assertListBounds(page), ...await assertNoOverflow(page),
        ];
        if (!cards.length) found.push({ rule: "R5", message: "no cards found in loaded content", boxes: [bounds] });
        const shell = page.locator(plan.platform === "desktop" ? "aside.t3-desktop-rail" : "#app-top-bar").first();
        if (await shell.isVisible()) {
          const box = await shell.boundingBox();
          if (box) {
            const kind = plan.platform === "desktop" ? "desktop"
              : await shell.evaluate((node) => {
                if (node.classList.contains("mobile-topbar-back")) {
                  if (node.closest(".app-layout")?.matches(':is([data-route="/wallets"], [data-route="/comparison"])')) return "compact-back";
                  if (document.body.matches(":has(.fidelity-history, .fidelity-history-detail, .fidelity-cost)")) return "records-back";
                  if (document.body.matches(":has(.fidelity-settings-sources, .ios-d3-mobile-appearance, .fidelity-currency, .fidelity-blacklist, .fidelity-b)")) {
                    return node.querySelector(".mobile-compact-title") ? "settings-titled-back" : "settings-back";
                  }
                  return "back";
                }
                return node.classList.contains("mobile-topbar-collapsed") ? "collapsed"
                  : node.classList.contains("fidelity-overview-topbar") ? "overview" : "root";
              });
            const links = plan.platform === "desktop"
              ? (await page.locator("aside.t3-desktop-rail nav a").all()).map(async (link) => link.boundingBox())
              : [];
            const badges = plan.platform === "desktop"
              ? (await page.locator('aside.t3-desktop-rail a[href="#/goals"] > span[aria-hidden="true"]').all())
                .map(async (badge) => badge.boundingBox())
              : [];
            const current = { box,
              links: (await Promise.all(links)).filter((item): item is NonNullable<typeof item> => !!item),
              badges: (await Promise.all(badges)).filter((item): item is NonNullable<typeof item> => !!item) };
            const before = chrome.get(kind);
            if (before && (Math.abs(current.box.width - before.box.width) > 1
              || Math.abs(current.box.height - before.box.height) > 1
              || current.links.length !== before.links.length
              || current.badges.length !== before.badges.length
              || current.links.some((link, index) => {
                const previous = before.links[index];
                return previous && (Math.abs(link.y - previous.y) > 1 || Math.abs(link.height - previous.height) > 1);
              }) || current.badges.some((badge, index) => {
                const previous = before.badges[index];
                return previous && (Math.abs(badge.x - previous.x) > 1 || Math.abs(badge.y - previous.y) > 1
                  || Math.abs(badge.width - previous.width) > 1 || Math.abs(badge.height - previous.height) > 1);
              }))) {
              found.push({ rule: "R8", message: `${kind} navigation dimensions changed from ${JSON.stringify(before)} to ${JSON.stringify(current)}`,
                boxes: [before.box, current.box, ...current.links, ...current.badges] });
            }
            chrome.set(kind, current);
          }
        }
        for (const item of found) {
          const result = { ...item, page: name, viewport, fixture: plan.fixture as LayoutFixture };
          violations.push(result);
        }
        if ([390, 820, 1100, 1280, 1440].includes(plan.width) && plan.fixture === "real") {
          await captureLayoutPage(page, `${output}/${name}.png`);
          if (plan.theme === "dark" && (plan.sidebar === "collapsed" || plan.sidebar === "none")) {
            const source = plan.platform === "desktop" ? desktopDesign[name] : phoneDesign[name];
            if (source && existsSync(plan.platform === "desktop"
              ? `${designRoot}/source/ds/pages/${source.split("#")[0]}` : `${designRoot}/phone/${source}`)) {
              const actual = await page.screenshot({ path: `${output}/${name}-viewport.png`, animations: "disabled" });
              if (plan.platform === "desktop") {
                const designPage = await context.newPage();
                try {
                  await designPage.goto(`file://${designRoot}/source/ds/pages/${source}`, { waitUntil: "domcontentloaded" });
                  await designPage.waitForTimeout(100);
                  designMeasurements[name] = await designPage.locator("body").evaluate((body) =>
                    [...body.querySelectorAll(".card")].map((node) => {
                      const box = node.getBoundingClientRect();
                      return { x: box.x, y: box.y, width: box.width, height: box.height,
                        background: getComputedStyle(node).backgroundColor };
                    }));
                  const design = await designPage.screenshot({ path: `${output}/${name}-design.png`, animations: "disabled" });
                  diffRatios[name] = await pixelDifference(page, actual, design, plan.width, plan.height);
                } finally {
                  await designPage.close();
                }
              } else {
                const jpeg = await readFile(`${designRoot}/phone/${source}`);
                jpegDiffRatios[name] = await pixelDifference(page, actual, jpeg, plan.width, plan.height, "jpeg");
                diffRatios[name] = jpegDiffRatios[name];
                const designPage = await context.newPage();
                try {
                  await designPage.goto(`file://${designRoot}/source/ds/pages/${desktopDesign[name]}`,
                    { waitUntil: "domcontentloaded" });
                  await designPage.waitForTimeout(100);
                  designMeasurements[name] = await designPage.locator("body").evaluate((body) =>
                    [...body.querySelectorAll(".card")].map((node) => {
                      const box = node.getBoundingClientRect();
                      return { x: box.x, y: box.y, width: box.width, height: box.height,
                        background: getComputedStyle(node).backgroundColor };
                    }));
                  const design = await designPage.screenshot({ path: `${output}/${name}-design.png`, animations: "disabled" });
                  desktopHtmlAtPhoneDiffRatios[name] = await pixelDifference(page, actual, design, plan.width, plan.height);
                } finally {
                  await designPage.close();
                }
              }
            }
          }
        }
        if (name === "sources" && plan.fixture === "real" && plan.platform === "desktop") {
          const fidelitySource = await page.locator(".t3-fidelity-source-page").isVisible();
          const tabs = page.locator(fidelitySource
            ? ".t3-fidelity-source-tabs > button" : ".t3-settings-source-tabs > button");
          const list = page.locator(fidelitySource
            ? ".t3-fidelity-source-card .t3-fidelity-source-row" : ".t3-settings-content table tbody tr");
          const pager = page.locator(fidelitySource
            ? ".t3-fidelity-source-card [data-layout-pager]:visible" : ".t3-settings-content [data-layout-pager]:visible");
          for (const index of [1, 2, 3]) {
            await tabs.nth(index).click();
            await page.waitForTimeout(200);
            const section = `sources-${["wallets", "brokers", "custom"][index - 1]}`;
            if (index === 1) {
              await expect(list).toHaveCount(8);
              await expect(pager).toBeVisible();
            }
            const tabCards = await collectCards(page);
            measuredCards[section] = tabCards;
            violations.push(...[
              ...assertRowAligned(tabCards), ...assertColumnsBalanced(tabCards),
              ...assertNoBlankSlabs(tabCards, await contentBox(page)), ...assertCardFill(tabCards),
              ...assertGridSnap(tabCards, await contentBox(page)), ...await assertListBounds(page),
              ...await assertNoOverflow(page),
            ].map((item) => ({ ...item, page: section, viewport, fixture: plan.fixture as LayoutFixture })));
            if (plan.width === 1280) {
              await captureLayoutPage(page, `${output}/${section}.png`);
              if (section === "sources-wallets" && plan.theme === "dark" && plan.sidebar === "collapsed"
                && existsSync(`${designRoot}/source/ds/pages/settings-a-sources.html`)) {
                const designPage = await context.newPage();
                try {
                  await designPage.goto(`file://${designRoot}/source/ds/pages/${desktopDesign[section]}`,
                    { waitUntil: "domcontentloaded" });
                  await designPage.waitForTimeout(100);
                  designMeasurements[section] = await designPage.locator("body").evaluate((body) =>
                    [...body.querySelectorAll(".card")].map((node) => {
                      const box = node.getBoundingClientRect();
                      return { x: box.x, y: box.y, width: box.width, height: box.height,
                        background: getComputedStyle(node).backgroundColor };
                    }));
                  const actual = await page.screenshot({ animations: "disabled" });
                  const design = await designPage.screenshot({ path: `${output}/${section}-design.png`, animations: "disabled" });
                  diffRatios[section] = await pixelDifference(page, actual, design, plan.width, plan.height);
                } finally {
                  await designPage.close();
                }
              }
            }
            if (index === 1) {
              await pager.getByRole("button", { name: "Next" }).click();
              const total = Number(await tabs.nth(1).locator("span").textContent());
              await expect(list).toHaveCount(total - 8);
              const nextCards = await collectCards(page);
              violations.push(...[
                ...assertCardFill(nextCards), ...await assertListBounds(page), ...await assertNoOverflow(page),
              ].map((item) => ({ ...item, page: `${section}-page-2`, viewport, fixture: plan.fixture as LayoutFixture })));
            }
          }
        }
        if (name === "sources" && plan.fixture === "real" && plan.platform === "mobile") {
          const tabs = page.locator(".t3-mobile-source-tabs [role='tab']");
          for (const index of [1, 2, 3]) {
            await tabs.nth(index).click();
            await page.waitForTimeout(200);
            const section = `sources-${["wallets", "brokers", "custom"][index - 1]}`;
            const tabCards = await collectCards(page);
            measuredCards[section] = tabCards;
            violations.push(...[
              ...assertRowAligned(tabCards), ...assertColumnsBalanced(tabCards),
              ...assertNoBlankSlabs(tabCards, await contentBox(page)), ...assertCardFill(tabCards),
              ...assertGridSnap(tabCards, await contentBox(page)), ...await assertListBounds(page),
              ...await assertNoOverflow(page),
            ].map((item) => ({ ...item, page: section, viewport, fixture: plan.fixture as LayoutFixture })));
            if (plan.width === 390) {
              await captureLayoutPage(page, `${output}/${section}.png`);
              if (section === "sources-wallets" && plan.theme === "dark"
                && existsSync(`${designRoot}/phone/${phoneDesign[section]}`)) {
                const actual = await page.screenshot({ animations: "disabled" });
                const design = await readFile(`${designRoot}/phone/${phoneDesign[section]}`);
                jpegDiffRatios[section] = await pixelDifference(page, actual, design, plan.width, plan.height, "jpeg");
                diffRatios[section] = jpegDiffRatios[section];
                const designPage = await context.newPage();
                try {
                  await designPage.goto(`file://${designRoot}/source/ds/pages/${desktopDesign[section]}`,
                    { waitUntil: "domcontentloaded" });
                  await designPage.waitForTimeout(100);
                  designMeasurements[section] = await designPage.locator("body").evaluate((body) =>
                    [...body.querySelectorAll(".card")].map((node) => {
                      const box = node.getBoundingClientRect();
                      return { x: box.x, y: box.y, width: box.width, height: box.height,
                        background: getComputedStyle(node).backgroundColor };
                    }));
                  const source = await designPage.screenshot({ path: `${output}/${section}-design.png`, animations: "disabled" });
                  desktopHtmlAtPhoneDiffRatios[section] = await pixelDifference(page, actual, source, plan.width, plan.height);
                } finally {
                  await designPage.close();
                }
              }
            }
            if (index === 1) {
              await expect(page.locator(".fidelity-source-group .fidelity-source-row")).toHaveCount(8);
              const total = Number(await tabs.nth(1).locator("span").textContent());
              await page.locator(".fidelity-source-section [data-layout-pager]").getByRole("button", { name: "Next" }).click();
              await expect(page.locator(".fidelity-source-group .fidelity-source-row")).toHaveCount(total - 8);
              const nextCards = await collectCards(page);
              violations.push(...[
                ...assertCardFill(nextCards), ...await assertListBounds(page), ...await assertNoOverflow(page),
              ].map((item) => ({ ...item, page: `${section}-page-2`, viewport, fixture: plan.fixture as LayoutFixture })));
            }
          }
        }
        if (name === "history" && plan.fixture !== "empty") {
          const desktopRows = page.getByTestId("history-snapshot-row");
          if (plan.platform === "desktop" && await desktopRows.count() > 1) {
            await desktopRows.nth(1).click();
            await expect(desktopRows.nth(1)).toHaveClass(/selected/);
            const detail = page.getByTestId("history-desktop-detail");
            await expect(detail).toBeVisible({ timeout: 30_000 });
            const detailCards = await collectCards(page);
            violations.push(...[
              ...assertCardFill(detailCards), ...await assertListBounds(page), ...await assertNoOverflow(page),
            ].map((item) => ({ ...item, page: "history-detail", viewport, fixture: plan.fixture as LayoutFixture })));
            if (plan.width === 1280 && plan.fixture === "real") {
              await detail.scrollIntoViewIfNeeded();
              await captureLayoutPage(page, `${output}/history-detail.png`);
            }
          }
          const row = page.getByTestId("history-mobile-row").first();
          if (await row.isVisible()) {
            await row.click();
            await captureLayoutPage(page, `${output}/history-detail.png`);
            const detailCards = await collectCards(page);
            violations.push(...[
              ...assertCardFill(detailCards), ...await assertNoOverflow(page),
            ].map((item) => ({ ...item, page: "history-detail", viewport, fixture: plan.fixture as LayoutFixture })));
          }
        }
      }
      const report = { runtimeMs: Date.now() - start, viewport, fixture: plan.fixture, violations,
        exemptions, measuredCards, designMeasurements, diffRatios, jpegDiffRatios, desktopHtmlAtPhoneDiffRatios };
      await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2));
      await testInfo.attach("layout-audit-report", { body: Buffer.from(JSON.stringify(report, null, 2)), contentType: "application/json" });
      expect(violations.length, `Layout audit ${viewport} ${plan.fixture}: ${violations.length} violations; full boxes in ${output}/report.json\n${violations.slice(0, 40).map(
        (item) => `${item.page} ${item.viewport} ${item.fixture} ${item.rule}: ${item.message} ${JSON.stringify(item.boxes)}`).join("\n")}`).toBe(0);
    } finally {
      await context.close();
    }
  });
}
}
