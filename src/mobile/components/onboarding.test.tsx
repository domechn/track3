import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeEach, expect, it, vi } from "vitest"
import { I18nProvider as MobileI18nProvider } from "@/mobile/i18n"
import { queryLastRefreshAt } from "@/middlelayers/charts"
import { getConfiguration } from "@/middlelayers/configuration"
import { ONBOARDING_STORAGE_KEY } from "@/middlelayers/onboarding"
import FirstRunOnboarding from "@/components/onboarding"

vi.mock("@/middlelayers/charts", () => ({ queryLastRefreshAt: vi.fn() }))
vi.mock("@/middlelayers/configuration", () => ({ getConfiguration: vi.fn() }))

function Location() {
  const { pathname, search } = useLocation()
  return <span data-testid="location">{pathname}{search}</span>
}
function App() {
  return <MobileI18nProvider><MemoryRouter initialEntries={["/overview"]}>
    <FirstRunOnboarding ready variant="ios" />
    <Routes><Route path="*" element={<Location />} /></Routes>
  </MemoryRouter></MobileI18nProvider>
}
beforeEach(() => {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY)
  localStorage.removeItem("track3-ui-locale")
  vi.mocked(queryLastRefreshAt).mockReset().mockResolvedValue(undefined)
  vi.mocked(getConfiguration).mockReset().mockResolvedValue(undefined)
})
it("uses iPhone Refresh and Backup copy, omits Pro, and navigates to Sources", async () => {
  render(<App />)
  const dialog = await screen.findByTestId("onboarding-dialog")
  fireEvent.click(screen.getByTestId("onboarding-next"))
  expect(dialog).toHaveTextContent("tap Refresh or pull down")
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId("onboarding-next"))
  expect(dialog).toHaveTextContent("Settings → Backup")
  expect(dialog).not.toHaveTextContent(/\bPro\b|\bsubscribe\b|\bpurchase\b/i)
  fireEvent.click(screen.getByTestId("onboarding-cta-add-source"))
  await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/settings/configuration?section=sources"))
})
it("reads the Chinese mobile catalog", async () => {
  localStorage.setItem("track3-ui-locale", "zh")
  render(<App />)
  const dialog = await screen.findByTestId("onboarding-dialog")
  expect(dialog).toHaveTextContent("欢迎使用 Track3")
  fireEvent.click(screen.getByTestId("onboarding-next"))
  expect(dialog).toHaveTextContent("在总览页下拉")
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByTestId("onboarding-next"))
  expect(dialog).toHaveTextContent("设置 → 备份")
})
