import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { SourceDesign } from "./source-design";

const statusState = vi.hoisted(() => ({ statuses: [] as PortfolioSourceStatus[] }));
vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => [{
  id: "latest", createdAt: "2026-10-31T09:41:00.000Z",
  assets: [
    { wallet: "27ed7789cdb2445dce9575a26a2385c0", symbol: "BTC", amount: 1, value: 100, price: 100 },
    { wallet: "27ed7789cdb2445dce9575a26a2385c0", symbol: "ETH", amount: 2, value: 40, price: 20 },
  ],
}]) }));
vi.mock("@/middlelayers/license", () => ({
  LicenseCenter: { getInstance: () => ({ getUsage: async () => undefined }) },
}));
vi.mock("@/middlelayers/ui-state/source-status-store", () => ({ readStoredStatuses: () => statusState.statuses }));

afterEach(() => { statusState.statuses = []; });

it("shows a source value from the latest snapshot's holdings", async () => {
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[{ type: "binance", apiKey: "sample", secret: "sample", active: true }]}
    wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect(await screen.findAllByText("$140.00")).toHaveLength(2);
  expect(queryHistoricalData).toHaveBeenCalledWith(1, false, { includeTransactions: false });
});

it("renames the visible source while keeping its snapshot holding", async () => {
  const noop = vi.fn();
  const rename = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[{ type: "binance", alias: "Main", apiKey: "sample", secret: "sample", active: true }]}
    wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onExchangeRename={rename}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect(await screen.findAllByText("$140.00")).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Rename Main" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Vault" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(rename).toHaveBeenCalledWith("binance", "sample", "Vault");
  expect(await screen.findAllByText("$140.00")).toHaveLength(2);
  const edit = screen.getAllByRole("button", { name: "Edit Main" })[0];
  expect(edit).toContainElement(screen.getByTitle("Main"));
  expect(screen.getAllByRole("button", { name: "Edit Main" })).toHaveLength(1);
  fireEvent.click(edit);
  expect(document.querySelector(".t3-fidelity-source-page")).toHaveAttribute("data-editor-open", "true");
});

