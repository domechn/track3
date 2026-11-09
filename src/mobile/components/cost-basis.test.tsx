import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CostBasisPage from "@/mobile/components/cost-basis";
import { PhoneCostBasis } from "@/mobile/components/cost-basis-phone";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { exportCostBasisReport, loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import { queryTransactionsBySymbolAndDateRange } from "@/middlelayers/charts-profit";
import type { CostBasisReport } from "@/middlelayers/cost-basis-report";
import { COST_BASIS_SETTINGS_KEY } from "@/middlelayers/ai/actions/page-settings";
import axe from "axe-core";

vi.mock("@/middlelayers/configuration", () => ({
  getCostBasisMethod: vi.fn(), saveCostBasisMethod: vi.fn(),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));
vi.mock("@/middlelayers/cost-basis-data", () => ({
  loadCostBasisReport: vi.fn(), exportCostBasisReport: vi.fn(),
}));
vi.mock("@/middlelayers/charts-profit", () => ({
  queryTransactionsBySymbolAndDateRange: vi.fn(),
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

it("limits phone lots to eight and gaps to six with visible card pagers", () => {
  const many = {
    ...report,
    disposals: Array.from({ length: 17 }, (_, index) => ({ ...report.disposals[0], eventId: `sale-${index}` })),
    warnings: Array.from({ length: 13 }, (_, index) => ({ ...report.warnings[0], eventId: `gap-${index}` })),
  } as unknown as CostBasisReport;
  const { container } = render(<PhoneCostBasis report={many} loading={false} method="FIFO" year="2026"
    from="2026-01-01" to="2026-12-31" holdingDays="365" validRange filtersCurrent
    quoteColor="green-up-red-down" onMethod={vi.fn()} onYear={vi.fn()} onFrom={vi.fn()}
    onTo={vi.fn()} onHoldingDays={vi.fn()} onExport={vi.fn()} />);
  expect(container.querySelectorAll(".fidelity-cost-lots .fidelity-lot-row")).toHaveLength(8);
  expect(container.querySelectorAll(".fidelity-cost-gaps tbody tr")).toHaveLength(6);
  expect(container.querySelector(".fidelity-cost-lots > .fidelity-pager")).toBeInTheDocument();
  expect(container.querySelector(".fidelity-cost-gaps > .fidelity-pager")).toBeInTheDocument();
});

it("exposes the phone asset chart and prices as keyboard scroll regions", () => {
  render(<PhoneCostBasis report={report as unknown as CostBasisReport} loading={false} method="FIFO" year="2026"
    from="2026-01-01" to="2026-12-31" holdingDays="365" validRange filtersCurrent
    quoteColor="green-up-red-down" onMethod={vi.fn()} onYear={vi.fn()} onFrom={vi.fn()}
    onTo={vi.fn()} onHoldingDays={vi.fn()} onExport={vi.fn()} />);
  for (const title of ["Realized P&L by asset", "Avg. buy/sell price (selected range)"])
    expect(screen.getByRole("region", { name: title })).toHaveAttribute("tabindex", "0");
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.removeItem(COST_BASIS_SETTINGS_KEY);
  vi.mocked(getCostBasisMethod).mockResolvedValue("FIFO");
  vi.mocked(loadCostBasisReport).mockResolvedValue(report as never);
  vi.mocked(exportCostBasisReport).mockResolvedValue(true);
  vi.mocked(queryTransactionsBySymbolAndDateRange).mockResolvedValue([]);
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
});

it("shows realized totals and data gaps from the loaded report", async () => {
  render(<CostBasisPage />);
  expect((await screen.findAllByText("BTC"))[0]).toBeInTheDocument();
  expect(screen.getByText(/ETH/)).toBeInTheDocument();
  expect(screen.getByText(/Missing lots/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Export$/ })).toBeInTheDocument();
  const totals = document.querySelector(".cost-dashboard-secondary")!;
  expect(totals.children[0]).toHaveTextContent("Proceeds$200.00");
  expect(totals.children[1]).toHaveTextContent("Cost basis$100.00");
});

it("shows an empty row for each phone cost basis section without records", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, assets: [], disposals: [], unrealized: [],
  } as never);
  render(<CostBasisPage />);
  expect(await screen.findByText("No sales in 2026")).toBeInTheDocument();
  expect(screen.getByText("No sales in this range, so there is nothing to chart.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Show open lots" })).toBeInTheDocument();
});

