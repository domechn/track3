import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SystemInfo from "@/components/system-info";

const mocks = vi.hoisted(() => ({
  activeLicense: vi.fn(),
  clearLicenseCache: vi.fn(),
  cleanLicense: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutStatus: vi.fn(),
  getCustomerPortalUrl: vi.fn(),
  getSubscriptionPlans: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getSubscriptionInfo: vi.fn(),
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
  clearLicenseCache: mocks.clearLicenseCache,
  LicenseCenter: {
    getInstance: () => ({
      activeLicense: mocks.activeLicense,
      createCheckoutSession: mocks.createCheckoutSession,
      getCheckoutStatus: mocks.getCheckoutStatus,
      getCustomerPortalUrl: mocks.getCustomerPortalUrl,
      getSubscriptionPlans: mocks.getSubscriptionPlans,
      getSubscriptionInfo: mocks.getSubscriptionInfo,
      inactiveLicense: mocks.inactiveLicense,
      validateLicense: mocks.validateLicense,
    }),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
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
  mocks.getSubscriptionInfo.mockResolvedValue({
    planType: "yearly",
    status: "active",
    currentPeriodEnd: "2026-06-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
    isLegacy: false,
  });
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

    expect(mocks.openUrl).toHaveBeenCalledWith("https://track3.domc.me/");
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

  it("tracks subscribe clicks and shows that subscriptions are not supported yet", async () => {
    render(<SystemInfo onProStatusChange={vi.fn()} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /subscribe yearly/i }),
    );

    await waitFor(() => {
      expect(mocks.trackEventWithClientID).toHaveBeenCalledWith(
        "subscription_subscribe_clicked",
        { planType: "yearly" },
      );
      expect(mocks.toast).toHaveBeenCalledWith({
        description:
          "Subscription is not supported yet. Please wait for future updates.",
      });
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
    expect(mocks.openUrl).not.toHaveBeenCalledWith(
      "https://checkout.stripe.test/session",
    );
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
      await screen.findByRole("button", { name: /^inactivate$/i }),
    );
    fireEvent.click(await screen.findByRole("button", { name: /confirm/i }));

    await waitFor(() => {
      expect(mocks.inactiveLicense).toHaveBeenCalledWith("stored-license");
      expect(mocks.cleanLicense).toHaveBeenCalled();
      expect(mocks.clearLicenseCache).toHaveBeenCalledTimes(1);
    });
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

    expect(await screen.findByText("Subscription")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
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