it("opens the custom editor from the visible symbol", () => {
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="custom" setTab={noop}
    exchanges={[]} wallets={[]} brokers={[]} others={[{ symbol: "GOLD", amount: 2 }]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  const edit = screen.getAllByRole("button", { name: "Edit GOLD" })[0];
  expect(edit).toContainElement(screen.getByText("GOLD"));
  expect(screen.getByText("1 custom asset")).toBeVisible();
  fireEvent.click(edit);
  expect(document.querySelector(".t3-fidelity-source-page")).toHaveAttribute("data-editor-open", "true");
});

it("keeps a saved status with the active wallet when an earlier wallet is paused", async () => {
  statusState.statuses = [{ sourceId: "btc:0", label: "Active", provider: "BTC",
    hint: "active…1234", status: "stale" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="wallets" setTab={noop}
    exchanges={[]} wallets={[
      { type: "btc", address: "paused-address", alias: "Paused", active: false },
      { type: "btc", address: "active-address-1234", alias: "Active", active: true },
    ]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect((await screen.findByTitle("Active")).closest(".t3-fidelity-source-row")).toHaveClass("error");
  expect(screen.getByTitle("Paused").closest(".t3-fidelity-source-row")).not.toHaveClass("error");
});

it("does not show a paused exchange's failure on the next active exchange", async () => {
  statusState.statuses = [{ sourceId: "cex:0", label: "Main", provider: "Binance", hint: "main…1234",
    status: "failed", lastSuccessAt: "2026-10-30T09:41:00.000Z" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[
      { type: "binance", alias: "Main", apiKey: "main-key-1234", secret: "", active: false },
      { type: "okex", alias: "Trading", apiKey: "trading-key-5678", secret: "", active: true },
    ]} wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  const paused = (await screen.findByTitle("Main")).closest(".t3-fidelity-source-row");
  const active = screen.getByTitle("Trading").closest(".t3-fidelity-source-row");
  expect(active).not.toHaveClass("error");
  expect(paused).toHaveTextContent("30 Oct, 09:41");
});

it("shows a paused exchange's stored last-success date when its provider is unique", async () => {
  statusState.statuses = [{ sourceId: "cex:2", label: "Kraken", kind: "exchange",
    provider: "Kraken", status: "ok", lastSuccessAt: "2026-10-12T18:05:00.000Z" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[{ type: "kraken", alias: "Kraken", apiKey: "sample-kraken-key", secret: "", active: false }]}
    wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect((await screen.findByTitle("Kraken")).closest(".t3-fidelity-source-row"))
    .toHaveTextContent("12 Oct, 18:05");
});

it("does not claim a paused broker's saved status from its numbered hint", async () => {
  statusState.statuses = [{ sourceId: "stock:0", label: "Retirement", kind: "broker",
    provider: "Interactive Brokers", hint: "#1", status: "ok",
    lastSuccessAt: "2026-10-30T09:41:00.000Z" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="brokers" setTab={noop}
    exchanges={[]} wallets={[]} brokers={[{
      type: "ibkr", alias: "Retirement", queryId: "query-1234", token: "", active: false,
    }]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect((await screen.findByTitle("Retirement")).closest(".t3-fidelity-source-row"))
    .not.toHaveTextContent("30 Oct, 09:41");
});

it("shows a current broker's numbered failure beside its renamed source", async () => {
  statusState.statuses = [{ sourceId: "stock:0", label: "Old", kind: "broker",
    provider: "Interactive Brokers", hint: "#1", status: "failed",
    detail: "Source timed out" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="brokers" setTab={noop}
    exchanges={[]} wallets={[]} brokers={[{
      type: "ibkr", alias: "Retirement", queryId: "query-1234", token: "", active: true,
    }]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect((await screen.findByTitle("Retirement")).closest(".t3-fidelity-source-row"))
    .toHaveTextContent("Source timed out");
});

it("previews a wallet alias against exchange names on the same source page", async () => {
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="wallets" setTab={noop}
    exchanges={[{ type: "binance", alias: "Main", apiKey: "sample-key-1234", secret: "", active: true }]}
    wallets={[{ type: "btc", alias: "Cold", address: "bc1q-demo-cold-storage", active: true }]}
    brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  fireEvent.click(await screen.findByRole("button", { name: "Rename Cold" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Main" } });
  expect(screen.getByRole("dialog")).toHaveTextContent("Shown elsewhere as Main (2)");
});

it("does not assign a legacy stale status when two sources share the same masked hint", async () => {
  statusState.statuses = [{ sourceId: "cex:0", label: "Main", kind: "exchange",
    provider: "Binance", hint: "abcd…1234", status: "stale" }];
  const noop = vi.fn();
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={[
      { type: "binance", alias: "Main", apiKey: "abcd-first-1234", secret: "", active: true },
      { type: "binance", alias: "Other", apiKey: "abcd-second-1234", secret: "", active: true },
    ]} wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  expect((await screen.findByTitle("Main")).closest(".t3-fidelity-source-row")).not.toHaveClass("error");
  expect(screen.getByTitle("Other").closest(".t3-fidelity-source-row")).not.toHaveClass("error");
  expect(screen.queryByText(/Main value as of/)).not.toBeInTheDocument();
});

it("keeps a later page's status and rename attached to its original exchange", async () => {
  statusState.statuses = [{ sourceId: "cex:8", label: "Ninth", kind: "exchange",
    provider: "Kraken", hint: "krak…0009", status: "failed", detail: "Latest failed" }];
  const noop = vi.fn();
  const rename = vi.fn();
  const exchanges = [
    ...Array.from({ length: 8 }, (_, index) => ({
      type: "binance", alias: `Source ${index + 1}`, apiKey: `binance-test-000${index}`,
      secret: "", active: true,
    })),
    { type: "kraken", alias: "Ninth", apiKey: "krak-sample-0009", secret: "", active: true },
  ];
  render(<SourceDesign loading={false} tab="exchanges" setTab={noop}
    exchanges={exchanges} wallets={[]} brokers={[]} others={[]}
    onExchangeToggle={noop} onWalletToggle={noop} onBrokerToggle={noop}
    onExchangeRemove={noop} onWalletRemove={noop} onBrokerRemove={noop} onOtherRemove={noop} onOtherAttach={noop}
    onExchangeQuickLook={noop} onWalletQuickLook={noop} onBrokerQuickLook={noop}
    onExchangeRename={rename}
    onSaveExchange={async () => true} onSaveWallet={async () => true}
    onSaveBroker={async () => true} onSaveCustom={() => true} />);
  await screen.findByTitle("Source 1");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  const row = screen.getByTitle("Ninth").closest(".t3-fidelity-source-row");
  expect(row).toHaveClass("error");
  expect(row).toHaveTextContent("Latest failed");
  fireEvent.click(screen.getByRole("button", { name: "Rename Ninth" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Alias" }), { target: { value: "Vault" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(rename).toHaveBeenCalledWith("kraken", "krak-sample-0009", "Vault");
});
