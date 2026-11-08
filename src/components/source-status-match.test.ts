import { expect, it } from "vitest";
import md5 from "md5";
import { matchSourceStatus } from "./source-status-match";
import { currentSourceStatusLabels } from "@/middlelayers/source-status-labels";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";

const ids = [
  "5fe405ab1234567890abcdef1234d0e2",
  "552f2f3a1234567890abcdef12c483e",
];

it("matches an unaliased address by provider and masked hint despite different ids and labels", () => {
  const sources = ids.map((id, index) => ({ id, label: `Wallet ${index + 1}` }));
  const identities = {
    [ids[0]]: { wallet: "0x1234567890abcdef1234567890abcdefabcd1234", type: "ERC20" },
    [ids[1]]: { wallet: "0xabcdef7890abcdef1234567890abcdefabcd5678", type: "ERC20" },
  };
  const statuses = [
    { sourceId: "erc20:1", label: "ERC20 wallet 2", kind: "wallet" as const, provider: "ERC20", hint: "0xabcd…5678", status: "failed" as const },
    { sourceId: "erc20:0", label: "ERC20 wallet 1", kind: "wallet" as const, provider: "ERC20", hint: "0x1234…1234", status: "ok" as const },
  ];
  expect(matchSourceStatus(sources[0], identities, sources, statuses)?.status).toBe("ok");
  expect(matchSourceStatus(sources[1], identities, sources, statuses)?.status).toBe("failed");
});

it("joins an exchange status to its portfolio wallet through current config without persisting a new field", () => {
  const stored = [{ sourceId: "cex:0", label: "Main", kind: "exchange" as const,
    provider: "Binance", hint: "samp…1234", status: "failed" as const }];
  const config = configurationFromForm({
    exchanges: [{ type: "binance", alias: "Trading", apiKey: "sample-key-1234", secret: "", active: true }],
    wallets: [], stockBrokers: [], others: [], groupUSD: false, hideInactive: false,
  });
  const statuses = currentSourceStatusLabels(stored, config);
  const id = md5("binance-sample-key-1234");
  const source = { id, label: "Trading" };
  const identities = { [id]: { wallet: `binance-${id.slice(0, 8)}`, type: "binance" } };
  expect(matchSourceStatus(source, identities, [source], statuses)).toMatchObject({
    sourceId: "cex:0", label: "Trading", status: "failed",
  });
  expect(stored[0]).not.toHaveProperty("walletId");
});

it("matches a sole broker and a short-key exchange by provider when their numbered hints cannot identify a wallet", () => {
  const sources = ids.map((id, index) => ({ id, label: `Wallet ${index + 1}` }));
  const identities = {
    [ids[0]]: { wallet: "Binance-5fe405ab", type: "Binance" },
    [ids[1]]: { wallet: "IBKR-552f2f3a", type: "IBKR" },
  };
  const statuses = [
    { sourceId: "cex:0", label: "binance 1", kind: "exchange" as const, provider: "Binance", hint: "#1", status: "ok" as const },
    { sourceId: "stock:0", label: "IBKR 1", kind: "broker" as const, provider: "Interactive Brokers", hint: "#1", status: "ok" as const },
  ];
  expect(matchSourceStatus(sources[0], identities, sources, statuses)?.sourceId).toBe("cex:0");
  expect(matchSourceStatus(sources[1], identities, sources, statuses)?.sourceId).toBe("stock:0");
  expect(matchSourceStatus(sources[1], { ...identities, [ids[1]]: identities[ids[0]] }, sources, statuses)?.sourceId).toBeUndefined();
});

it("matches a raw stored exchange status to the sole mobile portfolio source", () => {
  const id = md5("binance-example-key");
  const source = { id, label: "Trading" };
  const identities = { [id]: { wallet: `binance-${id.slice(0, 8)}`, type: "binance" } };
  const statuses = [{ sourceId: "cex:0", label: "Old name", kind: "exchange" as const,
    provider: "Binance", hint: "exam…-key", status: "failed" as const }];
  expect(matchSourceStatus(source, identities, [source], statuses)?.sourceId).toBe("cex:0");
});

it("matches two broker statuses by their portfolio identities after current config joins their ordinals", () => {
  const config = configurationFromForm({
    exchanges: [], wallets: [], others: [], groupUSD: false, hideInactive: false,
    stockBrokers: [
      { type: "ibkr", alias: "Retirement", queryId: "first-query", token: "", active: true },
      { type: "ibkr", alias: "Trading", queryId: "second-query", token: "", active: true },
    ],
  });
  const stored = [
    { sourceId: "stock:0", label: "Old first", kind: "broker" as const,
      provider: "Interactive Brokers", hint: "#1", status: "failed" as const },
    { sourceId: "stock:1", label: "Old second", kind: "broker" as const,
      provider: "Interactive Brokers", hint: "#2", status: "ok" as const },
  ];
  const statuses = currentSourceStatusLabels(stored, config);
  const first = md5("ibkr:first-query");
  const second = md5("ibkr:second-query");
  const sources = [{ id: second, label: "Trading" }, { id: first, label: "Retirement" }];
  const identities = {
    [first]: { wallet: `ibkr-${first.slice(0, 8)}`, type: "ibkr" },
    [second]: { wallet: `ibkr-${second.slice(0, 8)}`, type: "ibkr" },
  };
  expect(matchSourceStatus(sources[0], identities, sources, statuses)?.sourceId).toBe("stock:1");
  expect(matchSourceStatus(sources[1], identities, sources, statuses)?.sourceId).toBe("stock:0");
  expect(stored[0]).not.toHaveProperty("walletId");
});

it("does not claim a masked hint shared by two addresses", () => {
  const sources = ids.map((id, index) => ({ id, label: `Wallet ${index + 1}` }));
  const identities = {
    [ids[0]]: { wallet: "0x1234567890abcdef1234567890abcdefabcd1234", type: "ERC20" },
    [ids[1]]: { wallet: "0x1234ff7890abcdef1234567890abcdefabcd1234", type: "ERC20" },
  };
  const statuses = [
    { sourceId: "erc20:0", label: "ERC20 wallet 1", status: "ok" as const, kind: "wallet" as const,
      provider: "ERC20", hint: "0x1234…1234" },
  ];
  expect(matchSourceStatus(sources[0], identities, sources, statuses)).toBeUndefined();
  expect(matchSourceStatus(sources[1], identities, sources, statuses)).toBeUndefined();
});

it("does not assign a deleted source's failure to a different source with the same alias", () => {
  const sources = [{ id: ids[1], label: "Main" }];
  const identities = { [ids[1]]: { wallet: "0xabcdef7890abcdef1234567890abcdefabcd5678", type: "ERC20" } };
  const statuses = [{ sourceId: "erc20:0", label: "Main", status: "failed" as const,
    kind: "wallet" as const, provider: "ERC20", hint: "0x1234…1234" }];
  expect(matchSourceStatus(sources[0], identities, sources, statuses)).toBeUndefined();
});

it("does not assign a legacy wallet failure to a different address", () => {
  const source = { id: ids[1], label: "Main" };
  const identities = { [ids[1]]: { wallet: "0xabcdef7890abcdef1234567890abcdefabcd5678", type: "ERC20" } };
  const statuses = [{ sourceId: "erc20:0", label: "Old", status: "failed" as const,
    provider: "ERC20", hint: "0x1234…1234" }];
  expect(matchSourceStatus(source, identities, [source], statuses)).toBeUndefined();
});
