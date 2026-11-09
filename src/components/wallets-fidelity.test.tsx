import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryHistoricalPage } from "@/middlelayers/charts";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { WalletAnalyzer } from "@/middlelayers/wallet";
import md5 from "md5";
import WalletsFidelity from "./wallets-fidelity";
import { overviewRefreshRequestedEvent } from "./source-status-event";

vi.mock("@/middlelayers/charts", () => ({ queryHistoricalPage: vi.fn() }));
vi.mock("@/middlelayers/entities/assets", () => ({ ASSET_HANDLER: { listAssetsByUUIDs: vi.fn() } }));

const currency = { currency: "USD", alias: "usd", symbol: "$", rate: 1 };
const dateRange = { start: new Date("2026-10-01T23:00:00Z"), end: new Date("2026-10-31T23:00:00Z") };
const binanceId = md5("binance-demo-key");
const okxId = md5("okex-demo-key");
const asset = (uuid: string, wallet: string, value: number) => ({
  id: uuid === "new" ? 2 : 1, uuid, wallet, createdAt: uuid === "new" ? "2026-10-31T09:41:00Z" : "2026-10-01T09:41:00Z",
  assetType: "crypto", symbol: "ETH", amount: 1, price: value, value,
});

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  vi.mocked(queryHistoricalPage).mockReset().mockResolvedValueOnce({ rows: [{ id: "new", createdAt: "2026-10-31T09:41:00Z" }] } as never)
    .mockResolvedValueOnce({ rows: [{ id: "old", createdAt: "2026-10-01T09:41:00Z" }] } as never);
  vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockReset().mockResolvedValue([
    asset("old", binanceId, 100), asset("old", okxId, 50),
    asset("new", binanceId, 120), asset("new", okxId, 60),
  ] as never);
  vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue({
    [binanceId]: { wallet: `binance-${binanceId.slice(0, 8)}`, alias: "Binance", type: "binance" },
    [okxId]: { wallet: `okex-${okxId.slice(0, 8)}`, alias: "OKX", type: "okex" },
  });
});

describe("WalletsFidelity", () => {
  it("shows the exact mover amount over its bar", async () => {
    const { container } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelector(".t3-wallet-mover-track")).toBeInTheDocument());
    fireEvent.pointerEnter(container.querySelector(".t3-wallet-mover-track")!);
    expect(screen.getByRole("tooltip")).toHaveTextContent("+$30.00");
  });

  it("shows exact source value and share when a split segment is hovered", async () => {
    const { container } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelector(".t3-wallet-split i")).toBeInTheDocument());
    expect(container.querySelector(".t3-wallet-split i")).toHaveAttribute("role", "button");
    fireEvent.pointerEnter(container.querySelector(".t3-wallet-split i")!, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("$120.00");
    expect(screen.getByRole("tooltip")).toHaveTextContent("66.67%");
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
        statuses={[{ sourceId: "cex:1", label: "Old OKX", status: "failed", kind: "exchange", provider: "OKX", hint: "demo…-key",
          lastSuccessAt: "2026-10-31T09:12:00Z", finishedAt: "2026-10-31T09:41:00Z" }]} />);
      await waitFor(() => expect(screen.getByRole("button", { name: "OKX" })).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: "OKX" }));
      expect(onSelectSource).toHaveBeenCalledWith(okxId);
      rerender(<WalletsFidelity currency={currency} dateRange={dateRange}
        quoteColor="green-up-red-down" selectedSource={okxId} onSelectSource={onSelectSource}
        statuses={[{ sourceId: "cex:1", label: "Old OKX", status: "failed", kind: "exchange", provider: "OKX", hint: "demo…-key",
          lastSuccessAt: "2026-10-31T09:12:00Z", finishedAt: "2026-10-31T09:41:00Z" }]} />);
      expect(screen.getAllByText("$60.00").length).toBeGreaterThan(0);
      expect(screen.getByRole("alert")).toHaveTextContent("09:12");
      fireEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]);
      expect(onRequest).toHaveBeenCalledTimes(1);
      expect((onRequest.mock.calls[0][0] as CustomEvent).detail.sourceId).toBe("cex:1");
    } finally {
      window.removeEventListener(overviewRefreshRequestedEvent, onRequest);
    }
  });

  it("pages dense source chips, balances and asset matrix independently", async () => {
    const wallets = Array.from({ length: 16 }, (_, index) => `wallet-${index + 1}`);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue(wallets.flatMap((wallet, index) => [
      { ...asset("old", wallet, index + 1), symbol: `COIN${index + 1}` },
      { ...asset("new", wallet, index + 2), symbol: `COIN${index + 1}` },
    ]) as never);
    vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue(
      Object.fromEntries(wallets.map((wallet) => [wallet, { wallet, alias: wallet, type: "bitcoin" }])) as never);
    const { container } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelectorAll(".t3-wallet-balances tbody tr")).toHaveLength(8));
    expect(container.querySelectorAll(".t3-wallet-chips button")).toHaveLength(9);
    expect(container.querySelectorAll(".t3-wallet-matrix tbody tr")).toHaveLength(8);
    expect(container.querySelectorAll(".t3-wallet-matrix thead th")).toHaveLength(7);
    const firstChip = container.querySelectorAll(".t3-wallet-chips button")[1].textContent;
    const firstBalance = container.querySelector(".t3-wallet-balances tbody tr")?.textContent;
    fireEvent.click(container.querySelector<HTMLButtonElement>(".t3-wallet-balances [data-layout-pager] button:not(:disabled):last-child")!);
    expect(container.querySelector(".t3-wallet-balances tbody tr")?.textContent).not.toBe(firstBalance);
    expect(container.querySelectorAll(".t3-wallet-chips button")[1].textContent).toBe(firstChip);
  });

  it("shows a selected source on a later chip page and names both matrix pagers", async () => {
    const wallets = Array.from({ length: 16 }, (_, index) => `wallet-${index + 1}`);
    vi.mocked(ASSET_HANDLER.listAssetsByUUIDs).mockResolvedValue(wallets.flatMap((wallet, index) => [
      { ...asset("old", wallet, index + 1), symbol: `COIN${index + 1}` },
      { ...asset("new", wallet, index + 2), symbol: `COIN${index + 1}` },
    ]) as never);
    vi.spyOn(WalletAnalyzer.prototype, "listWalletAliases").mockResolvedValue(
      Object.fromEntries(wallets.map((wallet) => [wallet, { wallet, alias: wallet, type: "bitcoin" }])) as never);
    const { container, rerender } = render(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource={null} onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelectorAll(".t3-wallet-matrix [data-layout-pager]")).toHaveLength(2));
    const matrixPagers = container.querySelectorAll(".t3-wallet-matrix [data-layout-pager]");
    expect(matrixPagers[0]).toHaveTextContent("Assets");
    expect(matrixPagers[1]).toHaveTextContent("Sources");
    rerender(<WalletsFidelity currency={currency} dateRange={dateRange}
      quoteColor="green-up-red-down" selectedSource="wallet-12" onSelectSource={vi.fn()} statuses={[]} />);
    await waitFor(() => expect(container.querySelector(".t3-wallet-chips button[aria-pressed='true']"))
      .toHaveTextContent("wallet-12"));
  });
});
