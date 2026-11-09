import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import WalletsFidelity from "./wallets-fidelity";
import { overviewRefreshRequestedEvent } from "./source-status-event";

vi.mock("@/middlelayers/charts", () => ({ queryHistoricalPage: vi.fn() }));
vi.mock("@/middlelayers/entities/assets", () => ({ ASSET_HANDLER: { listAssetsByUUIDs: vi.fn() } }));

const currency = { currency: "USD", alias: "usd", symbol: "$", rate: 1 };
const dateRange = { start: new Date("2026-10-01T23:00:00Z"), end: new Date("2026-10-31T23:00:00Z") };
const asset = (uuid: string, wallet: string, value: number) => ({
  id: uuid === "new" ? 2 : 1, uuid, wallet, createdAt: uuid === "new" ? "2026-10-31T09:41:00Z" : "2026-10-01T09:41:00Z",
  assetType: "crypto", symbol: "ETH", amount: 1, price: value, value,
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.mocked(queryHistoricalPage).mockReset().mockResolvedValueOnce({ rows: [{ id: "new", createdAt: "2026-10-31T09:41:00Z" }] } as never)
    .mockResolvedValueOnce({ rows: [{ id: "old", createdAt: "2026-10-01T09:41:00Z" }] } as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockReset().mockResolvedValue([
    asset("old", "Binance", 100), asset("old", "OKX", 50),
    asset("new", "Binance", 120), asset("new", "OKX", 60),
  ] as never);
});

describe("WalletsFidelity", () => {
  it("exposes the source status list as a keyboard scroll region", async () => {
    render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    const region = await screen.findByRole("region", { name: "Source status" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region).toHaveClass("t3-wallet-status-list");
  });
  it("uses a muted change line under total value", async () => {
    const { container } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelector(".t3-wallet-kpis small b")).toBeInTheDocument());
    expect(container.querySelector(".t3-wallet-kpis small b")).not.toHaveClass("pos");
  });

  it("keeps the last good failed source visible and sends Retry through the existing refresh event", async () => {
    const onSelectSource = vi.fn();
    const onRequest = vi.fn();
    window.addEventListener(overviewRefreshRequestedEvent, onRequest);
    try {
      const { rerender } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
        quoteColor="green-up-red-down" selectedSource={null} onSelectSource={onSelectSource}
        statuses={[{ sourceId: "okx-id", label: "OKX", status: "failed", kind: "exchange",
          lastSuccessAt: "2026-10-31T09:12:00Z", finishedAt: "2026-10-31T09:41:00Z" }]} />);
      await waitFor(() => expect(screen.getByRole("button", { name: "OKX" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "OKX" }));
      expect(onSelectSource).toHaveBeenCalledWith("OKX");
      rerender(<WalletsFidelity currency={currency} dateRange={dateRange}
        quoteColor="green-up-red-down" selectedSource="OKX" onSelectSource={onSelectSource}
        statuses={[{ sourceId: "okx-id", label: "OKX", status: "failed", kind: "exchange",
          lastSuccessAt: "2026-10-31T09:12:00Z", finishedAt: "2026-10-31T09:41:00Z" }]} />);
      expect(screen.getAllByText("$60.00").length).toBeGreaterThan(0);
      expect(screen.getByRole("alert")).toHaveTextContent("09:12");
      fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
      expect(onRequest).toHaveBeenCalledTimes(1);
      expect((onRequest.mock.calls[0][0] as CustomEvent).detail.sourceId).toBe("okx-id");
    } finally {
      window.removeEventListener(overviewRefreshRequestedEvent, onRequest);
    }
  });
});
