import { mkdir, writeFile } from "node:fs/promises";
import md5 from "md5";
import { expect, test, type Page } from "@playwright/test";
import { installTauriBridge } from "./fidelity-scenes";

const output = "/tmp/fidelity/settings-a";
const binanceKey = "fixture-binance-7Qf2";
const okxKey = "fixture-okx-c91e";
const krakenKey = "fixture-kraken-3Ld0";
const btcAddress = "bc1qfixturecoldwalletxxxxxxxxxxxxxxxxxxx7k2";
const ethAddress = "0x4f0000000000000000000000000000000000a91c";
const brokerQuery = "912406";
const designNewKey = "vK3p9Qx2nT8mLw4Zr7YbH1c5uE6dFaG0jS7Qf2";

test.use({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
  reducedMotion: "reduce",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
});

test("quick look keeps its value column reachable at 320px", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Phone quick look");
  await page.setViewportSize({ width: 320, height: 844 });
  await seed(page, "sources-quicklook");
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Quick look Binance" }).click();
  const body = page.locator(".fidelity-quicklook-body");
  await expect(body).toContainText("$112,446.74");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await body.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  const value = (await body.locator("tbody tr").first().locator("td").last().boundingBox())!;
  const sheet = (await page.locator(".fidelity-quicklook-dialog").boundingBox())!;
  expect(value.x + value.width).toBeLessThanOrEqual(sheet.x + sheet.width);
});

test("quick look bounds a long balance table above its footer", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Phone quick look");
  await seed(page, "sources-quicklook");
  await page.goto("/#/settings/configuration?section=sources");
  await page.getByRole("button", { name: "Quick look Binance" }).click();
  const body = page.locator(".fidelity-quicklook-body");
  await expect(body.locator("tbody tr").first()).toBeVisible();
  await body.evaluate((element) => {
    const rows = element.querySelector("tbody")!;
    const sample = rows.querySelector("tr")!;
    for (let index = 0; index < 20; index++) rows.append(sample.cloneNode(true));
  });
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const footer = (await page.locator(".fidelity-quicklook-foot").boundingBox())!;
  const sheet = (await page.locator(".fidelity-quicklook-dialog").boundingBox())!;
  expect(footer.y + footer.height).toBeLessThanOrEqual(sheet.y + sheet.height);
});

