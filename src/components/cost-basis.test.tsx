import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import CostBasisPage from "./cost-basis";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { exportCostBasisReport, loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import { COST_BASIS_SETTINGS_KEY } from "@/middlelayers/ai/actions/page-settings";
import { readCostBasisSettings, setCostBasisSettingsFromPage } from "@/middlelayers/ui-state/page-prefs";
import { TRANSACTION_HANDLER } from "@/middlelayers/entities/transactions";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { buildCostBasisViewReport } from "./cost-basis-view-data";
import { Toaster } from "./ui/toaster";
import axe from "axe-core";

vi.mock("@/middlelayers/configuration", () => ({
  getCostBasisMethod: vi.fn(), saveCostBasisMethod: vi.fn(),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));
vi.mock("@/middlelayers/cost-basis-data", () => ({
  loadCostBasisReport: vi.fn(), exportCostBasisReport: vi.fn(),
}));
vi.mock("@/middlelayers/entities/transactions", () => ({
  TRANSACTION_HANDLER: { listTransactions: vi.fn() },
}));
vi.mock("@/middlelayers/entities/assets", () => ({
  ASSET_HANDLER: { listAssets: vi.fn() },
}));
vi.mock("./cost-basis-view-data", () => ({
  buildCostBasisViewReport: vi.fn(),
}));
vi.mock("react-chartjs-2", () => ({
  Bar: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Line: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
  Doughnut: (props: { "aria-label": string }) => <div role="img" aria-label={props["aria-label"]} />,
}));

const report = {
  method: "FIFO",
  disposals: [{ eventId: "sale", lotId: "buy", assetType: "crypto", symbol: "BTC", acquiredAt: "2024-01-01", disposedAt: "2025-01-01", amount: 1, proceeds: 200, costBasis: 100, gainLoss: 100, term: "long", method: "FIFO" }],
  openLots: [], unrealized: [],
  warnings: [{ code: "missing-lots", eventId: "gap", assetType: "crypto", symbol: "ETH", amount: 2 }],
  assets: [{ assetType: "crypto", symbol: "BTC", proceeds: 200, costBasis: 100, gainLoss: 100 }],
  totals: { proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 0, longTerm: 100 },
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(COST_BASIS_SETTINGS_KEY);
  vi.mocked(getCostBasisMethod).mockResolvedValue("FIFO");
  vi.mocked(loadCostBasisReport).mockResolvedValue(report as never);
  vi.mocked(buildCostBasisViewReport).mockImplementation((_transactions, _assets, options) => loadCostBasisReport(options));
  vi.mocked(exportCostBasisReport).mockResolvedValue(true);
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([]);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([]);
});

it("shows realized totals and data gaps from the loaded report", async () => {
  render(<CostBasisPage />);
  expect((await screen.findAllByText("BTC"))[0]).toBeInTheDocument();
  expect(screen.getByRole("table", { name: "Data gaps to review" })).toHaveTextContent("ETH");
  expect(screen.getByRole("table", { name: "Data gaps to review" })).toHaveTextContent("Missing lots");
  expect(screen.getByRole("table", { name: "Data gaps to review" }).querySelectorAll(".fidelity-gap-group")).toHaveLength(1);
  expect(screen.getByRole("button", { name: /^Export$/ })).toBeInTheDocument();
  const totals = document.querySelector(".fidelity-cost-kpi-secondary")!;
  expect(totals.children[0]).toHaveTextContent("Sale proceeds$200.00");
  expect(totals.children[1]).toHaveTextContent("Cost of sold lots$100.00");
});

it("keeps the asset chart in the Tab order after focusing a holding period", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const holdingMarks = document.querySelectorAll<HTMLElement>(".fidelity-cost-holding [data-chart-mark]");
  const assetMark = document.querySelector<HTMLElement>(".fidelity-cost-chart [data-chart-mark]")!;
  expect(holdingMarks).toHaveLength(2);
  holdingMarks[1].focus();
  expect(assetMark).toHaveAttribute("tabindex", "0");
});

it("shows a load error instead of a report without current holdings prices", async () => {
  vi.mocked(ASSET_HANDLER.listAssets).mockRejectedValueOnce(new Error("holdings unavailable"));
  render(<><CostBasisPage /><Toaster /></>);
  await waitFor(() => expect(screen.getByText("Could not load cost basis report.")).toBeInTheDocument());
  expect(screen.queryByTestId("cost-desktop-table")).not.toBeInTheDocument();
  expect(loadCostBasisReport).not.toHaveBeenCalled();
});

