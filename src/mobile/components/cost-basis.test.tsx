import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import CostBasisPage from "@/mobile/components/cost-basis";
import { getCostBasisMethod, saveCostBasisMethod } from "@/middlelayers/configuration";
import { exportCostBasisReport, loadCostBasisReport } from "@/middlelayers/cost-basis-data";
import { COST_BASIS_SETTINGS_KEY } from "@/middlelayers/ai/actions/page-settings";
import axe from "axe-core";

vi.mock("@/middlelayers/configuration", () => ({
  getCostBasisMethod: vi.fn(), saveCostBasisMethod: vi.fn(),
  loadAIConfig: vi.fn().mockResolvedValue({ endpoint: "http://localhost", apiKey: "", model: "test", contextSize: 8192 }),
}));
vi.mock("@/middlelayers/cost-basis-data", () => ({
  loadCostBasisReport: vi.fn(), exportCostBasisReport: vi.fn(),
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
  vi.mocked(exportCostBasisReport).mockResolvedValue(true);
});
afterEach(() => vi.restoreAllMocks());

it("shows realized totals and data gaps from the loaded report", async () => {
  render(<CostBasisPage />);
  expect((await screen.findAllByText("BTC"))[0]).toBeInTheDocument();
  expect(screen.getByText(/ETH/)).toBeInTheDocument();
  expect(screen.getByText(/Missing lots/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
  expect(screen.getByText(/Proceeds:/)).toHaveTextContent("200 USD");
  expect(screen.getByText(/Cost basis:/)).toHaveTextContent("100 USD");
});

it("shows an empty row for each phone cost basis section without records", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("min-width: 0px"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, assets: [], disposals: [], unrealized: [],
  } as never);
  render(<CostBasisPage />);
  expect(await screen.findByText(/Proceeds:/)).toHaveTextContent("$200.00");
  expect(screen.getByText(/Proceeds:/)).not.toHaveTextContent("USD");
  fireEvent.click(await screen.findByText("Details"));
  const lists = document.querySelectorAll(".d2-cost .mobile-record-list");
  expect(lists).toHaveLength(3);
  lists.forEach((list) => expect(list).toHaveTextContent("No Data"));
});

it("expands phone cost lots inline with their signed gain", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("min-width: 0px"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  render(<CostBasisPage />);
  fireEvent.click(await screen.findByText("Details"));
  const realized = screen.getByRole("heading", { name: "Realized disposals" }).closest("section")!;
  fireEvent.click(within(realized).getByRole("button", { name: /BTC/ }));
  expect(within(realized).getByRole("button", { name: /BTC/ })).toHaveAttribute("aria-expanded", "true");
  expect(within(realized).getByText("Acquired")).toBeVisible();
  expect(within(realized).getByText("Jan 1, 2024")).toBeVisible();
  expect(within(realized).getByText("$200.00")).toBeVisible();
  expect(within(realized).getAllByText("+$100.00")).toHaveLength(2);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("uses the same signed two-decimal gain in phone asset rows", async () => {
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("min-width: 0px"), addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }) as unknown as MediaQueryList);
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    ...report, assets: [{ ...report.assets[0], gainLoss: 1891.2 }],
  } as never);
  render(<CostBasisPage />);
  fireEvent.click(await screen.findByText("Details"));
  const assets = screen.getByRole("heading", { name: "By asset" }).closest("section")!;
  expect(within(assets).getByText("+$1,891.20")).toBeInTheDocument();
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
  vi.mocked(loadCostBasisReport).mockImplementation(() => new Promise(() => {}));
  fireEvent.change(screen.getByLabelText("Tax year"), { target: { value: "2024" } });
  await waitFor(() => expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ from: "2024-01-01" })));
  expect(screen.getByRole("status")).toHaveTextContent("Loading");
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
  expect(screen.getByRole("button", { name: "Export CSV" })).toBeDisabled();
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
  await screen.findByText("SALE-0");
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
