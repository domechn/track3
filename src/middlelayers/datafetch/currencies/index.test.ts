import { afterEach, expect, it, vi } from "vitest"
import { getClientID } from "../../../utils/app"
import { sendHttpRequest } from "../utils/http"
import { ExchangeRate } from "./index"

vi.mock("../../../utils/app", () => ({
	getClientID: vi.fn(),
}))

vi.mock("../utils/http", () => ({
	sendHttpRequest: vi.fn(),
}))

afterEach(() => {
	vi.useRealTimers()
	vi.clearAllMocks()
})

it("requests daily currency rates from the Track3 currency API", async () => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date("2026-10-28T12:00:00Z"))
	vi.mocked(getClientID).mockResolvedValue("client-id")
	vi.mocked(sendHttpRequest).mockResolvedValue({
		success: true,
		base: "USD",
		rates: { USD: 1, EUR: 0.9 },
	})

	await expect(new ExchangeRate().listAllCurrencyRates()).resolves.toEqual([
		{ currency: "USD", rate: 1 },
		{ currency: "EUR", rate: 0.9 },
	])
	expect(sendHttpRequest).toHaveBeenCalledWith(
		"GET",
		"https://currency-rate-api.track3.dev/api/currency-rate/2026-10-28",
		10000,
		{ "x-track3-client-id": "client-id" },
	)
})
