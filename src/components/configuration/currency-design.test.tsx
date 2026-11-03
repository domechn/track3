import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import { CURRENCY_RATE_HANDLER } from "@/middlelayers/entities/currency";
import { CurrencyDesign } from "./currency-design";

vi.mock("@/middlelayers/charts-history", () => ({ queryHistoricalData: vi.fn(async () => [
  { id: "latest", assets: [
    { symbol: "USDT", amount: 10, value: 10 },
    { symbol: "USDC", amount: 20, value: 20 },
  ] },
]) }));
vi.mock("@/middlelayers/entities/currency", () => ({
  CURRENCY_RATE_HANDLER: { getCurrencyRateByCurrency: vi.fn(async () => ({ updatedAt: "2026-10-30T09:30:00.000Z" })) },
}));

it("previews stablecoin values from the latest portfolio snapshot", async () => {
  render(<CurrencyDesign groupUSD onGroupUSDChange={vi.fn()} hideInactive={false} onHideInactiveChange={vi.fn()}
    querySize={20} onQuerySizeChange={vi.fn()} preferCurrency="USD" preferCurrencyLoading={false}
    preferCurrencyOptions={[]} preferredCurrencyDetail={undefined} onPreferCurrencyChange={vi.fn()}
    refreshCurrencyLoading={false} onUpdateCurrencyRatesClick={vi.fn()}
    currencies={[]} rateError={false} />);
  expect(await screen.findByText("$30.00")).toBeInTheDocument();
  expect(queryHistoricalData).toHaveBeenCalledWith(1, true, { includeTransactions: false });
  expect(CURRENCY_RATE_HANDLER.getCurrencyRateByCurrency).toHaveBeenCalledWith("EUR");
});
