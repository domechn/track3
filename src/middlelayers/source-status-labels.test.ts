import { expect, it } from "vitest";
import { currentSourceStatusLabels } from "./source-status-labels";
import type { GlobalConfig } from "./datafetch/types";
import type { PortfolioSourceStatus } from "./portfolio-baseline";

it("displays current config aliases for stored statuses without rewriting the stored rows", () => {
  const stored = [
    { sourceId: "cex:0", label: "Main", provider: "Binance", hint: "samp…1234", status: "ok" },
    { sourceId: "btc:0", label: "Cold", provider: "BTC", hint: "bc1abc…5678", status: "stale" },
    { sourceId: "stock:0", label: "Old", provider: "Interactive Brokers", hint: "#1",
      status: "failed" },
  ] as PortfolioSourceStatus[];
  const config = {
    exchanges: [{ name: "binance", alias: "Trading", active: true,
      initParams: { apiKey: "sample-key-1234", secret: "" } }],
    btc: { addresses: [{ address: "bc1abcde12345678", alias: "Vault" }] },
    stockConfig: { brokers: [{ name: "ibkr", alias: "Retirement", active: true,
      initParams: { queryId: "query-1234", token: "" } }] },
  } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, config).map((row) => row.label))
    .toEqual(["Trading", "Vault", "Retirement"]);
  expect(currentSourceStatusLabels(stored, config)[0]).not.toHaveProperty("identityHash");
  expect(stored.map((row) => row.label)).toEqual(["Main", "Cold", "Old"]);
});

it("uses active wallet order when a paused wallet precedes the renamed one", () => {
  const stored = [{ sourceId: "btc:0", label: "Old", provider: "BTC", hint: "bc1act…5678",
    status: "ok" }] as PortfolioSourceStatus[];
  const config = {
    btc: { addresses: [
      { address: "bc1paused", alias: "Paused", active: false },
      { address: "bc1activeaddress5678", alias: "Vault", active: true },
    ] },
  } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, config)[0].label).toBe("Vault");
});

it("keeps a failed exchange's name when deleting it shifts another exchange into its refresh position", () => {
  const stored = [{ sourceId: "cex:0", label: "Main", provider: "Binance",
    hint: "main…1234", status: "failed" }] as PortfolioSourceStatus[];
  const config = { exchanges: [{ name: "okex", alias: "Trading", active: true,
    initParams: { apiKey: "trading-key-5678", secret: "" } }] } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, config)[0].label).toBe("Main");
});

it("keeps a failed exchange's name when it is paused and another exchange takes its refresh position", () => {
  const stored = [{ sourceId: "cex:0", label: "Main", provider: "Binance",
    hint: "main…1234", status: "failed" }] as PortfolioSourceStatus[];
  const config = { exchanges: [
    { name: "binance", alias: "Main", active: false, initParams: { apiKey: "main-key-1234", secret: "" } },
    { name: "okex", alias: "Trading", active: true, initParams: { apiKey: "trading-key-5678", secret: "" } },
  ] } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, config)[0].label).toBe("Main");
});

it("updates a surviving exchange by identity after an earlier exchange is deleted", () => {
  const stored = [
    { sourceId: "cex:0", label: "Main", provider: "Binance", hint: "main…1234", status: "failed" },
    { sourceId: "cex:1", label: "Old OKX", provider: "OKX", hint: "trad…5678", status: "ok" },
  ] as PortfolioSourceStatus[];
  const config = { exchanges: [{ name: "okex", alias: "Trading", active: true,
    initParams: { apiKey: "trading-key-5678", secret: "" } }] } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, config).map((status) => status.label)).toEqual(["Main", "Trading"]);
});

it("keeps stored names when two statuses have the same provider and masked hint", () => {
  const stored = [
    { sourceId: "cex:0", label: "Old A", provider: "Binance", hint: "samp…1234", status: "failed" },
    { sourceId: "cex:1", label: "Old B", provider: "Binance", hint: "samp…1234", status: "ok" },
  ] as PortfolioSourceStatus[];
  const config = { exchanges: [{ name: "binance", alias: "Trading",
    initParams: { apiKey: "sample-key-1234", secret: "" } }] } as GlobalConfig;
  const current = currentSourceStatusLabels(stored, config);
  expect(current.map((status) => status.label)).toEqual(["Old A", "Old B"]);
  expect(current.every((status) => status.walletId === undefined)).toBe(true);
});

it("uses a broker's active provider ordinal to display its current alias", () => {
  const stored = [{ sourceId: "stock:0", label: "Old", provider: "Interactive Brokers",
    hint: "#1", status: "failed" }] as PortfolioSourceStatus[];
  const renamed = { stockConfig: { brokers: [{ name: "ibkr", alias: "Retirement",
    initParams: { queryId: "original-query", token: "" }, active: true }] } } as GlobalConfig;
  const replaced = { stockConfig: { brokers: [{ name: "ibkr", alias: "Trading",
    initParams: { queryId: "other-query", token: "" }, active: true }] } } as GlobalConfig;
  expect(currentSourceStatusLabels(stored, renamed)[0].label).toBe("Retirement");
  expect(currentSourceStatusLabels(stored, replaced)[0].label).toBe("Trading");
});
