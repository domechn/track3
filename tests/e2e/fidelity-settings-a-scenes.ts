import type { Page } from "@playwright/test";
import md5 from "md5";
import { installTauriBridge, seedSettingsSnapshots } from "./fidelity-scenes";

type State = { page: string; name: string; theme?: "light" | "dark" };

export const settingsACaptures = "/tmp/fidelity-desktop/settings-a";

export async function settingsASql(page: Page, query: string, values: unknown[] = []) {
  await page.evaluate(({ query, values }) =>
    (window as any).__e2eInvoke("plugin:sql|execute", { query, values }), { query, values });
}

export async function seedSettingsA(page: Page, state: State) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:52:00.000Z"));
  await page.addInitScript(({ locale, theme }) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", locale);
  }, {
    locale: state.page === "language" && state.name === "zh" ? "zh" : "en",
    theme: state.theme ?? (state.page === "appearance" && state.name === "system" ? "system" : "dark"),
  });
  {
    await page.addInitScript(({ error }) => {
      const statuses = [
        { sourceId: "cex:2", label: "Kraken", status: "ok", kind: "exchange", provider: "Kraken", lastSuccessAt: "2026-10-12T18:05:00.000Z" },
        { sourceId: "btc:0", label: "Ledger cold wallet", status: "ok", kind: "wallet", provider: "BTC", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
        { sourceId: "erc20:0", label: "0x4f…a91c", status: "ok", kind: "wallet", provider: "ERC20", lastSuccessAt: "2026-10-31T09:40:00.000Z" },
        { sourceId: "stock:0", label: "Interactive Brokers", status: "ok", kind: "broker", provider: "IBKR", lastSuccessAt: "2026-10-31T09:41:00.000Z" },
        ...(error ? [{ sourceId: "cex:1", label: "OKX", status: "stale", kind: "exchange", provider: "OKX", category: "auth", lastSuccessAt: "2026-10-31T08:12:00.000Z" }] : []),
      ];
      localStorage.setItem("track3-refresh-source-statuses", JSON.stringify(statuses));
    }, { error: state.name === "error" });
  }
  const bridge = await installTauriBridge(page, { fidelitySample: "full" });
  await seedSettingsSnapshots(page);

  const binanceKey = "sample-binance-7Qf2";
  const okxKey = "sample-okx-c91e";
  const krakenKey = "sample-kraken-3Ld0";
  const ledger = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwfx7k2";
  const ethereum = "0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c";
  const queryId = "912406";
  const exchangeYaml = `exchanges:
  - name: binance
    alias: Binance
    initParams: {apiKey: ${binanceKey}, secret: sample-secret}
    active: true
  - name: okex
    alias: OKX
    initParams: {apiKey: ${okxKey}, secret: sample-secret, password: sample-passphrase}
    active: true
  - name: kraken
    alias: Kraken
    initParams: {apiKey: ${krakenKey}, secret: sample-secret}
    active: false
`;
  const walletYaml = `btc:
  addresses:
    - {address: ${ledger}, alias: Ledger cold wallet, active: true}
erc20:
  addresses:
    - {address: '${ethereum}', alias: '0x4f…a91c', active: true}
sol: {addresses: []}
doge: {addresses: []}
trc20: {addresses: []}
ton: {addresses: []}
sui: {addresses: []}
`;
  const brokerYaml = `brokers:
  - name: ibkr
    alias: Interactive Brokers
    initParams: {queryId: '${queryId}', token: sample-flex-token}
    active: true
`;
  const generalYaml = `configs:
  groupUSD: true
  hideInactive: false
others:
  - symbol: GOLD
    alias: Gold bars
    amount: 4
    price: {kind: manual, usd: 2650, setAt: '2026-10-31T09:41:00.000Z'}
  - symbol: NVDA-RSU
    alias: Unvested shares
    amount: 60
    price: {kind: follow, assetType: stock, symbol: NVDA, ratio: 1}
`;
  for (const [id, data] of [
    [10, `!ent:e2e:${exchangeYaml}`],
    [11, walletYaml],
    [12, generalYaml],
    [20, `!ent:e2e:${brokerYaml}`],
    [995, state.page === "blacklist" && state.name === "empty" ? "" : "ETHG,CLAIM-USDT,SHIBAI"],
    [6, "20"],
    [7, "USD"],
    [8, state.page === "appearance" && state.name === "redup" ? "1" : "0"],
  ] as const) {
    await settingsASql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)", [id, data]);
  }
  for (const [currency, alias, symbol, rate] of [
    ["EUR", "Euro", "€", 0.9187],
    ["GBP", "British pound", "£", 0.7712],
    ["CNY", "Chinese yuan", "¥", 7.124],
    ["JPY", "Japanese yen", "¥", 151.32],
    ["HKD", "Hong Kong dollar", "$", 7.7701],
  ] as const) {
    await settingsASql(page, `INSERT OR REPLACE INTO currency_rates (currency, alias, symbol, rate, priority, updatedAt)
      VALUES (?, ?, ?, ?, 1, '2026-10-31T09:30:00.000Z')`, [currency, alias, symbol, rate]);
  }
  const identities = [
    ["Binance", md5(`binance-${binanceKey}`), md5("binance-fidelity-binance-key")],
    ["OKX", md5(`okex-${okxKey}`), md5("okex-fidelity-okx-key")],
    ["Ledger cold wallet", md5(ledger), md5("bc1qfidelityledgerwallet")],
    ["0x4f…a91c", md5(ethereum), md5("0x4f0000000000000000000000000000000000a91c")],
    ["Interactive Brokers", md5(`ibkr:${queryId}`), md5("ibkr:fidelity-query")],
  ];
  for (const [name, identity, seededIdentity] of identities) {
    await settingsASql(page, "UPDATE assets_v2 SET wallet = ? WHERE wallet IN (?, ?)", [identity, name, seededIdentity]);
  }
  return bridge;
}
