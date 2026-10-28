import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { I18nProvider, useTranslation } from "@/i18n"
import OnboardingGuide from "./onboarding-guide"

function Guide({ onClose = vi.fn(), variant = "desktop" as "desktop" | "ios" }) {
  const [step, setStep] = useState(0)
  return <OnboardingGuide open variant={variant} step={step} onStep={setStep} onClose={onClose} />
}

describe("onboarding guide", () => {
  it("names the dialog and shows the trust points on step one", async () => {
    render(<Guide />)
    const dialog = await screen.findByTestId("onboarding-dialog")
    expect(dialog).toHaveAttribute("data-step", "welcome")
    await waitFor(() => expect(screen.getByText("Balances and history are stored on this device.")).toBeVisible())
    expect(screen.queryByTestId("onboarding-back")).not.toBeInTheDocument()
    expect(dialog.getAttribute("aria-labelledby")).toBe(screen.getByRole("heading", { name: "Welcome to Track3" }).id)
    expect(dialog.getAttribute("aria-describedby")).toBe(screen.getByText(/See your crypto and stocks/).id)
    expect(screen.getByTestId("onboarding-illustration-welcome")).toHaveAttribute("aria-hidden", "true")
  })

  it("moves forward and back with buttons and announces the new step", async () => {
    render(<Guide />)
    fireEvent.click(await screen.findByTestId("onboarding-next"))
    expect(screen.getByTestId("onboarding-dialog")).toHaveAttribute("data-step", "sources")
    expect(screen.getByTestId("onboarding-live")).toHaveTextContent("Step 2 of 5: Connect your accounts")
    fireEvent.click(screen.getByTestId("onboarding-back"))
    expect(screen.getByTestId("onboarding-dialog")).toHaveAttribute("data-step", "welcome")
  })

  it("handles arrows, Escape, and never completes with ArrowRight", async () => {
    const onClose = vi.fn()
    render(<Guide onClose={onClose} />)
    const dialog = await screen.findByTestId("onboarding-dialog")
    for (let index = 0; index < 5; index++) fireEvent.keyDown(dialog, { key: "ArrowRight" })
    expect(dialog).toHaveAttribute("data-step", "backup")
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: "ArrowLeft" })
    expect(dialog).toHaveAttribute("data-step", "deeper")
    expect(screen.getByText(/Assistant answers questions/)).toBeInTheDocument()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("skipped"))
  })

  it("labels the last-step dismissal and finishes only from its CTA", async () => {
    const onClose = vi.fn()
    render(<Guide onClose={onClose} />)
    const dialog = await screen.findByTestId("onboarding-dialog")
    for (let index = 0; index < 4; index++) fireEvent.keyDown(dialog, { key: "ArrowRight" })
    expect(screen.getByTestId("onboarding-skip")).toHaveTextContent("Not now")
    fireEvent.click(screen.getByTestId("onboarding-cta-add-source"))
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("completed"))
  })

  it("moves focus to the CTA when Enter is pressed on the last step", async () => {
    const onClose = vi.fn()
    render(<Guide onClose={onClose} />)
    const dialog = await screen.findByTestId("onboarding-dialog")
    for (let index = 0; index < 4; index++) fireEvent.keyDown(dialog, { key: "ArrowRight" })
    fireEvent.keyDown(dialog, { key: "Enter" })
    expect(screen.getByTestId("onboarding-cta-add-source")).toHaveFocus()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("updates the current step when the language changes in place", async () => {
    function ChangeLanguage() {
      const { setLocale } = useTranslation()
      return <button data-testid="switch-language" onClick={() => setLocale("zh")}>Switch</button>
    }
    render(<I18nProvider><ChangeLanguage /><Guide /></I18nProvider>)
    await screen.findByTestId("onboarding-dialog")
    fireEvent.click(screen.getByTestId("switch-language"))
    expect(screen.getByRole("heading", { name: "欢迎使用 Track3" })).toBeInTheDocument()
  })

  it("fades out before reporting Skip", async () => {
    const onClose = vi.fn()
    render(<Guide onClose={onClose} />)
    fireEvent.click(await screen.findByTestId("onboarding-skip"))
    expect(screen.getByTestId("onboarding-dialog")).toHaveAttribute("data-closing", "true")
    expect(onClose).not.toHaveBeenCalled()
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("skipped"))
  })

  it("renders the final illustration frame with reduced motion", async () => {
    const matchMedia = window.matchMedia
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    try {
      render(<Guide />)
      expect(await screen.findByTestId("onboarding-illustration-welcome")).toHaveAttribute("data-reduced", "true")
    } finally {
      window.matchMedia = matchMedia
    }
  })

  it("opens the regular-width iPad card with a subtle scale", async () => {
    const previousWidth = window.innerWidth
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 820 })
    try {
      render(<Guide variant="ios" />)
      expect((await screen.findByTestId("onboarding-dialog")).getAttribute("style")).toMatch(/scale\(/)
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: previousWidth })
    }
  })
})