it("shows phone cost lots inline with their signed gain", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  render(<CostBasisPage />);
  await screen.findByRole("button", { name: "Dispositions 1" }, { timeout: 10_000 });
  const realized = document.querySelector(".fidelity-cost-lots")!;
  expect(realized).toHaveTextContent("BTC");
  expect(realized).toHaveTextContent("Acquired 1 Jan 2024");
  expect(realized).toHaveTextContent("Cost $100.00 · Proceeds $200.00");
  expect(realized).toHaveTextContent("+$100.00");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
}, 15_000);

it("wraps large phone cost totals without changing ordinary totals", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    totals: { ...report.totals, proceeds: 999_999_999.99, gainLoss: 999_999_999.99 },
  } as never);
  render(<CostBasisPage />);
  await screen.findByRole("button", { name: "Dispositions 1" }, { timeout: 10_000 });
  expect(document.querySelector(".fidelity-kpi-primary > :first-child strong")).toHaveClass("fidelity-long-money");
  expect(document.querySelector(".fidelity-kpi-primary > :nth-child(2) strong")).not.toHaveClass("fidelity-long-money");
  expect(document.querySelector(".fidelity-kpi-secondary > :first-child strong")).toHaveClass("fidelity-long-money");
}, 15_000);

it("keeps stock and crypto lots with the same symbol in separate groups", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    disposals: [
      { ...report.disposals[0], eventId: "stock-aapl", assetType: "stock", symbol: "AAPL", gainLoss: 20 },
      { ...report.disposals[0], eventId: "crypto-aapl", assetType: "crypto", symbol: "AAPL", gainLoss: 30 },
    ],
  } as never);
  render(<CostBasisPage />);
  await screen.findByRole("button", { name: "Dispositions 2" }, { timeout: 10_000 });
  const groups = document.querySelectorAll(".fidelity-lot-group");
  expect(groups).toHaveLength(2);
  expect(groups[0]).toHaveTextContent("AAPL");
  expect(groups[0]).toHaveTextContent("Stock");
  expect(groups[0]).toHaveTextContent("+$20.00");
  expect(groups[1]).toHaveTextContent("Crypto");
  expect(groups[1]).toHaveTextContent("+$30.00");
}, 15_000);

it("shows a crypto data gap when a stock with the same symbol has a known gain", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    assets: [{ ...report.assets[0], assetType: "stock", symbol: "AAPL" }],
    warnings: [{ code: "unknown-disposal", eventId: "crypto-aapl", assetType: "crypto",
      symbol: "AAPL", amount: 2, date: "2026-10-18" }],
  } as never);
  render(<CostBasisPage />);
  const chart = (await screen.findByRole("heading", { name: "Realized P&L by asset" })).closest("section")!;
  expect(chart.querySelectorAll(".fidelity-asset-bar")).toHaveLength(2);
  expect(chart.querySelector(".fidelity-asset-bar:last-child")).toHaveTextContent("–");
});

it("rounds phone chart gains to whole dollars as in the design", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, assets: [{ ...report.assets[0], gainLoss: 1891.2 }],
  } as never);
  render(<CostBasisPage />);
  const assets = (await screen.findByRole("heading", { name: "Realized P&L by asset" })).closest("section")!;
  expect(within(assets).getByText("+$1,891")).toBeInTheDocument();
});
it("keeps manual setup open after a filter reload", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const panel = screen.getByText("Manual setup").closest("details");
  await waitFor(() => expect(panel).not.toHaveAttribute("open"));
  fireEvent.click(screen.getByText("Manual setup"));
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2024" } });
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ from: "2024-01-01" })));
  expect(panel).toHaveAttribute("open");
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

it("marks old phone report busy as soon as the visible filter changes", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  render(<CostBasisPage />);
  await screen.findByRole("button", { name: "Dispositions 1" }, { timeout: 15_000 });
  await waitFor(() => expect(document.querySelector(".fidelity-cost")).toHaveAttribute("aria-busy", "false"));
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2024" } });
  expect(document.querySelector(".fidelity-cost")).toHaveAttribute("aria-busy", "true");
});

it("leads with AI setup and keeps report details in a collapsible section", async () => {
  render(<CostBasisPage />);
  expect(await screen.findByText("Let the assistant set this up")).toBeVisible();
  expect(screen.getByText("Use FIFO and show my 2025 realized gains")).toBeInTheDocument();
  expect((await screen.findByText("Details")).closest("details")).not.toHaveAttribute("open");
});

