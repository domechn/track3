import { expect, it } from "vitest";
import { matchSourceStatus } from "./source-status-match";

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

it("uses a sole matching exchange or broker provider without assigning ambiguous duplicates", () => {
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
  expect(matchSourceStatus(sources[0], { ...identities, [ids[1]]: identities[ids[0]] }, sources, statuses)?.sourceId).toBeUndefined();
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
