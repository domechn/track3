import { expect, it } from "vitest";
import { previewSourceNames, sourceDisplayNames } from "./source-display-name";

it("coin preview keeps three names and counts the hidden sources", () => {
  expect(previewSourceNames(["A very long wallet alias", "Binance", "Ledger cold wallet", "OKX"])).toEqual({
    visible: ["A very long wallet alias", "Binance", "Ledger cold wallet"],
    remaining: 1,
  });
  expect(previewSourceNames(Array.from({ length: 16 }, (_, index) => `Source ${index + 1}`))).toEqual({
    visible: ["Source 1", "Source 2", "Source 3"],
    remaining: 13,
  });
});

it("coin preview has no more count when every source is shown", () => {
  expect(previewSourceNames(["Binance", "OKX"])).toEqual({
    visible: ["Binance", "OKX"],
    remaining: 0,
  });
});

it("a ten digit opaque wallet id gets a readable source name", () => {
  expect(sourceDisplayNames([{ id: "5fe4052fcf", wallet: "5fe4052fcf" }])).toEqual(["Wallet 1"]);
});

it("keeps short hexadecimal user aliases unless they identify the wallet", () => {
  expect(sourceDisplayNames([
    { id: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", alias: "1234567890", type: "Binance" },
    { id: "cccccccccccccccccccccccccccccccc", alias: "deadbeefcafe", type: "Binance" },
    { id: "5fe4052fcf", wallet: "5fe4052fcf", alias: "5fe4052fcf" },
  ])).toEqual(["1234567890", "deadbeefcafe", "Wallet 1"]);
});

it("prefers user aliases and otherwise uses an exchange or chain name", () => {
  expect(sourceDisplayNames([
    { id: "one", alias: "Savings", type: "BTC" },
    { id: "two", type: "Binance" },
    { id: "three", alias: "Long term cold storage", type: "BTC" },
    { id: "four", alias: "Longtermcoldstorage", type: "BTC" },
  ])).toEqual(["Savings", "Binance", "Long term cold storage", "Longtermcoldstorage"]);
});

it("shortens only real addresses and numbers opaque ids in value order", () => {
  expect(sourceDisplayNames([
    { id: "0x4fa91c00000000000000000000000000a91c" },
    { id: "abcdef0123456789abcdef0123456789" },
    { id: "" },
    { id: undefined },
    { id: "opaque", alias: "1234560123456789abcdef0123456789" },
    { id: "bc1q9zp6g2zaj0sfxgzd7zdglj28hpgaffn8a4q9sd" },
  ])).toEqual(["0x4fa9…a91c", "Wallet 1", "Source 3", "Source 4", "opaque", "bc1q9z…q9sd"]);
});

it("disambiguates duplicate names while keeping each source identifiable", () => {
  expect(sourceDisplayNames([
    { id: "wallet-one", alias: "Savings" },
    { id: "wallet-two", alias: "Savings" },
    { id: "wallet-three", type: "Binance" },
    { id: "wallet-four", type: "Binance" },
  ])).toEqual(["Savings (1)", "Savings (2)", "Binance (1)", "Binance (2)"]);
});

it("keeps labels unique when opaque identifiers share their visible ends", () => {
  expect(sourceDisplayNames([
    { id: "abcdef1111111111111111111111aaaa", alias: "Savings" },
    { id: "abcdef2222222222222222222222aaaa", alias: "Savings" },
  ])).toEqual(["Savings (1)", "Savings (2)"]);
});

it("does not display placeholder metadata or a hash used as a type", () => {
  expect(sourceDisplayNames([
    { id: "abcdef0123456789abcdef0123456789", type: "null" },
    { id: "wallet-two", alias: "null", type: "Binance" },
    { id: "wallet-three", type: "1234560123456789abcdef0123456789" },
  ])).toEqual(["Wallet 1", "Binance", "wallet-three"]);
});

it("formats numbered wallet labels for the active language", () => {
  expect(sourceDisplayNames([
    { id: "abcdef0123456789abcdef0123456789" },
    { id: "1234560123456789abcdef0123456789" },
  ], (index) => `钱包 ${index}`)).toEqual(["钱包 1", "钱包 2"]);
});

it.each([
  ["SOL", "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH", "HN7cAB…YWrH"],
  ["TRC20", "TQ6nF7Y4iAqWb2s9xJ5pLhK8mR3vDcE1zB", "TQ6nF7…E1zB"],
  ["DOGE", "D7w9KzqYo2fU3jXa6rNs5tEc8bHm4pL1vQ", "D7w9Kz…L1vQ"],
  ["TON", "EQCGqjJ6rZt1kV8pL2sN3mW4aX5bY6cD7eF8gH9iJ0k", "EQCGqj…iJ0k"],
  ["BTC", "1BoatSLRHtKNngkdXEeobR76b53LETtpyT", "1BoatS…tpyT"],
] as const)("shortens an unaliased %s wallet address", (type, address, expected) => {
  expect(sourceDisplayNames([{ id: "abcdef0123456789abcdef0123456789", wallet: address, alias: address, type }]))
    .toEqual([expected]);
});

it("uses latest-snapshot ordinals for opaque ids regardless of the current list order", () => {
  const first = "abcdef0123456789abcdef0123456789";
  const second = "1234560123456789abcdef0123456789";
  expect(sourceDisplayNames([{ id: second }, { id: first }], undefined, { [first]: 1, [second]: 2 }))
    .toEqual(["Wallet 2", "Wallet 1"]);
});

it("numbers a past-only opaque id after current wallets without changing their names", () => {
  const current = "abcdef0123456789abcdef0123456789";
  const past = "1234560123456789abcdef0123456789";
  expect(sourceDisplayNames([{ id: past }, { id: current }], undefined, { [current]: 1 }))
    .toEqual(["Wallet 2", "Wallet 1"]);
});
