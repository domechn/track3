import { describe, expect, it } from "vitest";
import { configurationFromForm, invalidConfigurationFields, syncFormWithCategory, syncFormWithField, syncFormWithPathStyle } from "./config-form";

it("keeps the exact config fields, order, and inactive sources", () => {
  const config = configurationFromForm({
    exchanges: [{ type: "okex", alias: "desk", apiKey: "key", secret: "secret", password: "pass", passphrase: "extra", active: false }],
    stockBrokers: [{ type: "ibkr", alias: "stocks", token: "token", queryId: "qid", active: true }],
    wallets: [{ type: "btc", alias: "cold", address: "bc1", active: false }],
    groupUSD: true, hideInactive: false, others: [{ symbol: "OTHER", amount: 2 }],
  });
  expect(config.exchanges).toEqual([{ name: "okex", alias: "desk", initParams: { apiKey: "key", secret: "secret", password: "pass", passphrase: undefined }, active: false }]);
  expect(config.stockConfig).toEqual({ brokers: [{ name: "ibkr", alias: "stocks", initParams: { token: "token", queryId: "qid" }, active: true }] });
  expect(config.btc).toEqual({ addresses: [{ alias: "cold", address: "bc1", active: false }] });
  expect(config.others).toEqual([{ symbol: "OTHER", amount: 2 }]);
  expect(Object.keys(config)).toEqual(["configs", "exchanges", "stockConfig", "btc", "erc20", "sol", "doge", "trc20", "ton", "sui", "others"]);
});

it("keeps sync form updates scoped to the chosen field", () => {
  const form = { endpoint: "old", pathStyle: false, categories: { history: true, settings: false, secrets: false, rebalance: false, chat: false } } as Parameters<typeof syncFormWithField>[0];
  expect(syncFormWithField(form, "endpoint", "new")).toEqual({ ...form, endpoint: "new" });
  expect(syncFormWithPathStyle(form, true)).toEqual({ ...form, pathStyle: true });
  expect(syncFormWithCategory(form, "chat", true)).toEqual({ ...form, categories: { ...form.categories, chat: true } });
});

it("rejects credentialed endpoints, invalid bucket paths, and missing credentials", () => {
  const form = {
    endpoint: "https://user:password@example.test/path?query=1",
    pathStyle: false, region: " ", bucket: "bad/bucket", prefix: "safe/../unsafe",
    accessKeyId: " ", secretAccessKey: "",
  } as Parameters<typeof invalidConfigurationFields>[0];
  expect([...invalidConfigurationFields(form)].sort()).toEqual([
    "accessKeyId", "bucket", "endpoint", "prefix", "region", "secretAccessKey",
  ]);
});

it("allows local HTTP only with path style and a valid sync location", () => {
  const form = {
    endpoint: "http://127.0.0.1:9000/", pathStyle: true, region: "us-east-1",
    bucket: "track3-test", prefix: "nested/path", accessKeyId: "fake", secretAccessKey: "fake",
  } as Parameters<typeof invalidConfigurationFields>[0];
  expect([...invalidConfigurationFields(form)]).toEqual([]);
  expect([...invalidConfigurationFields({ ...form, pathStyle: false })]).toEqual(["endpoint"]);
});

it("builds the exact assistant configuration from trimmed form values", async () => {
  const { assistantConfigFromForm, parseAdvanced } = await import("./config-form");
  const parsed = parseAdvanced('{"headers":{"X-Test":"v"}}');
  expect(parsed).toEqual({ value: { headers: { "X-Test": "v" } }, warnings: [] });
  expect(assistantConfigFromForm({ endpoint: " https://example.test ", apiKey: "  key  ", model: " model ", contextSize: 2.8, allowActions: false, inputPrice: " 1.5 ", outputPrice: "", advanced: parsed.value, proactiveInsightsSummary: true })).toEqual({
    endpoint: "https://example.test", apiKey: "  key  ", model: "model", contextSize: 2,
    allowActions: false, inputPricePerMillionTokens: 1.5, outputPricePerMillionTokens: undefined,
    advanced: { headers: { "X-Test": "v" } }, proactiveInsightsSummary: true,
  });
});

it("maps stored legacy wallet strings and inactive exchanges into form rows", async () => {
  const { configurationToForm, initialConfiguration } = await import("./config-form");
  const form = configurationToForm({ ...initialConfiguration,
    exchanges: [{ name: "binance", initParams: { apiKey: "k", secret: "s" } }],
    btc: { addresses: ["bc1", { address: "bc2", active: false }] },
  });
  expect(form.exchanges).toEqual([{ type: "binance", alias: undefined, apiKey: "k", secret: "s", password: undefined, passphrase: undefined, active: true }]);
  expect(form.wallets).toEqual([{ type: "btc", address: "bc1", active: true }, { type: "btc", address: "bc2", alias: undefined, active: false }]);
});
