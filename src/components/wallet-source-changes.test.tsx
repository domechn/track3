import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import WalletSourceChanges from "./wallet-source-changes";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";

vi.mock("@/middlelayers/charts", () => ({ queryHistoricalPage: vi.fn() }));
vi.mock("@/middlelayers/entities/assets", () => ({ ASSET_HANDLER: { listAssetsByUUIDs: vi.fn() } }));
vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    listWalletAliases() {
      return Promise.resolve({ source: { wallet: "source", alias: "Other assets", type: "Others" } });
    }
  },
}));
vi.mock("@/contexts/data-changed", () => ({ useDataChangedVersion: () => 0 }));
vi.mock("./source-name-order", () => {
  const ordinals = {};
  return { useLatestWalletOrdinals: () => ordinals };
});

it("marks an Others source as custom in source changes", async () => {
  vi.mocked(queryHistoricalPage)
    .mockResolvedValueOnce({ rows: [{ id: "latest", createdAt: "2026-10-31T00:00:00Z" }] } as never)
    .mockResolvedValueOnce({ rows: [{ id: "base", createdAt: "2026-10-01T00:00:00Z" }] } as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
    { uuid: "base", wallet: "source", symbol: "BTC", assetType: "crypto", value: 10 },
    { uuid: "latest", wallet: "source", symbol: "BTC", assetType: "crypto", value: 20 },
  ] as never);
  render(<WalletSourceChanges currency={{ currency: "USD", alias: "usd", symbol: "$", rate: 1 }}
    dateRange={{ start: new Date(0), end: new Date("2026-10-31T00:00:00Z") }}
    quoteColor="green-up-red-down" selectedSource={null} />);
  const label = (await screen.findAllByText("Other assets"))[0];
  expect(label.closest(".t3-asset-label")?.querySelector(".t3-asset-icon")).toHaveAttribute("data-kind", "custom");
});