it("shows an anniversary sale as short term through the default page report", async () => {
  localStorage.setItem(COST_BASIS_SETTINGS_KEY, JSON.stringify({ from: "2024-01-01", to: "2024-12-31" }));
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "buy", amount: 1, price: 100, txnCreatedAt: "2023-01-01T08:00:00Z" },
    { id: 2, uuid: "sell", assetType: "crypto", symbol: "BTC", wallet: "w", txnType: "sell", amount: 1, price: 200, txnCreatedAt: "2024-01-01T09:00:00Z" },
  ] as never);
  vi.mocked(ASSET_HANDLER.listAssets).mockResolvedValue([]);
  vi.mocked(loadCostBasisReport).mockImplementation(async (options) => {
    const actual = await vi.importActual<typeof import("@/middlelayers/cost-basis-data")>("@/middlelayers/cost-basis-data");
    return actual.loadCostBasisReport(options);
  });
  render(<CostBasisPage />);
  await waitFor(() => expect(screen.getByTestId("cost-desktop-table")).toHaveTextContent("Short"));
});

it("keeps the selected year visible after a filter reload", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2024" } });
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ from: "2024-01-01" })));
  expect(screen.getByLabelText("Tax year")).toHaveValue(2024);
});

it("does not present or export the previous report while a tax year is partly typed", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const saved = readCostBasisSettings();
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "202" } });
  expect(screen.getByLabelText("Tax year")).toHaveValue(202);
  expect(screen.getByRole("button", { name: /^Export$/ })).toBeDisabled();
  expect(screen.queryByTestId("cost-desktop-table")).not.toBeInTheDocument();
  expect(readCostBasisSettings()).toEqual(saved);
});

it("saves rapid method choices in click order", async () => {
  let finishFirst!: () => void;
  const firstSave = new Promise<void>((resolve) => { finishFirst = resolve; });
  vi.mocked(saveCostBasisMethod).mockImplementationOnce(() => firstSave).mockResolvedValueOnce();
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  fireEvent.click(screen.getByRole("button", { name: "LIFO" }));
  await waitFor(() => expect(saveCostBasisMethod).toHaveBeenCalledTimes(1));
  await act(async () => finishFirst());
  await waitFor(() => expect(saveCostBasisMethod).toHaveBeenLastCalledWith("LIFO"));
  await waitFor(() => expect(screen.getByRole("button", { name: "LIFO" })).toHaveAttribute("aria-pressed", "true"));
});

it("saves and queries the full current tax year while showing today in the subtitle", async () => {
  const today = new Date();
  const year = String(today.getFullYear());
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: "Tax year" }));
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({
    from: `${year}-01-01`, to: `${year}-12-31`,
  })));
  await waitFor(() => expect(readCostBasisSettings())
    .toMatchObject({ from: `${year}-01-01`, to: `${year}-12-31` }));
  expect(document.querySelector(".fidelity-page-head p")).toHaveTextContent(String(today.getDate()));
});

it("keeps the selected report tab while a custom date is typed", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: /Open lots/ }));
  fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-01-01" } });
  expect(screen.getByRole("button", { name: /Open lots/ })).toHaveAttribute("aria-pressed", "true");
});

it("does not reload chart transactions and holdings when only the method changes", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  await waitFor(() => expect(TRANSACTION_HANDLER.listTransactions).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ method: "HIFO" })));
  expect(TRANSACTION_HANDLER.listTransactions).toHaveBeenCalledTimes(1);
  expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
});

it("reads transactions and latest assets once for a report and its detail tables", async () => {
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "buy", assetType: "crypto", symbol: "BTC", wallet: "w",
      txnType: "buy", amount: 1, price: 100, txnCreatedAt: "2024-01-01T00:00:00Z" },
    { id: 2, uuid: "sell", assetType: "crypto", symbol: "BTC", wallet: "w",
      txnType: "sell", amount: 1, price: 200, txnCreatedAt: "2026-01-01T00:00:00Z" },
  ] as never);
  vi.mocked(buildCostBasisViewReport).mockImplementation(async (transactions, assets, options) => {
    const actual = await vi.importActual<typeof import("./cost-basis-view-data")>("./cost-basis-view-data");
    return actual.buildCostBasisViewReport(transactions, assets, options);
  });
  render(<CostBasisPage />);
  await waitFor(() => expect(screen.getByTestId("cost-desktop-table")).toHaveTextContent("BTC subtotal"));
  expect(TRANSACTION_HANDLER.listTransactions).toHaveBeenCalledTimes(1);
  expect(ASSET_HANDLER.listAssets).toHaveBeenCalledTimes(1);
});