it("has no axe violations with its visual summary shown", async () => {
  const { container } = render(<CostBasisPage />);
  await screen.findByText("Details");
  const results = await axe.run(container, { rules: { "color-contrast": { enabled: false } } });
  expect(results.violations.map(({ id }) => id)).toEqual([]);
});

it("persists method changes and reloads the report for that method", async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.keyDown(screen.getByRole("combobox", { name: "Cost basis method" }), { key: "ArrowDown" });
  fireEvent.keyDown(await screen.findByRole("option", { name: "HIFO" }), { key: "Enter" });
  await waitFor(() => expect(saveCostBasisMethod).toHaveBeenCalledWith("HIFO"));
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ method: "HIFO" })));
});

it("exports the current report as CSV and JSON", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  fireEvent.click(screen.getByRole("button", { name: /^Export$/ }));
  fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
  fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
  await waitFor(() => {
    expect(exportCostBasisReport).toHaveBeenCalledWith(report, "csv");
    expect(exportCostBasisReport).toHaveBeenCalledWith(report, "json");
  });
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

it("flags a reversed date range and does not load or export it", async () => {
  render(<CostBasisPage />);
  await screen.findAllByText("BTC");
  const calls = vi.mocked(loadCostBasisReport).mock.calls.length;
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
  expect(screen.queryByText("SALE-50")).not.toBeInTheDocument();
  expect(screen.queryByText("OPEN-50")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page of Realized disposals" }));
  fireEvent.click(screen.getByRole("button", { name: "Next page of Open lots at latest stored price" }));
  expect(screen.getByText("SALE-50")).toBeInTheDocument();
  expect(screen.getByText("OPEN-50")).toBeInTheDocument();
});

it("pages warnings so a long history renders only the current page", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    warnings: Array.from({ length: 51 }, (_, index) => ({ ...report.warnings[0], eventId: String(index), symbol: `GAP-${index}` })),
  } as never);
  render(<CostBasisPage />);
  await screen.findByText(/GAP-0/);
  expect(screen.queryByText(/GAP-50/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Next page of Data gaps to review" }));
  expect(screen.getByText(/GAP-50/)).toBeInTheDocument();
});

it("shows the actual amount of a tiny missing-lots warning", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    warnings: [{ ...report.warnings[0], amount: 5e-11 }],
  } as never);
  render(<CostBasisPage />);
  expect(await screen.findByText(/5e-11 ETH/)).toBeInTheDocument();
});

it("shows dated gap columns and folds sub-1e-8 residue into one dust row on phones", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    unrealized: [{ assetType: "crypto", symbol: "ETH", amount: 1, marketValue: 100, costBasis: 90, gainLoss: 10 }],
    warnings: [
      { ...report.warnings[0], date: "2026-10-18T12:00:00Z", amount: 1234.12345678 },
      { ...report.warnings[0], eventId: "residue-a", date: "2026-10-18T12:00:00Z", amount: 5e-11 },
      { ...report.warnings[0], eventId: "residue-b", date: "2026-10-18T12:00:00Z", amount: 3e-12 },
      { ...report.warnings[0], eventId: "fiat-dust", date: "2026-10-18T12:00:00Z", amount: 0.00009 },
    ],
  } as never);
  render(<CostBasisPage />);
  const gaps = await screen.findByRole("table", { name: "Data gaps to review" });
  expect(within(gaps).getByRole("columnheader", { name: "Date" })).toBeInTheDocument();
  expect(within(gaps).getByRole("columnheader", { name: "Coin" })).toBeInTheDocument();
  expect(within(gaps).getByRole("columnheader", { name: "Amount" })).toBeInTheDocument();
  expect(within(gaps).getByRole("columnheader", { name: "Reason" })).toBeInTheDocument();
  expect(within(gaps).getByText("1,234.12345678")).toBeInTheDocument();
  expect(within(gaps).getByText("Dust (3)")).toBeInTheDocument();
  expect(gaps).not.toHaveTextContent("5e-11");
});

