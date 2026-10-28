import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SystemInfo from "@/components/system-info";
import { checkoutPendingKey } from "@/middlelayers/checkout";
import { I18nProvider, useTranslation } from "@/i18n";

const exhaustedUsage = {
  erc20: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
  tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
};

const mocks = vi.hoisted(() => ({
  activateLicenseOnDevice: vi.fn(),
  activeLicense: vi.fn(),
  clearLicenseCache: vi.fn(),
  cleanLicense: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutStatus: vi.fn(),
  getCustomerPortalUrl: vi.fn(),
  getSubscriptionPlans: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getSubscriptionInfo: vi.fn(),
  getUsage: vi.fn(),
  getVersion: vi.fn(),
  inactiveLicense: vi.fn(),
  openUrl: vi.fn(),
  saveLicense: vi.fn(),
  toast: vi.fn(),
  trackEventWithClientID: vi.fn(),
  validateLicense: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getVersion: mocks.getVersion,
  trackEventWithClientID: mocks.trackEventWithClientID,
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
}));

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/middlelayers/configuration", () => ({
  cleanLicense: mocks.cleanLicense,
  getLicenseIfIsPro: mocks.getLicenseIfIsPro,
  saveLicense: mocks.saveLicense,
}));

vi.mock("@/middlelayers/license", () => ({
  activateLicenseOnDevice: mocks.activateLicenseOnDevice,
  clearLicenseCache: mocks.clearLicenseCache,
  LicenseCenter: {
    getInstance: () => ({
      activeLicense: mocks.activeLicense,
      createCheckoutSession: mocks.createCheckoutSession,
      getCheckoutStatus: mocks.getCheckoutStatus,
      getCustomerPortalUrl: mocks.getCustomerPortalUrl,
      getSubscriptionPlans: mocks.getSubscriptionPlans,
      getSubscriptionInfo: mocks.getSubscriptionInfo,
      getUsage: mocks.getUsage,
      inactiveLicense: mocks.inactiveLicense,
      validateLicense: mocks.validateLicense,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.trackEventWithClientID.mockResolvedValue(undefined);
  mocks.getVersion.mockResolvedValue("0.6.1");
  mocks.getLicenseIfIsPro.mockResolvedValue(undefined);
  mocks.createCheckoutSession.mockResolvedValue({
    sessionId: "cs_test_123",
    url: "https://checkout.stripe.test/session",
  });
  mocks.getCheckoutStatus.mockResolvedValue({
    status: "completed",
    license: "license-from-stripe",
  });
  mocks.validateLicense.mockResolvedValue({ isValid: true });
  mocks.activeLicense.mockResolvedValue({ success: true });
  mocks.saveLicense.mockResolvedValue(undefined);
  mocks.activateLicenseOnDevice.mockImplementation(async (license: string, save: (key: string) => Promise<void>) => {
    const valid = await mocks.validateLicense(license);
    if (!valid.isValid) throw new Error("Invalid key");
    const active = await mocks.activeLicense(license);
    if (!active.success) throw new Error(active.error);
    await save(license);
    mocks.clearLicenseCache();
  });
  mocks.getSubscriptionInfo.mockResolvedValue({
    planType: "yearly",
    status: "active",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    isLegacy: false,
  });
  mocks.getUsage.mockResolvedValue(undefined);
  mocks.getSubscriptionPlans.mockResolvedValue({
    plans: [
      {
        planType: "monthly",
        currency: "usd",
        unitAmountCents: 1299,
        interval: "month",
      },
      {
        planType: "yearly",
        currency: "usd",
        unitAmountCents: 9999,
        interval: "year",
      },
    ],
  });
  mocks.getCustomerPortalUrl.mockResolvedValue({
    url: "https://billing.stripe.test/portal",
  });
});

describe("System Info subscription management", () => {
  it("waits for the stored license before showing free purchase controls", async () => {
    let resolveLicense!: (license: string) => void;
    mocks.getLicenseIfIsPro.mockReturnValue(new Promise((resolve) => { resolveLicense = resolve; }));
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTestId("monthly-plan-card")).not.toBeInTheDocument();
    await act(async () => resolveLicense("stored-license"));
    expect(await screen.findByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument();
    expect(screen.queryByTestId("monthly-plan-card")).not.toBeInTheDocument();
  });

  it("shows both metered uses and reset dates for an active Pro license", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getUsage.mockResolvedValue({ enforced: true, usage: exhaustedUsage });
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03T00:00:00.000Z",
      cancelAtPeriodEnd: false, isLegacy: false,
      usage: exhaustedUsage,
    });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText("ERC20 wallet refreshes")).toBeInTheDocument();
    expect(screen.getByText("TRON wallet refreshes")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByText((_, element) => element?.tagName === "P" && element.textContent === "300 / 300")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("progressbar", { name: "ERC20 wallet refreshes" }).firstElementChild).toHaveClass("bg-destructive"));
    expect(screen.getAllByText(/Resets/)).toHaveLength(1);
    const proCard = screen.getByRole("heading", { name: "Track3 Pro" }).closest(".glass");
    expect(proCard).not.toBeNull();
    expect(within(proCard as HTMLElement).getByText("ERC20 wallet refreshes")).toBeInTheDocument();
    expect(within(proCard as HTMLElement).getByText("0.6.1").parentElement).toHaveTextContent(/Track3 0.6.1/);
  });

  it("does not mark a full bar as blocked while the backend is in log mode", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getUsage.mockResolvedValue({ enforced: false, usage: exhaustedUsage });
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03",
      cancelAtPeriodEnd: false, isLegacy: false,
      usage: exhaustedUsage,
    });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText((_, element) => element?.tagName === "P" && element.textContent === "300 / 300")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getUsage).toHaveBeenCalled());
    expect(screen.getByRole("progressbar", { name: "ERC20 wallet refreshes" }).firstElementChild).not.toHaveClass("bg-destructive");
  });

  it("shows the backend UTC reset day in time zones behind UTC", async () => {
    const originalTimeZone = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      mocks.getLicenseIfIsPro.mockResolvedValue("pro");
      mocks.getSubscriptionInfo.mockResolvedValue({
        planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03T00:00:00.000Z",
        cancelAtPeriodEnd: false, isLegacy: false,
        usage: {
          erc20: { limit: 300, used: 12, remaining: 288, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
          tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
        },
      });
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(await screen.findAllByText(/Resets/)).toHaveLength(1);
      expect(screen.getByText(/Resets Nov 3, 2026/)).toBeInTheDocument();
    } finally {
      process.env.TZ = originalTimeZone;
    }
  });

  it("hides usage rows when an older subscription response omits usage", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    await screen.findByRole("heading", { name: "Track3 Pro" });
    expect(screen.queryByText("ERC20 wallet refreshes")).not.toBeInTheDocument();
    expect(screen.queryByText("TRON wallet refreshes")).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows legacy usage meters above the license key", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("legacy-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, isLegacy: true,
      usage: exhaustedUsage,
    });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    await screen.findByText("Legacy");
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getByPlaceholderText("License Key")).toBeInTheDocument();
  });

  it("keeps the legacy desktop license dialog and device inactivation", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("legacy-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, isLegacy: true,
    });
    mocks.inactiveLicense.mockResolvedValue({ success: true });
    mocks.cleanLicense.mockResolvedValue(undefined);
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText("Legacy")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("License Key")).toHaveAttribute("type", "password");
    expect(screen.queryByRole("button", { name: "Manage Subscription" })).not.toBeInTheDocument();
    const inactivate = screen.getByRole("button", { name: "Inactivate license" });
    expect(inactivate).toHaveClass("border-destructive/40");
    expect(inactivate).not.toHaveClass("bg-destructive");
    fireEvent.click(inactivate);
    expect(await screen.findByText("Current license binding on this device will be removed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => expect(mocks.inactiveLicense).toHaveBeenCalledWith("legacy-license"));
  });

  it("hides inactivation while subscription details are pending", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getSubscriptionInfo.mockImplementation(() => new Promise(() => {}));
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Inactivate license" })).not.toBeInTheDocument();
  });

  it("warns that deactivation does not cancel Stripe when subscription details fail", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("subscriber-license");
    mocks.getSubscriptionInfo.mockRejectedValue(new Error("offline"));
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Inactivate license" }));
    expect(await screen.findByText(/This does not cancel your Stripe subscription/)).toBeInTheDocument();
  });

  it("keeps subscription controls available when plan data is malformed", async () => {
    mocks.getSubscriptionPlans.mockResolvedValueOnce({});
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Track3 Free" })).toBeInTheDocument();
    await waitFor(() => expect(mocks.getSubscriptionPlans).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: /view pro benefits/i })).toBeInTheDocument();
  });

  it("loads plan prices from the subscription plan API", async () => {
    render(<SystemInfo onProStatusChange={vi.fn()} />);

    expect(await screen.findByText("$12.99")).toBeInTheDocument();
    expect(screen.getByText("$99.99")).toBeInTheDocument();
    expect(mocks.getSubscriptionPlans).toHaveBeenCalledTimes(1);
  });

  it("opens the Pro benefits page from the upgrade card", async () => {
    render(<SystemInfo onProStatusChange={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /view pro benefits/i }),
    );

    expect(mocks.openUrl).toHaveBeenCalledWith("https://track3.dev/#pro");
  });

  it("keeps both subscribe buttons aligned at the bottom of plan cards", async () => {
    render(<SystemInfo onProStatusChange={vi.fn()} />);

    expect(await screen.findByTestId("monthly-plan-card")).toHaveClass(
      "flex",
      "h-full",
      "flex-col",
    );
    expect(screen.getByTestId("yearly-plan-card")).toHaveClass(
      "flex",
      "h-full",
      "flex-col",
    );
    expect(
      screen.getByRole("button", { name: /subscribe monthly/i }).parentElement,
    ).toHaveClass("mt-auto");
    expect(
      screen.getByRole("button", { name: /subscribe yearly/i }).parentElement,
    ).toHaveClass("mt-auto");
  });

  it("opens checkout and shows waiting and recovery actions", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /subscribe yearly/i }),
    );

    await waitFor(() => {
      expect(mocks.openUrl).toHaveBeenCalledWith("https://checkout.stripe.test/session");
      expect(screen.getByText(/waiting for payment/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /i've paid.*check again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("opens the browser again when subscribing after Cancel", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    await screen.findByText(/waiting for payment/i);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByText(/waiting for payment/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /subscribe monthly/i }));
    await waitFor(() => expect(mocks.openUrl).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/waiting for payment/i)).toBeInTheDocument();
    expect(mocks.trackEventWithClientID).toHaveBeenCalledWith("subscription_checkout_cancelled");
  });

  it("shows a timeout with actions and records the outcome", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    await screen.findByRole("button", { name: /subscribe monthly/i });
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getByRole("button", { name: /subscribe monthly/i }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      await act(async () => { await vi.advanceTimersByTimeAsync(600_000); });
      expect(screen.getByText(/payment check timed out/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /i've paid.*check again/i })).toBeInTheDocument();
      expect(mocks.trackEventWithClientID).toHaveBeenCalledWith("subscription_checkout_timed_out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("activates a completed checkout and updates Pro status", async () => {
    const onProStatusChange = vi.fn();
    render(<SystemInfo onProStatusChange={onProStatusChange} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe yearly/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument());
    expect(mocks.saveLicense).toHaveBeenCalledWith("license-from-stripe");
    expect(onProStatusChange).toHaveBeenCalledWith(true);
    expect(screen.getByText(/subscription activated/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByText(/subscription activated/i)).not.toBeInTheDocument();
  });

  it("shows an expired checkout with a way to try again", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "expired" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    expect(await screen.findByText(/checkout session expired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /subscribe monthly/i })).toBeEnabled();
    expect(mocks.trackEventWithClientID).toHaveBeenCalledWith("subscription_checkout_expired");
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(screen.queryByText(/checkout session expired/i)).not.toBeInTheDocument();
  });

  it("shows a redacted activation error with the device limit", async () => {
    mocks.activeLicense.mockResolvedValue({ success: false, error: "license-from-stripe is active on 3 devices" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    expect(await screen.findByText(/active on 3 devices/i)).toHaveTextContent("<REDACTED> is active on 3 devices");
    expect(screen.getByText(/active on 3 devices/i)).not.toHaveTextContent("license-from-stripe");
    expect(mocks.trackEventWithClientID).toHaveBeenCalledWith("subscription_checkout_error");
  });

  it("clears pending checkout after restoring a license key", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    await screen.findByText(/waiting for payment/i);
    fireEvent.click(screen.getByText(/restore purchase/i));
    fireEvent.change(screen.getByPlaceholderText(/license key/i), { target: { value: "restored-license" } });
    fireEvent.click(screen.getByRole("button", { name: /^activate$/i }));
    await waitFor(() => expect(mocks.saveLicense).toHaveBeenCalledWith("restored-license"));
    expect(localStorage.getItem(checkoutPendingKey)).toBeNull();
    expect(screen.queryByText(/waiting for payment/i)).not.toBeInTheDocument();
  });

  it("uses the current language for checkout completion", async () => {
    function LanguageSwitch() {
      const { setLocale } = useTranslation();
      return <button onClick={() => setLocale("zh")}>Switch language</button>;
    }
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<I18nProvider><LanguageSwitch /><SystemInfo onProStatusChange={vi.fn()} /></I18nProvider>);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    await screen.findByText(/waiting for payment/i);
    fireEvent.click(screen.getByRole("button", { name: "Switch language" }));
    mocks.getCheckoutStatus.mockResolvedValue({ status: "completed", license: "license-from-stripe" });
    fireEvent.click(screen.getByRole("button", { name: /我已付款/ }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith({ description: "Pro 订阅已激活！" }));
  });

  it("clears the license cache after inactivating the device", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("stored-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      isLegacy: false,
    });
    mocks.inactiveLicense.mockResolvedValue({ success: true });
    mocks.cleanLicense.mockResolvedValue(undefined);

    render(<SystemInfo onProStatusChange={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /^inactivate license$/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mocks.inactiveLicense).toHaveBeenCalledWith("stored-license");
      expect(mocks.cleanLicense).toHaveBeenCalled();
      expect(mocks.clearLicenseCache).toHaveBeenCalledTimes(1);
    });
  });

  it("redacts the configured license from activation errors", async () => {
    mocks.activeLicense.mockResolvedValue({
      success: false,
      error: "license custom-private-license was rejected",
    });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByText(/Restore purchase/i));
    fireEvent.change(screen.getByPlaceholderText(/license key/i), {
      target: { value: "custom-private-license" },
    });
    fireEvent.click(screen.getByRole("button", { name: /activate/i }));
    await waitFor(() => expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringContaining("<REDACTED>") }),
    ));
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain("custom-private-license");
  });

  it("shows active subscription details and opens the customer portal", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("stored-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      isLegacy: false,
    });

    render(<SystemInfo onProStatusChange={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument();
    expect(screen.getByText(/Monthly plan/)).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);

    fireEvent.click(
      screen.getByRole("button", { name: /manage subscription/i }),
    );

    await waitFor(() => {
      expect(mocks.trackEventWithClientID).toHaveBeenCalledWith(
        "subscription_open_clicked",
      );
      expect(mocks.getCustomerPortalUrl).toHaveBeenCalled();
      expect(mocks.openUrl).toHaveBeenCalledWith(
        "https://billing.stripe.test/portal",
      );
    });
  });

  it("opens Manage Subscription even if analytics is unavailable", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("stored-license");
    mocks.trackEventWithClientID.mockRejectedValue(new Error("offline"));
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /manage subscription/i }));
    await waitFor(() => expect(mocks.openUrl).toHaveBeenCalledWith("https://billing.stripe.test/portal"));
  });

  it("shows the renewal day count, keeps elapsed dates without a count, and colors past due status", async () => {
    vi.setSystemTime(new Date("2026-10-28T12:00:00.000Z"));
    try {
      mocks.getLicenseIfIsPro.mockResolvedValue("stored-license");
      mocks.getSubscriptionInfo.mockResolvedValue({
        planType: "monthly", status: "past_due", currentPeriodEnd: "2026-10-29T00:00:00.000Z",
        cancelAtPeriodEnd: false, isLegacy: false,
      });
      const view = render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect((await screen.findByText(/in 1 day/)).parentElement).toHaveTextContent("Monthly plan");
      expect(screen.getByText("Past Due")).toHaveClass("text-amber-700");
      view.unmount();
      mocks.getSubscriptionInfo.mockResolvedValue({
        planType: "monthly", status: "canceled", currentPeriodEnd: "2026-10-27T00:00:00.000Z",
        cancelAtPeriodEnd: true, isLegacy: false,
      });
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect((await screen.findByText(/expires Oct 27, 2026/)).parentElement).toHaveTextContent("Monthly plan");
      expect(screen.queryByText(/in 1 day/i)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
