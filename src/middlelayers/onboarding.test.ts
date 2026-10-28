import { beforeEach, describe, expect, it, vi } from "vitest"
import { queryLastRefreshAt } from "@/middlelayers/charts"
import { getConfiguration } from "@/middlelayers/configuration"
import {
  ONBOARDING_STORAGE_KEY,
  hasAnyConfiguredSource,
  shouldAutoStartOnboarding,
} from "./onboarding"
import type { GlobalConfig } from "@/middlelayers/datafetch/types"

vi.mock("@/middlelayers/charts", () => ({ queryLastRefreshAt: vi.fn() }))
vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }))

const emptyConfig = () => ({
  exchanges: [], stockConfig: { brokers: [] }, others: [],
  btc: { addresses: [] }, erc20: { addresses: [] }, sol: { addresses: [] },
  doge: { addresses: [] }, trc20: { addresses: [] }, ton: { addresses: [] },
  sui: { addresses: [] }, configs: { groupUSD: false },
}) as GlobalConfig

beforeEach(() => {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  vi.mocked(queryLastRefreshAt).mockReset().mockResolvedValue(undefined)
  vi.mocked(getConfiguration).mockReset().mockResolvedValue(undefined)
})

describe("configured sources", () => {
  it("ignores empty configuration", () => {
    expect(hasAnyConfiguredSource(undefined)).toBe(false)
    expect(hasAnyConfiguredSource(emptyConfig())).toBe(false)
  })

  it("counts inactive exchanges and manual assets", () => {
    expect(hasAnyConfiguredSource({ ...emptyConfig(), exchanges: [{ name: "binance", active: false }] } as GlobalConfig)).toBe(true)
    expect(hasAnyConfiguredSource({ ...emptyConfig(), others: [{ symbol: "BTC" }] } as GlobalConfig)).toBe(true)
  })

  it("counts brokers and string or object wallet addresses", () => {
    expect(hasAnyConfiguredSource({ ...emptyConfig(), stockConfig: { brokers: [{ name: "ibkr", active: false }] } } as GlobalConfig)).toBe(true)
    expect(hasAnyConfiguredSource({ ...emptyConfig(), btc: { addresses: ["bc1q"] } })).toBe(true)
    expect(hasAnyConfiguredSource({ ...emptyConfig(), sui: { addresses: [{ address: "0x1", active: false }] } })).toBe(true)
  })
})

describe("automatic first run", () => {
  it("does not query when a flag already exists", async () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "unknown")
    expect(await shouldAutoStartOnboarding()).toBe(false)
    expect(queryLastRefreshAt).not.toHaveBeenCalled()
  })

  it("marks history as an existing installation", async () => {
    vi.mocked(queryLastRefreshAt).mockResolvedValue("2024-01-01")
    expect(await shouldAutoStartOnboarding()).toBe(false)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("existing")
  })

  it("marks configured sources as an existing installation", async () => {
    vi.mocked(getConfiguration).mockResolvedValue({ ...emptyConfig(), btc: { addresses: ["bc1q"] } })
    expect(await shouldAutoStartOnboarding()).toBe(false)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("existing")
  })

  it("opens on a fresh installation without writing a flag", async () => {
    expect(await shouldAutoStartOnboarding()).toBe(true)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
  })

  it("leaves the flag unset when either query fails", async () => {
    vi.mocked(getConfiguration).mockRejectedValueOnce(new Error("offline"))
    expect(await shouldAutoStartOnboarding()).toBe(false)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
  })

  it("does not open when localStorage cannot be read", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementationOnce(() => { throw new Error("denied") })
    expect(await shouldAutoStartOnboarding()).toBe(false)
    spy.mockRestore()
  })

  it("honours a flag written by another window while queries are pending", async () => {
    let finish!: (value: GlobalConfig | undefined) => void
    vi.mocked(getConfiguration).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const check = shouldAutoStartOnboarding()
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed")
    finish(undefined)
    expect(await check).toBe(false)
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("completed")
  })
})
