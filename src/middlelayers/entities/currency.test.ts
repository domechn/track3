import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENCY_RATE_HANDLER } from "./currency";
import { selectFromDatabase, saveModelsToDatabase } from "../database";
import { ExchangeRate } from "../datafetch/currencies";

vi.mock("../database", () => ({
  selectFromDatabase: vi.fn(),
  saveModelsToDatabase: vi.fn(),
}));

vi.mock("../datafetch/currencies", () => ({
  ExchangeRate: vi.fn(),
}));

function makeRow(currency: string, rate: number, ageMs = 0, priority = 0) {
  return {
    id: 1,
    currency,
    rate,
    alias: currency,
    symbol: "$",
    priority,
    updatedAt: new Date(Date.now() - ageMs).toISOString(),
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(saveModelsToDatabase).mockResolvedValue(undefined as never);
  vi.mocked(ExchangeRate).mockImplementation(
    () =>
      ({
        queryUrl: "",
        listAllCurrencyRates: vi.fn().mockResolvedValue([
          { currency: "USD", rate: 1 },
          { currency: "HKD", rate: 7.84 },
        ]),
      }) as never,
  );
});

describe("CurrencyRateHandler.listCurrencyRates — staleness", () => {
  it("returns cached rates without refreshing when all rows are fresh", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([
      makeRow("USD", 1, 0, 0),
      makeRow("HKD", 7.84, 1000, 1), // 1 second old
    ] as never);

    const result = await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(saveModelsToDatabase).not.toHaveBeenCalled();
    expect(result).toHaveLength(2);
  });

  it("does not refresh when all rows are just within the 24-hour window", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([
      makeRow("USD", 1, ONE_DAY_MS - 1000),
      makeRow("HKD", 7.84, ONE_DAY_MS - 2000),
    ] as never);

    await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(saveModelsToDatabase).not.toHaveBeenCalled();
  });

  it("refreshes rates when the table is empty", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([] as never);

    await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(saveModelsToDatabase).toHaveBeenCalledTimes(1);
  });

  it("refreshes rates when a row has no updatedAt", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([
      {
        id: 1,
        currency: "USD",
        rate: 1,
        alias: "US dollar",
        symbol: "$",
        priority: 0,
        updatedAt: null,
      },
    ] as never);

    await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(saveModelsToDatabase).toHaveBeenCalledTimes(1);
  });

  it("refreshes rates when any row is older than 24 hours", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([
      makeRow("USD", 1, 0), // fresh
      makeRow("HKD", 7.84, ONE_DAY_MS + 1000), // stale
    ] as never);

    await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(saveModelsToDatabase).toHaveBeenCalledTimes(1);
  });

  it("returns rows sorted by priority", async () => {
    vi.mocked(selectFromDatabase).mockResolvedValue([
      makeRow("HKD", 7.84, 0, 1),
      makeRow("USD", 1, 0, 0),
    ] as never);

    const result = await CURRENCY_RATE_HANDLER.listCurrencyRates();

    expect(result[0].currency).toBe("USD");
    expect(result[1].currency).toBe("HKD");
  });
});
