import { act, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PortfolioSourceStatus } from "@/middlelayers/portfolio-baseline";
import { SourceStatusCard, useOverviewPanelsData } from "./overview-panels";

const state = vi.hoisted(() => ({ statuses: [] as PortfolioSourceStatus[] }));
vi.mock("@/middlelayers/ui-state/source-status-store", () => ({
  readStoredStatuses: () => state.statuses,
}));
vi.mock("@/middlelayers/charts", () => ({
  queryPNLChartValue: vi.fn(async () => []),
  queryAllDataDates: vi.fn(async () => []),
  queryAssetsByUUIDs: vi.fn(async () => []),
  queryLatestAssetsPercentage: vi.fn(async () => []),
  queryTopCoinsRank: vi.fn(async () => ({ coins: [], timestamps: [] })),
  queryTopCoinsPercentageChangeData: vi.fn(async () => ({ coins: [], timestamps: [] })),
}));

function StatusProbe() {
  const range = { start: new Date("2026-01-01"), end: new Date("2026-12-31") };
  const { statuses } = useOverviewPanelsData(range, range);
  return <>
    <SourceStatusCard statuses={statuses} />
    <SourceStatusCard statuses={statuses} variant="card" />
  </>;
}

afterEach(() => {
  vi.useRealTimers();
  state.statuses = [];
});

describe("Overview source status", () => {
  it("shows a stored failed source in the alert and Sources card when Overview mounts", () => {
    state.statuses = [{ sourceId: "cex:1", label: "OKX", status: "failed", lastSuccessAt: "2026-10-30T08:12:00Z" }];
    render(<StatusProbe />);
    expect(screen.getByRole("alert")).toHaveTextContent("OKX");
    const sourcesCard = screen.getByRole("heading", { name: "Sources" }).closest(".t3-sources-panel");
    expect(sourcesCard).not.toBeNull();
    expect(within(sourcesCard as HTMLElement).getByText("1 sources")).toBeInTheDocument();
    expect(within(sourcesCard as HTMLElement).getByText("OKX")).toBeInTheDocument();
    expect(within(sourcesCard as HTMLElement).getByText("Failed")).toBeInTheDocument();
  });

  it("shows the result of a failed refresh on this device as soon as it arrives", () => {
    vi.useFakeTimers();
    render(<StatusProbe />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    state.statuses = [{ sourceId: "cex:1", label: "OKX", status: "failed", lastSuccessAt: "2026-10-30T08:12:00Z" }];
    act(() => { window.dispatchEvent(new CustomEvent("source-statuses-changed", { detail: state.statuses })); });
    expect(screen.getByRole("alert")).toHaveTextContent("OKX");
  });
});
