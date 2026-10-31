import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import PNL from "./pnl";
import { queryPNLTableValue } from "@/middlelayers/charts";
import { I18nProvider } from "@/i18n";
import { ChartResizeContext } from "@/App";

vi.mock("@/middlelayers/charts", () => ({
  queryPNLTableValue: vi.fn(),
  resizeChart: vi.fn(),
}));
vi.mock("./pnl-chart", () => ({ default: () => <div data-testid="pnl-chart" /> }));

const currency = { currency: "USD", symbol: "$", rate: 1, alias: "usd" };
const dateRange = { start: new Date("2024-01-01"), end: new Date("2024-02-01") };
const resize = { needResize: 0, setNeedResize: vi.fn() };

function renderPNL(translated = false) {
  const card = <ChartResizeContext.Provider value={resize}>
    <PNL currency={currency} dateRange={dateRange} quoteColor="green-up-red-down" />
  </ChartResizeContext.Provider>;
  return render(translated ? <I18nProvider>{card}</I18nProvider> : card);
}

beforeEach(() => {
  localStorage.setItem("track3-ui-locale", "en");
});

it.each([
  [200, 100, "+100.00%"], // 100 -> 200: 100 / 100
  [100, -100, "-50.00%"], // 200 -> 100: -100 / 200
  [100, 0, "0.00%"], // 100 -> 100: 0 / 100
  [200, 200, "—"], // 0 -> 200: percentage undefined
  [undefined, undefined, "—"],
] as const)("shows the last PnL percentage for latest %s and change %s", async (latest, change, expected) => {
  vi.mocked(queryPNLTableValue).mockResolvedValue({
    latestTotalValue: latest,
    todayPNL: change === undefined ? undefined : { value: change, timestamp: 1 },
    sevenTPnl: { value: 100, timestamp: 1 },
  });
  renderPNL();
  await waitFor(() => expect(screen.getByText("7 refreshes").parentElement?.querySelector("p")).toHaveTextContent("+$100.00"));
  expect(screen.getByText("Last PNL").parentElement?.children[1]).toHaveTextContent(expected);
  if (change === 0) {
    expect(screen.getByText("Last PNL").parentElement?.querySelector("p")).toHaveTextContent("$0.00");
  }
});

it("renders metrics without a second chart inside the overview hero", async () => {
  vi.mocked(queryPNLTableValue).mockResolvedValue({ latestTotalValue: 100, todayPNL: { value: 10, timestamp: 1 } });
  render(<ChartResizeContext.Provider value={resize}><PNL currency={currency} dateRange={dateRange} quoteColor="green-up-red-down" compact /></ChartResizeContext.Provider>);
  await waitFor(() => expect(screen.getByText("Last PNL").parentElement).toHaveTextContent("+11.11%"));
  expect(screen.queryByTestId("pnl-chart")).not.toBeInTheDocument();
});

it.each([
  ["en", "7 refreshes", "30 refreshes"],
  ["zh", "7 次刷新", "30 次刷新"],
] as const)("labels the snapshot windows as refreshes in %s", async (locale, seven, thirty) => {
  localStorage.setItem("track3-ui-locale", locale);
  vi.mocked(queryPNLTableValue).mockResolvedValue({
    latestTotalValue: 200,
    sevenTPnl: { value: 100, timestamp: 1 },
    thirtyPNL: { value: -100, timestamp: 1 },
  });
  renderPNL(true);
  expect(screen.getByText(seven)).toBeInTheDocument();
  expect(screen.getByText(thirty)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(seven).parentElement?.children[1]).toHaveTextContent("+100.00%"));
  expect(screen.getByText(thirty).parentElement?.children[1]).toHaveTextContent("-33.33%");
});
