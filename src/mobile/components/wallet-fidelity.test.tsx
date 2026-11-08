import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import md5 from "md5";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { getConfiguration } from "@/middlelayers/configuration";
import { configurationFromForm } from "@/middlelayers/ui-state/config-form";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import { writeStoredStatuses } from "@/middlelayers/ui-state/source-status-store";
import WalletFidelity from "./wallet-fidelity";

vi.mock("@/middlelayers/charts", () => ({ queryHistoricalPage: vi.fn() }));
vi.mock("@/middlelayers/entities/assets", () => ({ ASSET_HANDLER: { listAssetsByUUIDs: vi.fn() } }));
vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }));

afterEach(() => {
  vi.restoreAllMocks();
  writeStoredStatuses([]);
});

it("shows failed exchange and broker statuses on mobile Wallets with real source identities", async () => {
  const alphaId = md5("binance-alpha-key-1234");
  const betaId = md5("binance-beta-key-5678");
  const brokerId = md5("ibkr:query-id");
  vi.mocked(getConfiguration).mockResolvedValue(configurationFromForm({
    exchanges: [
      { type: "binance", alias: "Savings", apiKey: "alpha-key-1234", secret: "", active: true },
      { type: "binance", alias: "Trading", apiKey: "beta-key-5678", secret: "", active: true },
    ],
    wallets: [], stockBrokers: [{ type: "ibkr", alias: "Brokerage",
      queryId: "query-id", token: "", active: true }], others: [], groupUSD: false, hideInactive: false,
  }));
  vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue({
    [alphaId]: { wallet: `binance-${alphaId.slice(0, 8)}`, alias: "Savings", type: "binance" },
    [betaId]: { wallet: `binance-${betaId.slice(0, 8)}`, alias: "Trading", type: "binance" },
    [brokerId]: { wallet: `ibkr-${brokerId.slice(0, 8)}`, alias: "Brokerage", type: "ibkr" },
  });
  vi.mocked(queryHistoricalPage).mockImplementation(async (range) => ({
    rows: range.end.getTime() < Date.parse("2026-10-15T00:00:00Z")
      ? [{ id: "base", createdAt: "2026-10-01T09:41:00Z", total: 120 }]
      : [{ id: "latest", createdAt: "2026-10-31T09:41:00Z", total: 150 }],
  } as never));
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue([
    { id: 1, uuid: "latest", wallet: alphaId, assetType: "crypto", symbol: "BTC", amount: 1, value: 100 },
    { id: 2, uuid: "latest", wallet: betaId, assetType: "crypto", symbol: "ETH", amount: 1, value: 50 },
    { id: 3, uuid: "latest", wallet: brokerId, assetType: "stock", symbol: "AAPL", amount: 1, value: 30 },
  ] as never);
  writeStoredStatuses([
    { sourceId: "cex:0", label: "Old savings", kind: "exchange", provider: "Binance",
      hint: "alph…1234", status: "ok" },
    { sourceId: "cex:1", label: "Old trading", kind: "exchange", provider: "Binance",
      hint: "beta…5678", status: "failed" },
    { sourceId: "stock:0", label: "Old broker", kind: "broker", provider: "Interactive Brokers",
      hint: "#1", status: "failed" },
  ]);

  const { container } = render(<WalletFidelity
    currency={{ currency: "USD", rate: 1, alias: "USD", symbol: "$" }}
    dateRange={{ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2026-10-31T00:00:00Z") }}
    quoteColor="green-up-red-down" />);
  await waitFor(() => {
    const rows = container.querySelectorAll(".fd-wallet-status-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).not.toHaveTextContent("Retry");
    expect(rows[1]).toHaveTextContent("Trading");
    expect(rows[1]).toHaveTextContent("Retry");
    expect(rows[2]).toHaveTextContent("Brokerage");
    expect(rows[2]).toHaveTextContent("Retry");
  });
  fireEvent.click(await screen.findByRole("button", { name: "Trading" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Trading");
});
