import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getConfiguration } from "@/middlelayers/configuration";
import en from "@/i18n/locales/en.json";
import CoinCustomPrice from "./coin-custom-price";

vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

it("labels a configured manual rule as a fallback", async () => {
  vi.mocked(getConfiguration).mockResolvedValue({
    others: [{ symbol: "NOVA", amount: 1, price: {
      kind: "manual", usd: 0.42, setAt: "2026-11-01T10:00:00.000Z", note: "OTC",
    } }],
  } as never);
  render(<CoinCustomPrice symbol="NOVA" assetType="crypto" locale="en" t={(key) =>
    en[key as keyof typeof en] ?? key} />);
  expect(await screen.findByText(/Fallback configured, set .* · OTC/)).toBeInTheDocument();
});
