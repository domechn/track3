import { expect, it, vi } from "vitest";
import { readSnapshot } from "./snapshot";
import { snapshotContent } from "./sync/engine";

let hasMarker = true;
const select = vi.fn(async (sql: string) => {
  if (sql.includes("snapshot_partial")) return hasMarker ? [{
    sources_total: 2, missing: '[{"wallet":"ddf7fe606e048ac89f8a8c62bf23c4be","kind":"exchange","provider":"OKX","category":"network"}]',
    fill: "last_known", created_at: "2024-04-16T13:00:00.000Z",
  }] : [];
  return [];
});

it("omits the field for a complete snapshot", async () => {
  hasMarker = false;
  expect(await readSnapshot("two")).toEqual({ uuid: "two", assets: [], prices: [], transactions: [] });
  hasMarker = true;
});
vi.mock("./database", () => ({ getDatabase: async () => ({ select }) }));

it("carries the optional marker outside the immutable snapshot rows", async () => {
  const snapshot = await readSnapshot("one");
  expect(snapshot).toEqual({
    uuid: "one", assets: [], prices: [], transactions: [],
    partial: {
      sourcesTotal: 2,
      missing: [{ wallet: "ddf7fe606e048ac89f8a8c62bf23c4be", kind: "exchange", provider: "OKX", category: "network" }],
      fill: "last_known", createdAt: "2024-04-16T13:00:00.000Z",
    },
  });
  const { partial: _partial, ...withoutPartial } = snapshot;
  expect(snapshotContent(snapshot)).toBe(snapshotContent(withoutPartial));
});
