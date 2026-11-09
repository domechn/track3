import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useDisplayCurrencyState } from "./display-currency";
import { queryPreferCurrency } from "@/middlelayers/configuration";

vi.mock("@/middlelayers/configuration", () => ({
  getDefaultCurrencyRate: () => ({ currency: "USD", alias: "US dollar", symbol: "$", rate: 1 }),
  queryPreferCurrency: vi.fn(),
}));

const cny = { currency: "CNY", alias: "Chinese yuan", symbol: "CN¥", rate: 7.1 };
const eur = { currency: "EUR", alias: "Euro", symbol: "€", rate: 0.9 };

beforeEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

it("resets the local override when the preferred currency changes", async () => {
  vi.mocked(queryPreferCurrency).mockResolvedValue(cny);
  const { result } = renderHook(() => useDisplayCurrencyState(() => {}));
  act(() => result.current.updatePreferredCurrency(cny));
  await act(async () => result.current.toggleDisplayCurrency());
  expect(result.current.displayCurrency.currency).toBe("USD");
  act(() => result.current.updatePreferredCurrency(eur));
  expect(result.current.displayCurrency.currency).toBe("EUR");
  expect(localStorage.getItem("track3.ui.display-currency-override")).toBeNull();
});

it("keeps the old display and reports a failed rate lookup", async () => {
  vi.mocked(queryPreferCurrency).mockRejectedValue(new Error("rate lookup failed"));
  const onError = vi.fn();
  const { result } = renderHook(() => useDisplayCurrencyState(onError));
  act(() => result.current.updatePreferredCurrency(cny));
  await act(async () => result.current.toggleDisplayCurrency());
  expect(result.current.displayCurrency.currency).toBe("CNY");
  expect(localStorage.getItem("track3.ui.display-currency-override")).toBeNull();
  expect(onError).toHaveBeenCalledOnce();
});

it("keeps the previous currency visible until the rate lookup completes", async () => {
  let finish!: (rate: typeof cny) => void;
  vi.mocked(queryPreferCurrency).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const { result } = renderHook(() => useDisplayCurrencyState(() => {}));
  act(() => result.current.updatePreferredCurrency(cny));
  let pending!: Promise<void>;
  act(() => { pending = result.current.toggleDisplayCurrency(); });
  expect(result.current.displayCurrency.currency).toBe("CNY");
  await act(async () => { finish(cny); await pending; });
  expect(result.current.displayCurrency.currency).toBe("USD");
});
