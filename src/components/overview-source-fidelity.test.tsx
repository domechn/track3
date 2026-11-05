import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { SourceStatusCard } from "./overview-panels";
import { overviewRefreshRequestedEvent } from "./source-status-event";

it("shows stored source balances and shares without adding fields to status records", () => {
  let requested = 0;
  window.addEventListener(overviewRefreshRequestedEvent, () => { requested += 1; }, { once: true });
  render(<SourceStatusCard variant="card" desktopFidelity
    currency={{ currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" }}
    statuses={[
      { sourceId: "cex:0", label: "Binance", status: "ok", kind: "exchange", provider: "binance", finishedAt: "2026-10-31T09:41:00Z" },
    ]}
    sources={[
      { wallet: "Binance", walletAlias: "Binance", walletType: "binance", amount: 2, value: 358418.17, percentage: 46.9, chartColor: "" },
    ]} />);
  const card = screen.getByText("Sources").closest(".t3-sources-panel") as HTMLElement;
  expect(card).toHaveTextContent("$358,418.17");
  expect(card).toHaveTextContent("46.9%");
  expect(card).toHaveTextContent("Exchange");
  expect(card).toHaveTextContent("09:41");
  expect(card).toHaveTextContent("1 of 1 up to date");
  expect(card.querySelector(".t3-source-logo")).toHaveTextContent("BN");
  fireEvent.click(screen.getByRole("button", { name: "Refresh all" }));
  expect(requested).toBe(1);
});

it("matches an unaliased wallet status by its address hint", () => {
  const address = "HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH";
  render(<SourceStatusCard variant="card" desktopFidelity
    currency={{ currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" }}
    statuses={[{ sourceId: "sol:0", label: "SOL wallet 1", status: "ok", kind: "wallet",
      provider: "SOL", hint: "HN7cAB…YWrH", finishedAt: "2026-10-31T09:41:00Z" }]}
    sources={[{ wallet: address, walletAlias: address, walletType: "SOL",
      amount: 1, value: 42, percentage: 100, chartColor: "" }]} />);
  const row = screen.getByText("HN7cAB…YWrH").closest(".t3-source-row") as HTMLElement;
  expect(row).toHaveTextContent("Updated");
  expect(row).toHaveTextContent("09:41");
});

it("shows the stored last good value and offers retry for a failed source", () => {
  render(<SourceStatusCard variant="card" desktopFidelity
    currency={{ currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" }}
    statuses={[{ sourceId: "ibkr:0", label: "Interactive Brokers", status: "failed",
      kind: "broker", provider: "ibkr", lastSuccessAt: "2026-10-31T08:12:00Z",
      detail: "Source timed out" }]}
    sources={[{ wallet: "Interactive Brokers", walletAlias: "Interactive Brokers", walletType: "ibkr",
      amount: 1, value: 65555.5, percentage: 8.6, chartColor: "" }]} />);
  const card = screen.getByText("Sources").closest(".t3-sources-panel") as HTMLElement;
  expect(card).toHaveTextContent("Interactive Brokers did not refresh");
  expect(card).toHaveTextContent("Source timed out. Its value ($65,555.50) is from the last good refresh at 08:12.");
  expect(card).toHaveTextContent("Failed · last good 08:12");
  const failedRow = card.querySelector(".t3-source-row") as HTMLElement;
  expect(failedRow.querySelectorAll(".t3-source-name small")).toHaveLength(2);
  expect(failedRow.querySelector(".t3-source-name small:first-of-type")).toHaveTextContent("Broker");
  expect(failedRow.querySelector(".t3-source-name small:last-of-type")).toHaveTextContent("Failed · last good 08:12");
  expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
});

it("shows a quota source as quota limited and offers its plan action without retry", () => {
  render(<SourceStatusCard variant="card" desktopFidelity
    currency={{ currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" }}
    statuses={[{ sourceId: "erc20:0", label: "0x4f…a91c", status: "failed",
      kind: "wallet", category: "quota", lastSuccessAt: "2026-10-30T21:14:00Z" }]}
    sources={[{ wallet: "0x4f…a91c", walletAlias: "0x4f…a91c", walletType: "erc20",
      amount: 1, value: 67437.9, percentage: 8.9, chartColor: "" }]} />);
  const card = screen.getByText("Sources").closest(".t3-sources-panel") as HTMLElement;
  expect(card).toHaveTextContent("Quota used · last good 21:14");
  expect(card.querySelector(".t3-source-banner")).toBeNull();
  expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Manage plan" })).not.toBeInTheDocument();
});

it("shows the completed source count in Chinese when one source failed", () => {
  const storedLocale = vi.spyOn(Storage.prototype, "getItem").mockReturnValue(null);
  const browserLocale = vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
  try {
    render(<I18nProvider><SourceStatusCard variant="card" desktopFidelity
      currency={{ currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" }}
      statuses={[
        { sourceId: "cex:0", label: "Binance", status: "ok", kind: "exchange", provider: "binance" },
        { sourceId: "cex:1", label: "OKX", status: "failed", kind: "exchange", provider: "okx" },
      ]}
      sources={[
        { wallet: "Binance", walletAlias: "Binance", walletType: "binance", amount: 2, value: 100, percentage: 50, chartColor: "" },
        { wallet: "OKX", walletAlias: "OKX", walletType: "okx", amount: 2, value: 100, percentage: 50, chartColor: "" },
      ]} /></I18nProvider>);
    expect(screen.getByText("2 个来源中有 1 个已更新")).toBeVisible();
    expect(screen.queryByText(/\{count\}/)).toBeNull();
  } finally {
    browserLocale.mockRestore();
    storedLocale.mockRestore();
  }
});

it("keeps the shared source card's existing presentation unless desktop fidelity is requested", () => {
  render(<SourceStatusCard variant="card" statuses={[
    { sourceId: "cex:0", label: "Binance", status: "ok", provider: "binance" },
  ]} />);
  const card = screen.getByText("Sources").closest(".t3-sources-panel") as HTMLElement;
  expect(card).toHaveTextContent("1 sources");
  expect(card).toHaveTextContent("binance");
  expect(screen.queryByRole("button", { name: "Refresh all" })).not.toBeInTheDocument();
});
