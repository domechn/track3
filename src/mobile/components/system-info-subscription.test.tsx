import React from "react";
import { fireEvent, render as testingRender, screen, waitFor, within } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SystemInfo from "@/mobile/components/system-info";
import { isIOS } from "@/utils/platform";
import { checkoutPendingKey } from "@/middlelayers/checkout";

const exhaustedUsage = {
  erc20: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
  tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00.000Z" },
};

const render = (ui: React.ReactElement) => testingRender(<HashRouter>{ui}</HashRouter>);

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => false) }));

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

vi.mock("@/mobile/components/ui/use-toast", () => ({
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
  vi.mocked(isIOS).mockReturnValue(false);
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
  it("does not show a stale app version while the native version is loading", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=about";
    mocks.getVersion.mockReturnValue(new Promise(() => {}));
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(screen.queryByText("0.1.0")).not.toBeInTheDocument();
      expect(screen.getByText("App Version").parentElement).toHaveTextContent("Loading...");
    } finally {
      window.location.hash = "";
    }
  });

  it("keeps the iPhone loading card directly beneath the page heading", () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockImplementation(() => new Promise(() => {}));
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(screen.getByRole("heading", { level: 2, name: "Track3" })).toBeInTheDocument();
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("waits for the stored license before showing mobile purchase controls", async () => {
    let resolveLicense!: (license: string) => void;
    mocks.getLicenseIfIsPro.mockReturnValue(new Promise((resolve) => { resolveLicense = resolve; }));
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(screen.getAllByText("Loading...").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("monthly-plan-card")).not.toBeInTheDocument();
    resolveLicense("stored-license");
    expect(await screen.findByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument();
  });

  it("places usage in the Pro card on non-iOS mobile", async () => {
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03T00:00:00.000Z",
      cancelAtPeriodEnd: false, isLegacy: false,
      usage: {
        erc20: { limit: 300, used: 12, remaining: 288, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
        tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
      },
    });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    await screen.findByText("ERC20 wallet refreshes");
    const proCard = screen.getByRole("heading", { name: "Track3 Pro" }).closest("[data-ui-card]");
    expect(proCard).not.toBeNull();
    expect(within(proCard as HTMLElement).getByText("ERC20 wallet refreshes")).toBeInTheDocument();
  });
  it("shows metered Pro usage on the iOS Pro settings screen", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getUsage.mockResolvedValue({ enforced: true, usage: exhaustedUsage });
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03T00:00:00.000Z",
      cancelAtPeriodEnd: false, isLegacy: false,
      usage: exhaustedUsage,
    });
    window.location.hash = "#/settings?section=pro";
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText("ERC20 wallet refreshes")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "This month's usage" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Track3 Pro" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "This month's usage" })).toBeInTheDocument();
    expect(screen.getByText("TRON wallet refreshes")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
    expect(screen.getAllByText(/Resets/)).toHaveLength(1);
    expect(within(screen.getByTestId("system-info-card")).getByText("0.6.1").parentElement).toHaveTextContent(/Track3 0.6.1/);
    await waitFor(() => expect(screen.getByRole("progressbar", { name: "ERC20 wallet refreshes" }).firstElementChild).toHaveClass("bg-destructive"));
  });
  it("manages an active iOS subscription before the deactivation control", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockResolvedValue("subscriber-license");
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      const manage = await screen.findByRole("button", { name: "Manage Subscription" });
      const deactivate = screen.getByRole("button", { name: "Deactivate license" });
      expect(manage.compareDocumentPosition(deactivate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      fireEvent.click(manage);
      await waitFor(() => expect(mocks.getCustomerPortalUrl).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(mocks.openUrl).toHaveBeenCalledWith("https://billing.stripe.test/portal"));
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });
  it("keeps a full iOS usage bar neutral in log mode", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    mocks.getUsage.mockResolvedValue({ enforced: false, usage: exhaustedUsage });
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: "monthly", status: "active", currentPeriodEnd: "2026-11-03",
      cancelAtPeriodEnd: false, isLegacy: false,
      usage: exhaustedUsage,
    });
    window.location.hash = "#/settings/systemInfo?section=pro";
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText((_, element) => element?.tagName === "P" && element.textContent === "300 / 300")).toBeInTheDocument();
    await waitFor(() => expect(mocks.getUsage).toHaveBeenCalled());
    expect(screen.getByRole("progressbar", { name: "ERC20 wallet refreshes" }).firstElementChild).not.toHaveClass("bg-destructive");
  });
  it("hides usage rows on iOS when an older subscription response omits usage", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    window.location.hash = "#/settings/systemInfo?section=pro";
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    await screen.findByText(/Yearly plan/);
    expect(screen.queryByRole("heading", { name: "This month's usage" })).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
  it("keeps license entry but hides external subscription links on iPhone", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Track3 Free" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view pro benefits/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe monthly/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe yearly/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/subscribe/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Restore purchase/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Track3 Free" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Restore purchase" })).toBeInTheDocument();
    expect(screen.getByLabelText("Restore purchase")).toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });
  it("uses the card body's border alone above restore on the iPhone route without a section", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo";
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(await screen.findByRole("heading", { name: "Track3 Free" })).toBeInTheDocument();
      const body = screen.getByTestId("system-info-card").querySelector("[data-system-card-body]")!;
      expect(body).toHaveClass("border-t");
      expect(body.firstElementChild).not.toHaveClass("border-t");
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });
  it("shows only app details on the iPhone About page", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=about";
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    expect(await screen.findByText("0.6.1")).toHaveClass("mobile-list-value");
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /subscribe/i })).not.toBeInTheDocument();
    vi.mocked(isIOS).mockReturnValue(false);
    window.location.hash = "";
  });

  it("shows subscription loading until the iPhone subscription response arrives", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockResolvedValue("existing-license");
    mocks.getSubscriptionInfo.mockImplementation(() => new Promise(() => {}));
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(await screen.findByRole("heading", { name: "Track3 Pro" })).toBeInTheDocument();
      expect(screen.getByTestId("system-info-card")).toHaveTextContent("Loading...");
      expect(screen.queryByRole("button", { name: "Deactivate license" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Restore purchase" })).not.toBeInTheDocument();
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("uses the legacy deactivation explanation on iPhone when subscription details fail", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockResolvedValue("subscriber-license");
    mocks.getSubscriptionInfo.mockRejectedValue(new Error("offline"));
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: "Deactivate license" }));
      expect(await screen.findByText("Current license binding on this device will be removed.")).toBeInTheDocument();
      expect(screen.queryByText(/Stripe subscription/)).not.toBeInTheDocument();
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("keeps the legacy iPhone license dialog and device inactivation", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockResolvedValue("legacy-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, isLegacy: true,
    });
    mocks.inactiveLicense.mockResolvedValue({ success: true });
    mocks.cleanLicense.mockResolvedValue(undefined);
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(await screen.findByText("Legacy")).toBeInTheDocument();
      expect(screen.getByLabelText("License Key")).toHaveAttribute("type", "password");
      expect(screen.getByLabelText("License Key").parentElement).toHaveClass("ios-d3-license-field");
      expect(screen.queryByRole("button", { name: "Manage Subscription" })).not.toBeInTheDocument();
      const deactivate = screen.getByRole("button", { name: "Deactivate license" });
      expect(deactivate).toHaveClass("border-destructive/40");
      expect(deactivate).not.toHaveClass("bg-destructive");
      fireEvent.click(deactivate);
      expect(await screen.findByText("Current license binding on this device will be removed.")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
      await waitFor(() => expect(mocks.inactiveLicense).toHaveBeenCalledWith("legacy-license"));
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("shows legacy usage meters above the iPhone license key", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo?section=pro";
    mocks.getLicenseIfIsPro.mockResolvedValue("legacy-license");
    mocks.getSubscriptionInfo.mockResolvedValue({
      planType: null, status: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, isLegacy: true,
      usage: exhaustedUsage,
    });
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      expect(await screen.findByText("Legacy")).toBeInTheDocument();
      expect(screen.getAllByRole("progressbar")).toHaveLength(2);
      expect(screen.getByLabelText("License Key")).toBeInTheDocument();
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
  });

  it("hides Manage Subscription on the iPhone System Info route without a section", async () => {
    vi.mocked(isIOS).mockReturnValue(true);
    window.location.hash = "#/settings/systemInfo";
    mocks.getLicenseIfIsPro.mockResolvedValue("pro");
    try {
      render(<SystemInfo onProStatusChange={vi.fn()} />);
      await screen.findByText(/Yearly plan/);
      expect(screen.queryByRole("button", { name: "Manage Subscription" })).not.toBeInTheDocument();
    } finally {
      vi.mocked(isIOS).mockReturnValue(false);
      window.location.hash = "";
    }
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

  it("opens checkout and shows waiting actions on non-iOS mobile", async () => {
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
    expect(mocks.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("opens checkout again after Cancel on non-iOS mobile", async () => {
    mocks.getCheckoutStatus.mockResolvedValue({ status: "pending" });
    render(<SystemInfo onProStatusChange={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /subscribe monthly/i }));
    await screen.findByText(/waiting for payment/i);
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    fireEvent.click(screen.getByRole("button", { name: /subscribe monthly/i }));
    await waitFor(() => expect(mocks.openUrl).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/waiting for payment/i)).toBeInTheDocument();
  });

  it("clears pending checkout after restoring a license on non-iOS mobile", async () => {
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
      await screen.findByRole("button", { name: /^deactivate license$/i }),
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
});