it("filters phone gaps by reason and pages six real warnings", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    warnings: [
      ...Array.from({ length: 51 }, (_, index) => ({
        ...report.warnings[0], eventId: `gap-${index}`, symbol: `GAP-${index}`,
        date: "2026-10-18", amount: 1234.123456789,
      })),
      { ...report.warnings[0], eventId: "other", code: "unknown-disposal", date: "2026-10-18", symbol: "SOL", amount: 35 },
      { ...report.warnings[0], eventId: "dust", date: "2026-10-18", amount: 1e-9 },
    ],
  } as never);
  render(<CostBasisPage />);
  const table = await screen.findByRole("table", { name: "Data gaps to review" });
  expect(within(table).getAllByRole("row")).toHaveLength(7);
  expect(table).toHaveTextContent("1,234.12345679");
  expect(table).not.toHaveTextContent("GAP-6");
  fireEvent.click(screen.getByRole("button", { name: "Next page of Data gaps to review" }));
  expect(table).toHaveTextContent("GAP-6");
  fireEvent.change(screen.getByRole("combobox", { name: "Reason" }), { target: { value: "unknown-disposal" } });
  expect(within(table).getAllByRole("row")).toHaveLength(2);
  expect(table).toHaveTextContent("SOL");
  expect(table).not.toHaveTextContent("GAP-6");
});

it("keeps dated phone gaps visible when the range has no end date", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, warnings: [{ ...report.warnings[0], date: "2026-10-18", amount: 2 }],
  } as never);
  render(<CostBasisPage />);
  fireEvent.click(await screen.findByRole("button", { name: "Custom range" }));
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "" } });
  const table = await screen.findByRole("table", { name: "Data gaps to review" });
  expect(within(table).getByText("18 Oct 2026")).toBeInTheDocument();
});

it("uses the report's local-day warning selection on phones", async () => {
  const previousTimeZone = process.env.TZ;
  process.env.TZ = "Asia/Shanghai";
  try {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, warnings: [{ ...report.warnings[0], date: "2025-12-31T18:00:00Z", symbol: "SOL" }],
  } as never);
  render(<CostBasisPage />);
  const table = await screen.findByRole("table", { name: "Data gaps to review" });
  expect(within(table).getByText("SOL")).toBeInTheDocument();
  expect(within(table).getByText("1 Jan 2026")).toBeInTheDocument();
  } finally {
    if (previousTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimeZone;
  }
});

it("uses priced open positions consistently in phone KPIs and lot totals", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report,
    openLots: [
      { assetType: "crypto", symbol: "BTC", amount: 1, costBasis: 100 },
      { assetType: "crypto", symbol: "SOL", amount: 1, costBasis: 50 },
    ],
    unrealized: [{ assetType: "crypto", symbol: "BTC", amount: 1, costBasis: 100, marketValue: 120, gainLoss: 20, acquiredAt: "2025-01-01" }],
  } as never);
  render(<CostBasisPage />);
  await screen.findByText("Open lots value");
  const kpis = document.querySelector(".fidelity-cost-kpis")!;
  expect(kpis).toHaveTextContent("1 open lots");
  expect(kpis).toHaveTextContent("Cost $100.00");
  fireEvent.click(screen.getByRole("button", { name: "Open lots 1" }));
  expect(document.querySelector(".fidelity-lot-total")).toHaveTextContent("Cost $100.00 · Value $120.00");
});

it("keeps assistant setup available on phones", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  render(<CostBasisPage />);
  expect(await screen.findByText("Let the assistant set this up")).toBeVisible();
});

it("names the phone disposals scroll region without a trailing space", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  render(<CostBasisPage />);
  await screen.findByRole("button", { name: "Dispositions 1" });
  expect(document.querySelector(".fidelity-cost-lots .fidelity-card-scroll"))
    .toHaveAttribute("aria-label", "Dispositions");
});

it("formats phone average quantities to four places and emphasizes the custom period", async () => {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: coarse"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(queryTransactionsBySymbolAndDateRange).mockResolvedValue([
    { txnType: "buy", amount: 1, price: 100 },
    { txnType: "sell", amount: 1, price: 200 },
  ] as never);
  render(<CostBasisPage />);
  await screen.findByText("Avg. buy/sell price (selected range)");
  await waitFor(() => expect(document.querySelector(".fidelity-cost-prices"))
    .toHaveTextContent("Bought 1.0000 · sold 1.0000"));
  fireEvent.click(screen.getByRole("button", { name: "Custom range" }));
  expect(document.querySelector(".fidelity-cost-head strong")).toHaveTextContent("custom range");
  expect(screen.getByText("Recorded stablecoin trades are included in cost basis.")).toBeInTheDocument();
});