async function seed(page: Page, state: string) {
  await page.clock.setFixedTime(new Date(state === "currency-rates-error"
    ? "2026-10-31T09:29:00.000Z" : "2026-10-31T09:45:00.000Z"));
  const bridge = await installTauriBridge(page, {
    fidelitySample: "full", fidelityUsage: true,
    fidelityBinance: {
      apiKey: binanceKey, secret: "fixture-secret",
      balances: { USDT: 112446.74, BTC: 1.2, SOL: 410, ETH: 20, BNB: 85.8796 },
      prices: { BTC: 63842.11, SOL: 168.4, ETH: 2527.14, BNB: 579.58 },
    },
  });
  if (state === "add-ip-loading") bridge.setPublicIpMode("loading");
  if (state === "add-ip-error") bridge.setPublicIpMode("error");
  if (state === "sources-loading") await page.addInitScript(() => {
    const invoke = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = async (cmd: string, args: { query?: string }, ...rest: unknown[]) => {
      if (cmd === "plugin:sql|select" && /^SELECT \* FROM assets_v2 WHERE 1 = 1 AND createdAt >=/i.test(args.query ?? ""))
        await new Promise<never>(() => {});
      return invoke(cmd, args, ...rest);
    };
  });
  await page.evaluate(async ({ binanceKey, okxKey, krakenKey, btcAddress, ethAddress, brokerQuery, identities, state }) => {
    const invoke = (window as any).__e2eInvoke as (cmd: string, args: { query: string; values: unknown[] }) => Promise<unknown>;
    const run = (query: string, values: unknown[] = []) => invoke("plugin:sql|execute", { query, values });
    const exchanges = state === "sources-empty" ? [] : [
      { name: "binance", alias: "Binance", initParams: { apiKey: binanceKey, secret: "fixture-secret" }, active: true },
      { name: "okex", alias: "OKX", initParams: { apiKey: okxKey, secret: "fixture-secret", password: "fixture-pass" }, active: true },
      { name: "kraken", alias: "Kraken", initParams: { apiKey: krakenKey, secret: "fixture-secret" }, active: false },
    ];
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (10, ?)", [
      `!ent:e2e:${JSON.stringify({ exchanges })}`,
    ]);
    await run("UPDATE configuration SET data = ? WHERE id = 11", [
      `btc:\n  addresses:\n    - address: '${btcAddress}'\n      alias: Ledger cold wallet\n      active: true\nerc20:\n  addresses:\n    - address: '${ethAddress}'\n      alias: 0x4f…a91c\n      active: true\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n`,
    ]);
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (20, ?)", [
      `!ent:e2e:${JSON.stringify({ brokers: [{ name: "ibkr", alias: "Interactive Brokers", initParams: {
        token: "fixture-token", queryId: brokerQuery,
      }, active: true }] })}`,
    ]);
    await run("UPDATE configuration SET data = ? WHERE id = 12", [
      `configs:\n  groupUSD: true\n  hideInactive: false\nothers:\n  - symbol: GOLD\n    alias: Gold bars\n    amount: 4\n    price:\n      kind: manual\n      usd: 2650\n      setAt: '2026-10-31T09:41:00.000Z'\n  - symbol: NVDA-RSU\n    alias: Unvested shares\n    amount: 60\n    price:\n      kind: follow\n      assetType: stock\n      symbol: NVDA\n      ratio: 1\n`,
    ]);
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (6, ?)", ["20"]);
    await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (995, ?)", [
      state === "blacklist-empty" ? "" : "ETHG,CLAIM-USDT,SHIBAI",
    ]);
    await run("DELETE FROM currency_rates");
    for (const [currency, alias, symbol, rate, priority] of [
      ["USD", "US dollar", "$", 1, 0],
      ["EUR", "Euro", "€", 0.9187, 1],
      ["GBP", "British pound", "£", 0.7712, 2],
      ["CNY", "Chinese yuan", "¥", 7.1240, 3],
      ["JPY", "Japanese yen", "¥", 151.32, 4],
      ["HKD", "Hong Kong dollar", "$", 7.7701, 5],
    ] as const) await run(
      "INSERT INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
      [currency, alias, symbol, rate, priority, state === "currency-rates-error"
        ? "2026-10-30T09:30:00.000Z" : "2026-10-31T09:30:00.000Z"],
    );
    for (const [source, identity] of identities) {
      await run("UPDATE assets_v2 SET wallet = ? WHERE wallet = ?", [identity, source]);
    }
    if (state === "sources-error") {
      const latest = await invoke("plugin:sql|select", {
        query: "SELECT uuid FROM assets_v2 ORDER BY createdAt DESC, id DESC LIMIT 1", values: [],
      }) as { uuid: string }[];
      await run("INSERT INTO snapshot_partial (uuid, sources_total, missing, fill, created_at) VALUES (?, ?, ?, ?, ?)", [
        latest[0].uuid, 6, JSON.stringify([{
          wallet: identities[1][1], kind: "exchange", provider: "OKX", category: "auth",
          lastSuccessAt: "2026-10-31T08:12:00.000Z",
        }]), "last_known", "2026-10-31T09:41:00.000Z",
      ]);
    }
    if (state === "sources-empty") {
      await run("DELETE FROM assets_v2");
      await run("UPDATE configuration SET data = ? WHERE id = 11", [
        "btc: {addresses: []}\nerc20: {addresses: []}\nsol: {addresses: []}\ndoge: {addresses: []}\ntrc20: {addresses: []}\nton: {addresses: []}\nsui: {addresses: []}\n",
      ]);
      await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (20, ?)", ["!ent:e2e:{\"brokers\":[]}"]);
      await run("UPDATE configuration SET data = ? WHERE id = 12", ["configs:\n  groupUSD: true\nothers: []\n"]);
    }
    if (state === "menu") {
      await run("INSERT OR REPLACE INTO configuration (id, data) VALUES (991, ?)", [
        `!ent:e2e:${JSON.stringify({ enabled: true, endpoint: "https://fixture.r2.cloudflarestorage.com",
          bucket: "fixture-bucket", region: "auto", accessKeyId: "fixture-access", secretAccessKey: "fixture-secret" })}`,
      ]);
    }
  }, {
    binanceKey, okxKey, krakenKey, btcAddress, ethAddress, brokerQuery, state,
    identities: [
      [md5("binance-fidelity-binance-key"), md5(`binance-${binanceKey}`)],
      [md5("okex-fidelity-okx-key"), md5(`okex-${okxKey}`)],
      [md5("bc1qfidelityledgerwallet"), md5(btcAddress)],
      [md5("0x4f0000000000000000000000000000000000a91c"), md5(ethAddress)],
      [md5("ibkr:fidelity-query"), md5(`ibkr:${brokerQuery}`)],
    ],
  });
}

