import { expect, it } from "vitest";
import { runningSourceStarts } from "./source-run-progress";

it("starts parallel sources together and chains only wallets of the same kind", () => {
  const sources = ["cex:0", "cex:1", "stock:0", "stock:1", "others", "btc:0", "btc:1", "erc20:0"]
    .map((sourceId) => ({ sourceId }));
  const startedAt = "2026-10-31T09:41:00.000Z";
  const finishedAt = "2026-10-31T09:41:03.000Z";
  expect(runningSourceStarts(sources, [], startedAt)).toEqual({
    "cex:0": startedAt, "cex:1": startedAt,
    "stock:0": startedAt, "stock:1": startedAt, others: startedAt,
    "btc:0": startedAt, "erc20:0": startedAt,
  });
  expect(runningSourceStarts(sources, [{
    sourceId: "btc:0", label: "Main", status: "ok", coins: [], walletIdentities: [], finishedAt,
  }], startedAt)).toEqual({
    "cex:0": startedAt, "cex:1": startedAt,
    "stock:0": startedAt, "stock:1": startedAt, others: startedAt,
    "btc:1": finishedAt, "erc20:0": startedAt,
  });
});