it("shows the acquired date and consumed cost of an unmatched withdrawal", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    disposals: [],
    warnings: [{ code: "unknown-disposal", eventId: "2", assetType: "crypto", symbol: "SOL", amount: 35, date: "2026-09-18T22:05:00Z" }],
  } as never);
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "buy", assetType: "crypto", symbol: "SOL", wallet: "Binance",
      txnType: "buy", amount: 200, price: 98.5, txnCreatedAt: "2024-11-05T09:12:00Z" },
    { id: 2, uuid: "withdraw", assetType: "crypto", symbol: "SOL", wallet: "Binance",
      txnType: "withdraw", amount: 35, price: 0, txnCreatedAt: "2026-09-18T22:05:00Z" },
  ] as never);
  render(<CostBasisPage />);
  await waitFor(() => expect(screen.getByTestId("cost-desktop-table").querySelector(".fidelity-warnrow"))
    .toHaveTextContent("5 Nov 2024"));
  expect(screen.getByTestId("cost-desktop-table").querySelector(".fidelity-warnrow"))
    .toHaveTextContent("$3,447.50");
});
it("shows loading while a changed filter reloads an existing report", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  let finishReload!: (next: CostBasisReport) => void;
  const reload = new Promise<CostBasisReport>((resolve) => { finishReload = resolve; });
  vi.mocked(loadCostBasisReport).mockImplementationOnce(() => reload);
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2024" } });
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ from: "2024-01-01" })));
  expect(await screen.findByRole("status")).toHaveTextContent("Loading");
  await act(async () => { finishReload(report as never); });
  await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
});

it("shows the six report metrics before the detail tables", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  expect(document.querySelector(".fidelity-cost-kpis")).toHaveTextContent("Realized P&L");
  expect(document.querySelector(".fidelity-cost-kpis")).toHaveTextContent("Sale proceeds");
  expect(screen.getByTestId("cost-desktop-table")).toBeVisible();
});

it("has no axe violations with its visual summary shown", async () => {
  const { container } = render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

it("persists method changes and reloads the report for that method", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(saveCostBasisMethod).toHaveBeenCalledWith("HIFO"));
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ method: "HIFO" })));
});

it("exports the current report as CSV and JSON", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: /^Export$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Export CSV/ }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Export CSV/ })).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: /^Export$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Export JSON/ }));
  await waitFor(() => {
    expect(exportCostBasisReport).toHaveBeenCalledWith(report, "csv");
    expect(exportCostBasisReport).toHaveBeenCalledWith(report, "json");
  });
});

it("keeps past-year open lots in the selected report and exports that report", async () => {
  const selected = { ...report, openLots: [{ id: "past", symbol: "BTC", assetType: "crypto", amount: 1, acquiredAt: "2025-02-01", costBasis: 100 }],
    unrealized: [{ id: "past", symbol: "BTC", assetType: "crypto", amount: 1, acquiredAt: "2025-02-01", costBasis: 100, marketValue: 150, gainLoss: 50 }] } as CostBasisReport;
  const current = { ...selected, openLots: [{ ...selected.openLots[0], id: "future", acquiredAt: "2026-02-01" }] };
  vi.mocked(loadCostBasisReport).mockImplementation(async (options) => options.to ? selected : current);
  render(<CostBasisPage />);
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2025" } });
  await waitFor(() => expect(screen.getByTestId("cost-desktop-table")).toHaveTextContent("BTC"));
  await waitFor(() => expect(screen.getByRole("button", { name: /^Export$/ })).toBeEnabled());
  expect(document.querySelector(".fidelity-cost-kpis")).toHaveTextContent("+$50.00");
  fireEvent.click(screen.getByRole("button", { name: /^Export$/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Export JSON/ }));
  await waitFor(() => expect(exportCostBasisReport).toHaveBeenCalledWith(selected, "json"));
  expect(TRANSACTION_HANDLER.listTransactions).toHaveBeenCalled();
});

it("aligns subtotal gains with gain cells and keeps their gain color", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const table = screen.getByTestId("cost-desktop-table");
  const subtotal = table.querySelector(".fidelity-subtotal")!;
  expect(subtotal.querySelectorAll("td")).toHaveLength(6);
  expect(subtotal.querySelector("td")).toHaveAttribute("colspan", "3");
  expect(subtotal.querySelectorAll("td")[4]).toHaveClass("pos");
});

