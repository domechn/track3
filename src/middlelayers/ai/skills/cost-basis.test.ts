import { beforeEach, expect, it, vi } from "vitest";
import skill from "./cost-basis";
import { getCostBasisMethod } from "../../configuration";
import { loadCostBasisReport } from "../../cost-basis-data";

vi.mock("../../configuration", () => ({ getCostBasisMethod: vi.fn() }));
vi.mock("../../cost-basis-data", () => ({ loadCostBasisReport: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCostBasisMethod).mockResolvedValue("HIFO");
});

it("reads the saved method and returns realized gains without writing configuration", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    method: "HIFO", disposals: [], openLots: [], unrealized: [], warnings: [], assets: [],
    totals: { proceeds: 200, costBasis: 100, gainLoss: 100, shortTerm: 100, longTerm: 0 },
  });
  const result = await skill.run({ from: "2025-01-01", to: "2025-12-31" }, {
    baseCurrency: { currency: "EUR", rate: 0.9, alias: "Euro", symbol: "€" },
  });
  expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({
    method: "HIFO", from: "2025-01-01", to: "2025-12-31",
  }));
  expect(result.data).toMatchObject({
    method: "HIFO", totalsUsd: { gainLoss: 100 }, totalsInBase: { gainLoss: 90 },
  });
});

it("falls back to the saved method for an invalid model supplied method", async () => {
  vi.mocked(loadCostBasisReport).mockResolvedValue({
    method: "HIFO", disposals: [], openLots: [], unrealized: [], warnings: [], assets: [],
    totals: { proceeds: 0, costBasis: 0, gainLoss: 0, shortTerm: 0, longTerm: 0 },
  });
  const result = await skill.run({ method: "fifo" }, {
    baseCurrency: { currency: "USD", rate: 1, alias: "US Dollar", symbol: "$" },
  });
  expect(loadCostBasisReport).toHaveBeenCalledWith(expect.objectContaining({ method: "HIFO" }));
  expect(result.data).toMatchObject({ method: "HIFO" });
});