test("retrying a failed source starts a new portfolio fetch", async ({ page }) => {
  test.skip(test.info().project.name !== "mobile", "Phone source retry");
  await seed(page, "sources-error");
  await page.goto("/#/settings/configuration?section=sources");
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await page.evaluate(() => {
    const previous = (window as any).__e2eInvoke;
    (window as any).__sourceRetryFetches = 0;
    (window as any).__e2eInvoke = async (cmd: string, args: unknown, ...rest: unknown[]) => {
      if (cmd === "plugin:http|fetch_send") (window as any).__sourceRetryFetches++;
      return previous(cmd, args, ...rest);
    };
  });
  await page.getByRole("button", { name: "Retry" }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__sourceRetryFetches)).toBeGreaterThan(0);
});

for (const state of [
  "menu", "sources-default", "sources-wallets", "sources-brokers", "sources-custom", "sources-empty",
  "sources-remove", "sources-attach", "sources-error", "sources-loading", "sources-quicklook",
  "add-pick", "add-form", "add-form-okx", "add-form-errors", "add-form-saving", "add-ip-error", "add-ip-loading",
  "add-scrolled", "add-wallet-empty", "add-wallet-eth", "add-wallet-invalid", "add-wallet-saving", "add-broker", "add-broker-error", "add-broker-rejected",
  "add-custom",
] as const) {
  test(`settings A ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page, state);
    await page.goto(state === "menu" ? "/#/settings" : "/#/settings/configuration?section=sources");
    if (state === "menu") {
      await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible({ timeout: 20_000 });
      await page.getByRole("button", { name: "Continue without sync" }).click();
      await expect(page.getByRole("link", { name: "Backup & sync" })).toContainText("On");
    }
    else {
      await expect(page.getByRole("heading", { name: "Data sources" })).toBeVisible({ timeout: 20_000 });
      if (state !== "sources-empty" && state !== "sources-loading") await expect(page.getByText("Binance", { exact: true })).toBeVisible({ timeout: 20_000 });
      if (state.endsWith("wallets")) await page.getByRole("tab", { name: /Wallets/ }).click();
      if (state.endsWith("brokers")) await page.getByRole("tab", { name: /Brokers/ }).click();
      if (state.endsWith("custom")) await page.getByRole("tab", { name: /Custom/ }).click();
      if (state === "sources-remove") {
        await page.getByRole("button", { name: "Delete OKX" }).click();
        await expect(page.getByRole("alertdialog", { name: "Remove OKX?" })).toContainText(
          "OKX will stop refreshing and its API key and secret are deleted from this device.");
        const sheetMetrics = await page.evaluate(() => Object.fromEntries(
          [".fidelity-remove-overlay", ".fidelity-remove-sheet", ".fidelity-remove-sheet h2",
            ".fidelity-remove-sheet p", ".fidelity-remove-sheet footer", ".fidelity-remove-sheet footer button"]
            .map((selector) => {
              const element = document.querySelector(selector)!;
              const bounds = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return [selector, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                padding: style.padding, margin: style.margin, fontSize: style.fontSize,
                background: style.backgroundColor }];
            })));
        await mkdir(output, { recursive: true });
        await writeFile(`${output}/sources-remove-metrics.json`, JSON.stringify(sheetMetrics, null, 2));
      }
      if (state === "sources-quicklook") {
        await page.getByRole("button", { name: "Quick look Binance" }).click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByRole("dialog")).toContainText("$112,446.74");
        await expect(page.getByRole("dialog")).toContainText("Pro quota");
        const lastValue = (await page.locator(".fidelity-quicklook-body tbody tr").first().locator("td").last().boundingBox())!;
        const sheet = (await page.locator(".fidelity-quicklook-dialog").boundingBox())!;
        expect(lastValue.x + lastValue.width).toBeLessThanOrEqual(sheet.x + sheet.width);
        const metrics = await page.evaluate(() => Object.fromEntries(
          [".fidelity-quicklook-dialog", ".fidelity-quicklook-head", ".fidelity-quicklook-body table",
            ".fidelity-quicklook-quota", ".fidelity-quicklook-foot"]
            .map((selector) => {
              const element = document.querySelector(selector)!;
              const bounds = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              return [selector, { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
                padding: style.padding, margin: style.margin, fontSize: style.fontSize }];
            })));
        await mkdir(output, { recursive: true });
        await writeFile(`${output}/sources-quicklook-metrics.json`, JSON.stringify(metrics, null, 2));
      }
      if (state === "sources-attach") {
        await page.getByRole("tab", { name: /Custom/ }).click();
        await page.getByRole("button", { name: "Attach GOLD" }).click();
        await expect(page.getByRole("dialog", { name: "Attach GOLD to a source" })).toContainText("Standalone");
        await expect(page.getByRole("button", { name: "Attach", exact: true })).toBeVisible();
      }
      if (state.startsWith("add-")) {
        if (state.includes("wallet")) await page.getByRole("tab", { name: /Wallets/ }).click();
        if (state.includes("broker")) await page.getByRole("tab", { name: /Brokers/ }).click();
        if (state === "add-custom") await page.getByRole("tab", { name: /Custom/ }).click();
        await page.getByRole("button", { name: state === "add-custom" ? "Add symbol" : /^Add (exchange|wallet|broker|custom asset)$/ }).first().click();
        if (state === "add-pick") {
          await expect(page.getByRole("button", { name: /Binance Key, secret/ })).toHaveAttribute("aria-pressed", "true");
          await page.getByRole("button", { name: /Bitget Key, secret, passphrase/ }).click();
          await page.getByRole("button", { name: "Choose exchange" }).click();
          await expect(page.getByRole("button", { name: /Bitget Key, secret, passphrase/ })).toHaveAttribute("aria-pressed", "true");
        }
        if (["add-form", "add-scrolled", "add-form-saving", "add-ip-error", "add-ip-loading"].includes(state)) {
          await page.getByRole("button", { name: /Binance Key, secret/ }).click();
          await page.getByRole("textbox", { name: "API key" }).fill(designNewKey);
          await page.getByLabel("API secret", { exact: true }).fill("x".repeat(64));
          await page.getByLabel("API secret", { exact: true }).evaluate((node: HTMLInputElement) => node.blur());
          if (state === "add-form-saving") await page.getByRole("textbox", { name: "Label optional" }).fill("Binance");
          if (state === "add-scrolled") await page.locator(".fidelity-editor-body").evaluate((node) => { node.scrollTop = node.scrollHeight; });
          if (state === "add-form-saving") {
            await page.evaluate(() => {
              const invoke = (window as any).__e2eInvoke;
              (window as any).__e2eInvoke = async (cmd: string, args: unknown, ...rest: unknown[]) => {
                if (cmd === "plugin:http|fetch_send") await new Promise<never>(() => {});
                return invoke(cmd, args, ...rest);
              };
            });
            await page.getByRole("button", { name: "Save and test" }).click();
            await expect(page.getByRole("button", { name: /Saving/ })).toBeVisible();
          }
        }
        if (state === "add-form-errors") {
          await page.getByRole("button", { name: /OKX Key, secret, passphrase/ }).click();
          await page.getByLabel("API secret", { exact: true }).fill("x".repeat(24));
          await page.getByRole("button", { name: "Save and test" }).click();
        }
        if (state === "add-form-okx") {
          await page.getByRole("button", { name: /OKX Key, secret, passphrase/ }).click();
          await page.getByRole("textbox", { name: "API key" }).fill(designNewKey);
          await page.getByLabel("API secret", { exact: true }).fill("x".repeat(64));
          await page.getByLabel("API secret", { exact: true }).evaluate((node: HTMLInputElement) => node.blur());
          await page.getByLabel("Passphrase", { exact: true }).fill("x".repeat(14));
          await page.getByLabel("Passphrase", { exact: true }).evaluate((node: HTMLInputElement) => node.blur());
        }
        if (state === "add-wallet-eth" || state === "add-wallet-invalid" || state === "add-wallet-saving") {
          await page.getByRole("button", { name: state === "add-wallet-saving" ? /^BTC Bitcoin$/ : /ETH Pro Ethereum/ }).click();
          if (state === "add-wallet-invalid") {
            await page.getByRole("textbox", { name: "Address" }).fill("0x4f2a8c1e9b07d3a5c6e41f8b2d90zz");
            await page.getByRole("button", { name: "Add wallet" }).last().click();
            await expect(page.getByRole("button", { name: "Add wallet" }).last()).toBeDisabled();
          } else {
            await page.getByRole("textbox", { name: "Address" }).fill(state === "add-wallet-saving"
              ? "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" : "0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c");
            await page.getByRole("textbox", { name: "Address" }).evaluate((node: HTMLInputElement) => node.blur());
            if (state === "add-wallet-saving") {
              await page.getByRole("textbox", { name: "Label optional" }).fill("Cold storage 2");
              await page.getByRole("button", { name: "Add wallet" }).last().click();
              await expect(page.getByRole("dialog", { name: "Edit data source" })).not.toBeVisible();
              await expect(page.getByRole("region", { name: "Wallet" })).toContainText("Cold storage 2");
            }
          }
        }
        if (state === "add-broker-error") {
          await page.getByRole("textbox", { name: "Flex Query ID" }).fill("912x04");
          await page.getByLabel("Flex token", { exact: true }).fill("x".repeat(28));
          await page.getByRole("button", { name: "Save and test" }).click();
        }
        if (state === "add-broker" || state === "add-broker-rejected") {
          await page.getByRole("textbox", { name: "Flex Query ID" }).fill("912406");
          await page.getByLabel("Flex token", { exact: true }).fill("x".repeat(28));
          if (state === "add-broker-rejected") await page.getByRole("button", { name: "Save and test" }).click();
        }
        if (state === "add-custom") {
          await page.getByRole("textbox", { name: "Symbol" }).fill("GOLD");
          await page.getByRole("textbox", { name: "Name" }).fill("Gold bars");
          await page.getByRole("textbox", { name: "Amount" }).fill("4");
          await page.getByRole("radio", { name: "Your price" }).click();
          await page.getByRole("textbox", { name: "Price in USD" }).fill("2650");
          await page.getByRole("textbox", { name: "Price in USD" }).evaluate((node: HTMLInputElement) => node.blur());
          await expect(page.getByRole("textbox", { name: "Price in USD" })).toHaveValue("2,650.00");
          await expect(page.getByRole("combobox", { name: "Attach to a source" })).toHaveCSS("height", "44px");
        }
        if (state !== "add-wallet-saving") await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
    await page.evaluate(() => document.fonts.ready);
    const smallInputs = await page.locator("input, textarea, select").evaluateAll((fields) =>
      fields.filter((field) => field.getClientRects().length && Number.parseFloat(getComputedStyle(field).fontSize) < 16)
        .map((field) => `${field.tagName.toLowerCase()}#${field.id}`));
    expect(smallInputs).toEqual([]);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png` });
    if (process.env.FIDELITY_DEBUG_BOXES === "1" && state === "add-ip-error") {
      console.log("IP_ERROR_BOXES", await page.evaluate(() => [
        ".fidelity-ip-info", ".fidelity-ip-top", ".fidelity-ip-error",
        ".fidelity-ip-error button", ".fidelity-ip-guide", ".fidelity-editor-banner",
      ].map(s => { const r=document.querySelector(s)?.getBoundingClientRect(); return [s,r?.x,r?.y,r?.width,r?.height]; })));
    }
    expect(errors).toEqual([]);
    if (state === "sources-default") {
      await expect(page.getByText("Binance", { exact: true })).toBeVisible();
      await expect(page.locator(".fidelity-source-row").first()).toHaveCSS("padding-top", "10px");
      expect((await page.locator(".fidelity-source-status").first().boundingBox())!.y).toBe(290);
      expect(await page.locator(".fidelity-source-row [role=switch]").first().evaluate(
        element => getComputedStyle(element, "::before").top)).toBe("0px");
      await expect(page.getByText("$358,418.17")).toBeVisible();
      await expect(page.getByRole("button", { name: "Quick look Binance" })).toBeVisible();
    }
    if (state === "sources-empty") {
      await expect(page.getByRole("list", { name: "Getting started" })).toHaveCount(0);
      await expect(page.getByText("No exchanges yet")).toBeVisible();
      await expect(page.locator(".fidelity-source-empty-inner")).toHaveCSS("border-top-style", "dashed");
    }
    if (state === "sources-error") {
      await expect(page.getByText("Error", { exact: true })).toBeVisible();
      await expect(page.getByText("stale", { exact: true })).toBeVisible();
    }
    if (state === "sources-custom") {
      await expect(page.getByText("$10,600.00")).toBeVisible();
      await expect(page.getByText("$8,475.00")).toBeVisible();
    }
    if (state === "sources-wallets") {
      await expect(page.getByText(/ERC20 tokens/)).toBeVisible();
      await expect(page.getByText(/14 of 60 refreshes used this month/)).toBeVisible();
    }
    if (state === "sources-loading") {
      await expect(page.locator(".fidelity-source-skeleton-row")).toHaveCount(3);
    }
    if (state === "add-pick") {
      await expect(page.getByText("Step 1 of 2 · Choose an exchange")).toBeVisible();
      await expect(page.getByRole("button", { name: /Continue with/ })).toBeVisible();
    }
    if (state === "add-form") {
      await expect(page.getByText("Step 2 of 2 · API credentials")).toBeVisible();
      expect((await page.locator(".fidelity-editor-field label").first().boundingBox())!.y).toBe(198.53125);
      await expect(page.locator(".fidelity-editor-drawer")).toHaveCSS("border-left-width", "0px");
      await expect(page.getByRole("button", { name: "Save and test" })).toBeVisible();
    }
    if (state === "add-ip-error") {
      expect((await page.locator(".fidelity-ip-guide").boundingBox())!.y).toBe(587.53125);
      expect((await page.locator(".fidelity-ip-error button").boundingBox())!.width).toBe(78);
      const body = (await page.locator(".fidelity-editor-body").boundingBox())!;
      expect(body.y + body.height).toBe(747);
    }
    if (state === "add-wallet-empty") {
      await expect(page.getByText("Wallet type")).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Address" })).toBeVisible();
    }
    if (state === "add-broker") {
      await expect(page.getByRole("textbox", { name: "Flex Query ID" })).toBeVisible();
      await expect(page.getByLabel("Flex token", { exact: true })).toBeVisible();
    }
  });
}

for (const state of ["currency-default", "currency-select", "currency-updating", "currency-rates-error"] as const) {
  test(`settings A ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page, state);
    await page.goto("/#/settings/configuration?section=currency");
    await expect(page.getByRole("heading", { name: "Currency & display", level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: "Rates preview" })).toBeVisible();
    if (state === "currency-select") {
      await page.getByRole("button", { name: /USD.*US dollar/ }).click();
      await expect(page.getByRole("option", { name: /EUR.*Euro/ })).toBeVisible();
    }
    if (state === "currency-updating" || state === "currency-rates-error") {
      const original = await page.evaluate(() => {
        const old = (window as any).__e2eInvoke;
        (window as any).__e2eInvoke = async (cmd: string, args: { clientConfig?: { url: string } }, ...rest: unknown[]) => {
          if (cmd === "plugin:http|fetch" && args.clientConfig?.url?.includes("currency-rate-api.track3.dev")) {
            if ((window as any).__fidelityRatesMode === "loading") await new Promise<never>(() => {});
            throw new Error("Rates service unavailable");
          }
          return old(cmd, args, ...rest);
        };
        return true;
      });
      expect(original).toBe(true);
      await page.evaluate((mode) => { (window as any).__fidelityRatesMode = mode; },
        state === "currency-updating" ? "loading" : "error");
      await page.getByRole("button", { name: "Update currency rates" }).click();
      if (state === "currency-updating") await expect(page.getByRole("button", { name: "Update currency rates" })).toContainText("Updating");
      else {
        await expect(page.getByRole("alert")).toBeVisible();
        expect((await page.locator(".fidelity-currency-row.is-stack.is-error").boundingBox())?.height).toBe(153);
      }
    }
    await page.evaluate(() => document.fonts.ready);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png` });
    expect(errors).toEqual([]);
  });
}

for (const state of ["blacklist-default", "blacklist-empty", "blacklist-add-error", "blacklist-undo"] as const) {
  test(`settings A ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page, state);
    await page.goto("/#/settings/data?section=blacklist");
    await expect(page.getByRole("heading", { name: "Blacklist", level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: "Hide token" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hide token" })).toHaveCSS("font-size", "13px");
    await expect(page.getByRole("textbox", { name: "Token symbol" })).toHaveCSS("font-size", "16px");
    if (state !== "blacklist-empty") await expect(page.getByRole("button", { name: "Remove ETHG from blacklist" }))
      .toHaveCSS("font-size", "13px");
    if (state === "blacklist-add-error") {
      await page.getByRole("textbox", { name: "Token symbol" }).fill("ETHG");
      await page.getByRole("button", { name: "Hide token" }).click();
      await expect(page.getByRole("alert")).toContainText("already on the blacklist");
    }
    if (state === "blacklist-undo") {
      await page.getByRole("button", { name: "Remove SHIBAI from blacklist" }).click();
      await expect(page.getByText("2 hidden tokens")).toBeVisible();
      await expect(page.getByText("Removed SHIBAI from the blacklist", { exact: true })).toBeVisible();
      await expect(page.getByText("It will show up again after the next refresh.", { exact: true })).toBeVisible();
    }
    await page.evaluate(() => document.fonts.ready);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png` });
    expect(errors).toEqual([]);
  });
}

for (const state of [
  "appearance-default", "appearance-redup", "appearance-system",
  "language-default", "language-zh", "language-zh-toast",
] as const) {
  test(`settings A ${state} capture`, async ({ page }) => {
    test.skip(test.info().project.name !== "mobile", "Phone fidelity capture");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await seed(page, state);
    await page.goto(state.startsWith("appearance")
      ? "/#/settings/appearance?section=theme"
      : "/#/settings/appearance?section=language");
    if (state.startsWith("appearance")) {
      await expect(page.getByRole("heading", { name: "Appearance", level: 1 })).toBeVisible();
      await expect(page.getByText("Gain and loss colours")).toBeVisible();
      if (state === "appearance-default") {
        await expect(page.locator(".fidelity-theme-option-copy strong").first()).toHaveCSS("font-weight", "500");
        await expect(page.locator(".fidelity-choice-radio").first()).toHaveCSS("width", "16px");
        await expect(page.locator(".fidelity-appearance-description")).toHaveCSS("font-size", "12px");
      }
      if (state === "appearance-redup") {
        await page.getByRole("button", { name: /Red up, green down/ }).click();
        await page.evaluate(() => {
          for (const element of document.querySelectorAll<HTMLElement>("*")) {
            if (element.scrollTop) element.scrollTop = 0;
          }
          document.getElementById("app-main-content")!.scrollTo(0, 0);
        });
      }
      if (state === "appearance-system") await page.getByRole("button", { name: /System.*Follow system/ }).click();
    } else {
      await expect(page.getByRole("heading", { name: "Language", level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "App language" })).toBeVisible();
      if (state === "language-zh-toast") await page.clock.pauseAt(new Date("2026-10-31T09:45:00.000Z"));
      if (state !== "language-default") await page.getByRole("button", { name: /简体中文.*Simplified Chinese/ }).click();
      await expect(page.getByRole("heading", { name: state === "language-default" ? "Preview" : "预览" })).toBeVisible();
      if (state === "language-zh") {
        await expect(page.getByText("语言已切换")).toBeHidden();
        await expect(page.locator(".fidelity-language-option").first().locator("small")).toHaveText("English");
        await expect(page.locator(".fidelity-language-option").nth(1).locator("small")).toHaveText("Simplified Chinese");
        await expect(page.locator(".fidelity-language-card.is-preview header span")).toHaveText("简体中文");
      }
      if (state === "language-default") {
        await expect(page.getByText("总览", { exact: true })).toBeVisible();
        await expect(page.locator(".fidelity-language-intro p")).toHaveCSS("font-size", "12px");
      }
      if (state === "language-zh-toast") {
        await expect(page.getByText("语言已切换")).toBeVisible();
        await expect(page.locator(".fidelity-language-toast")).toHaveCSS("border-left-color", "rgb(95, 196, 155)");
      }
    }
    await page.evaluate(() => document.fonts.ready);
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/${state}.png` });
    expect(errors).toEqual([]);
  });
}