it("keeps the cost basis assistant setup action mounted for the records controls", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  expect(screen.getByText("Let the assistant set this up")).toBeInTheDocument();
});

it("does not print a stored wallet hash as a withdrawal source", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, warnings: [{ code: "unknown-disposal", eventId: "1", assetType: "crypto", symbol: "BTC", amount: 1, date: "2025-01-01" }],
  } as never);
  vi.mocked(TRANSACTION_HANDLER.listTransactions).mockResolvedValue([
    { id: 1, uuid: "a", assetType: "crypto", symbol: "BTC", wallet: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      txnType: "withdraw", amount: 1, price: 100, txnCreatedAt: "2025-01-01T12:00:00Z" },
  ] as never);
  render(<CostBasisPage />);
  await screen.findByText("BTC profit is unknown");
  expect(document.querySelector(".fidelity-cost-warning")).not.toHaveTextContent("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
});

it("keeps report amounts in USD when another display currency is selected", async () => {
  render(<CostBasisPage currency={{ currency: "EUR", symbol: "€", rate: 0.9, alias: "eur" }} />);
  await screen.findAllByText("BTC");
  expect(document.querySelector(".fidelity-cost-kpis")).toHaveTextContent("$100.00");
  expect(document.querySelector(".fidelity-cost-kpis")).not.toHaveTextContent("€");
  expect(document.querySelector(".fidelity-cost-chart .fidelity-card-head")).toHaveTextContent("USD");
});

it("shows the exact realized gain when a cost basis bar is hovered", async () => {
  vi.mocked(buildCostBasisViewReport).mockResolvedValue({
    ...report, disposals: [{ ...report.disposals[0], proceeds: 1991.2, gainLoss: 1891.2 }],
    assets: [{ ...report.assets[0], proceeds: 1991.2, gainLoss: 1891.2 }],
  } as never);
  render(<CostBasisPage />);
  const chart = (await screen.findByRole("heading", { name: "Realized P&L by asset" }, { timeout: 10_000 })).closest("section")!;
  fireEvent.pointerEnter(chart.querySelector(".fidelity-cost-chart-track")!);
  expect(screen.getByRole("tooltip")).toHaveTextContent("+$1,891.20");
});

it("lets holding days be cleared while editing and waits before reloading", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const field = screen.getByRole("spinbutton", { name: "Long-term after (days)" });
  const calls = vi.mocked(loadCostBasisReport).mock.calls.length;
  fireEvent.change(field, { target: { value: "" } });
  expect(field).toHaveValue(null);
  expect(loadCostBasisReport).toHaveBeenCalledTimes(calls);
  fireEvent.change(field, { target: { value: "400" } });
  expect(loadCostBasisReport).toHaveBeenCalledTimes(calls);
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ holdingPeriodDays: 400 })));
  await waitFor(() => expect(JSON.parse(localStorage.getItem(COST_BASIS_SETTINGS_KEY) ?? "{}")).toHaveProperty("holdingPeriodDays", 400));
});

it("uses a saved 400 day rule for open lots, subtotals, and holding notes", async () => {
  const acquiredAt = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  setCostBasisSettingsFromPage({
    from: "2026-01-01", to: "2026-12-31", holdingPeriodDays: 400,
  });
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    unrealized: [
      { id: "older", assetType: "crypto", symbol: "BTC", acquiredAt: acquiredAt(420),
        amount: 1, costBasis: 100, marketValue: 200, gainLoss: 100 },
      { id: "newer", assetType: "crypto", symbol: "BTC", acquiredAt: acquiredAt(380),
        amount: 1, costBasis: 100, marketValue: 200, gainLoss: 100 },
    ],
  } as never);
  render(<CostBasisPage />);
  const field = screen.getByRole("spinbutton", { name: "Long-term after (days)" });
  await waitFor(() => expect(field).toHaveValue(400));
  expect(document.querySelector(".fidelity-holding-rule")).toHaveTextContent("Long-term means held more than");
  expect(field).toHaveValue(400);
  expect(screen.getByTestId("cost-desktop-holding")).toHaveTextContent("held more than 400 days");
  expect(screen.getByTestId("cost-desktop-holding")).toHaveTextContent("held 400 days or less");
  fireEvent.click(screen.getByRole("button", { name: /Open lots/ }));
  const table = screen.getByTestId("cost-desktop-table");
  const lotTerms = [...table.querySelectorAll("tbody tr:not(.fidelity-subtotal):not(.fidelity-total) td:last-child")]
    .map((cell) => cell.textContent);
  expect(lotTerms).toEqual(["Long", "Short"]);
  expect(table.querySelector(".fidelity-subtotal td:last-child")).toHaveTextContent("Mixed");
});

