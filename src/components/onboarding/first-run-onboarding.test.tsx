import { StrictMode } from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { queryLastRefreshAt } from "@/middlelayers/charts"
import { getConfiguration } from "@/middlelayers/configuration"
import { ONBOARDING_STORAGE_KEY, requestOnboardingReplay } from "@/middlelayers/onboarding"
import FirstRunOnboarding from "./index"

vi.mock("@/middlelayers/charts", () => ({ queryLastRefreshAt: vi.fn() }))
vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }))

function Location() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}{location.search}</div>
}
function App({ ready = true }: { ready?: boolean }) {
  return <MemoryRouter initialEntries={["/overview"]}>
    <FirstRunOnboarding variant="desktop" ready={ready} />
    <Routes><Route path="*" element={<Location />} /></Routes>
  </MemoryRouter>
}
beforeEach(() => {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  vi.mocked(queryLastRefreshAt).mockReset().mockResolvedValue(undefined)
  vi.mocked(getConfiguration).mockReset().mockResolvedValue(undefined)
})

it("waits for shell readiness before checking data", () => {
  render(<App ready={false} />)
  expect(screen.queryByTestId("onboarding-dialog")).not.toBeInTheDocument()
  expect(queryLastRefreshAt).not.toHaveBeenCalled()
})
it("opens for a fresh install and remembers Skip without navigating", async () => {
  render(<App />)
  fireEvent.click(await screen.findByTestId("onboarding-skip"))
  await waitFor(() => expect(screen.queryByTestId("onboarding-dialog")).not.toBeInTheDocument())
  expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("skipped")
  expect(screen.getByTestId("location")).toHaveTextContent("/overview")
})
it("writes completion before navigating to source setup", async () => {
  render(<App />)
  const dialog = await screen.findByTestId("onboarding-dialog")
  for (let i = 0; i < 4; i++) fireEvent.keyDown(dialog, { key: "ArrowRight" })
  fireEvent.click(screen.getByTestId("onboarding-cta-add-source"))
  await waitFor(() => expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe("completed"))
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings/configuration"))
})
it("replays even when the flag is already set", async () => {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "existing")
  render(<App />)
  expect(screen.queryByTestId("onboarding-dialog")).not.toBeInTheDocument()
  requestOnboardingReplay()
  expect(await screen.findByTestId("onboarding-dialog")).toHaveAttribute("data-step", "welcome")
})
it("defers opening while hidden", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  try {
    render(<App />)
    await waitFor(() => expect(queryLastRefreshAt).toHaveBeenCalled())
    expect(screen.queryByTestId("onboarding-dialog")).not.toBeInTheDocument()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    fireEvent(document, new Event("visibilitychange"))
    await waitFor(() => expect(screen.getByTestId("onboarding-dialog")).toBeVisible())
  } finally {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  }
})
it("does not open after another window writes the flag while hidden", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  const listen = vi.spyOn(document, "addEventListener")
  try {
    render(<App />)
    await waitFor(() => expect(listen.mock.calls.some(([name]) => name === "visibilitychange")).toBe(true))
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "completed")
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
    fireEvent(document, new Event("visibilitychange"))
    expect(screen.queryByTestId("onboarding-dialog")).not.toBeInTheDocument()
  } finally {
    listen.mockRestore()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  }
})
it("removes the deferred visibility listener after StrictMode unmount", async () => {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" })
  const add = vi.spyOn(document, "addEventListener")
  const remove = vi.spyOn(document, "removeEventListener")
  try {
    const { unmount } = render(<StrictMode><App /></StrictMode>)
    await waitFor(() => expect(add.mock.calls.some(([name]) => name === "visibilitychange")).toBe(true))
    const listener = add.mock.calls.find(([name]) => name === "visibilitychange")![1]
    unmount()
    expect(remove).toHaveBeenCalledWith("visibilitychange", listener)
  } finally {
    add.mockRestore()
    remove.mockRestore()
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" })
  }
})