it("hides the holding-days editor when average cost does not track terms", async () => {
  vi.mocked(getCostBasisMethod).mockResolvedValue("AVERAGE");
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  expect(document.querySelector(".fidelity-holding-rule")).toHaveTextContent("holding period is not tracked");
  expect(screen.queryByRole("spinbutton", { name: "Long-term after (days)" })).not.toBeInTheDocument();
});

it("flags a reversed date range and does not load or export it", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const calls = vi.mocked(loadCostBasisReport).mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-12-31" } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "2025-01-01" } });
  expect(screen.getByRole("alert")).toHaveTextContent("From must be on or before To.");
  for (const label of ["From", "To"]) {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", screen.getByRole("alert").id);
  }
  expect(screen.getByRole("button", { name: /^Export$/ })).toBeDisabled();
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(loadCostBasisReport).toHaveBeenCalledTimes(calls);
});

it("pages large realized and open-lot tables", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    disposals: Array.from({ length: 51 }, (_, index) => ({ ...report.disposals[0], eventId: String(index), symbol: `SALE-${index}` })),
    unrealized: Array.from({ length: 51 }, (_, index) => ({
      id: String(index), assetType: "crypto", symbol: `OPEN-${index}`, acquiredAt: "2024-01-01",
      amount: 1, costBasis: 100, marketValue: 200, gainLoss: 100,
    })),
  } as never);
  render(<CostBasisPage />);
  await screen.findAllByText("SALE-0");
  const table = screen.getByTestId("cost-desktop-table");
  const rows = () => table.querySelectorAll("tbody tr:not(.fidelity-subtotal):not(.fidelity-total)");
  expect(rows()).toHaveLength(50);
  expect(table).toHaveTextContent("Page 1 of 2");
  fireEvent.click(screen.getByRole("button", { name: "Next page of Realized disposals" }));
  expect(rows()).toHaveLength(1);
  expect(table).toHaveTextContent("Page 2 of 2");
  fireEvent.click(screen.getByRole("button", { name: /Open lots/ }));
  expect(rows()).toHaveLength(50);
  fireEvent.click(screen.getByRole("button", { name: "Next page of Open lots at latest stored price" }));
  expect(rows()).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
  fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-01-01" } });
  expect(table).toHaveTextContent("Page 2 of 2");
  expect(rows()).toHaveLength(1);
});

it("pages warnings so a long history renders only the current page", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    warnings: Array.from({ length: 51 }, (_, index) => ({ ...report.warnings[0], eventId: String(index), symbol: `GAP-${index}` })),
  } as never);
  render(<CostBasisPage />);
  await screen.findAllByText(/GAP-0/);
  expect(screen.queryAllByText(/GAP-50/)).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Next page of Data gaps to review" }));
  expect(screen.getAllByText(/GAP-50/)).not.toHaveLength(0);
});

it("folds a sub-1e-8 missing-lots residue into one dust row", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    warnings: [{ ...report.warnings[0], amount: 5e-11 }],
  } as never);
  render(<CostBasisPage />);
  expect(await screen.findByRole("table", { name: "Data gaps to review" })).toHaveTextContent("1 dust");
  expect(screen.getByRole("table", { name: "Data gaps to review" })).not.toHaveTextContent("5e-11");
});

it("shows the typed holding rule before the report debounce finishes", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const field = screen.getByRole("spinbutton", { name: "Long-term after (days)" });
  fireEvent.change(field, { target: { value: "400" } });
  const [before, , after] = document.querySelector(".fidelity-holding-rule > span")!.childNodes;
  expect(before.textContent).toBe("Long-term means held more than ");
  expect(after.textContent).toBe(" days.");
  expect(field).toHaveValue(400);
});

it("shows gap quantities with their coin and asset-specific precision", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, warnings: [
      { ...report.warnings[0], eventId: "sol", symbol: "SOL", amount: 35 },
      { ...report.warnings[0], eventId: "aapl", symbol: "AAPL", assetType: "stock", amount: 30 },
    ],
  } as never);
  render(<CostBasisPage />);
  const table = await screen.findByRole("table", { name: "Data gaps to review" });
  expect(within(table).getByText("35.0000 SOL")).toBeInTheDocument();
  expect(within(table).getByText("30 AAPL")).toBeInTheDocument();
});

it("lets the empty custom range choose another tax year", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({ ...report, disposals: [], warnings: [] } as never);
  render(<CostBasisPage />);
  await screen.findByText("No sales in 2026");
  fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
  await screen.findByText("No sales in selected range");
  fireEvent.click(screen.getByRole("button", { name: "Choose another year" }));
  expect(screen.getByRole("button", { name: "Tax year" })).toHaveAttribute("aria-pressed", "true");
  await waitFor(() => expect(screen.getByLabelText("Tax year")).toHaveFocus());
});

it("does not offer to show open lots while the empty open-lots tab is selected", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({ ...report, disposals: [], unrealized: [], warnings: [] } as never);
  render(<CostBasisPage />);
  await screen.findByText("No sales in 2026");
  fireEvent.click(screen.getByRole("button", { name: /Open lots/ }));
  expect(screen.getByText("No open lots yet")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Show open lots" })).not.toBeInTheDocument();
});

it("shows rows on page one when a new report has fewer rows than the previous page", async () => {
  const large = { ...report, disposals: Array.from({ length: 51 }, (_, index) => ({
    ...report.disposals[0], eventId: String(index), symbol: `SALE-${index}`,
  })) };
  const small = { ...report, method: "HIFO", disposals: [{ ...report.disposals[0], symbol: "NEW" }] };
  vi.mocked(loadCostBasisReport).mockImplementation(async (options) => options.method === "HIFO" ? small as never : large as never);
  render(<CostBasisPage />);
  await screen.findAllByText("SALE-0");
  fireEvent.click(screen.getByRole("button", { name: "Next page of Realized disposals" }));
  expect(screen.getByTestId("cost-desktop-table")).toHaveTextContent("Page 2 of 2");
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "HIFO" })).toHaveAttribute("aria-pressed", "true"));
  await waitFor(() => expect(screen.getByTestId("cost-desktop-table")).toHaveTextContent("NEW"));
});

it("clears a reason filter when the next report no longer has that reason", async () => {
  const other = { ...report, method: "HIFO", warnings: [{
    ...report.warnings[0], code: "unknown-disposal", eventId: "different", symbol: "NEW",
  }] };
  vi.mocked(loadCostBasisReport).mockImplementation(async (options) => options.method === "HIFO" ? other as never : report as never);
  render(<CostBasisPage />);
  await screen.findByRole("table", { name: "Data gaps to review" });
  fireEvent.change(screen.getByRole("combobox", { name: "Reason" }), { target: { value: "missing-lots" } });
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(screen.getByRole("table", { name: "Data gaps to review" })).toHaveTextContent("NEW"));
  expect(screen.getByRole("combobox", { name: "Reason" })).toHaveValue("all");
});

it("returns data gaps to page one when the next report has fewer gaps", async () => {
  const large = { ...report, warnings: Array.from({ length: 51 }, (_, index) => ({
    ...report.warnings[0], eventId: String(index), symbol: `GAP-${index}`,
  })) };
  const small = { ...report, method: "HIFO", warnings: [{ ...report.warnings[0], symbol: "NEW-GAP" }] };
  vi.mocked(loadCostBasisReport).mockImplementation(async (options) => options.method === "HIFO" ? small as never : large as never);
  render(<CostBasisPage />);
  await screen.findByText("GAP-0");
  fireEvent.click(screen.getByRole("button", { name: "Next page of Data gaps to review" }));
  expect(screen.getByRole("table", { name: "Data gaps to review" })).toHaveTextContent("GAP-50");
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(screen.getByRole("table", { name: "Data gaps to review" })).toHaveTextContent("NEW-GAP"));
});

it("hides an old method's report while the next report loads", async () => {
  let finish!: (next: CostBasisReport) => void;
  vi.mocked(loadCostBasisReport).mockImplementation((options) => options.method === "HIFO"
    ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(report as never));
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: "HIFO" }));
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ method: "HIFO" })));
  expect(screen.queryByTestId("cost-desktop-table")).not.toBeInTheDocument();
  expect(document.querySelector(".fidelity-cost-kpis")).toBeInTheDocument();
  await act(async () => finish({ ...report, method: "HIFO" } as never));
  expect(screen.getByTestId("cost-desktop-table")).toBeInTheDocument();
});
