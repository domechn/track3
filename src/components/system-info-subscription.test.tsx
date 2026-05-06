import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SystemInfo from "@/components/system-info";

const mocks = vi.hoisted(() => ({
  activeLicense: vi.fn(),
  cleanLicense: vi.fn(),
  createCheckoutSession: vi.fn(),
  getCheckoutStatus: vi.fn(),
  getCustomerPortalUrl: vi.fn(),
  getLicenseIfIsPro: vi.fn(),
  getSubscriptionInfo: vi.fn(),
  getVersion: vi.fn(),
  inactiveLicense: vi.fn(),
  openUrl: vi.fn(),
  saveLicense: vi.fn(),
  toast: vi.fn(),
  validateLicense: vi.fn(),
}));

vi.mock("@/utils/app", () => ({
  getVersion: mocks.getVersion,
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
  LicenseCenter: {
    getInstance: () => ({
      activeLicense: mocks.activeLicense,
      createCheckoutSession: mocks.createCheckoutSession,
      getCheckoutStatus: mocks.getCheckoutStatus,
      getCustomerPortalUrl: mocks.getCustomerPortalUrl,
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
  mocks.getCustomerPortalUrl.mockResolvedValue({
    url: "https://billing.stripe.test/portal",
  });
});

describe("System Info subscription management", () => {
  it("starts yearly checkout and activates the returned license", async () => {
    const onProStatusChange = vi.fn();

    render(<SystemInfo onProStatusChange={onProStatusChange} />);

    fireEvent.click(
      await screen.findByRole("button", { name: /subscribe yearly/i }),
    );

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith("yearly");
      expect(mocks.openUrl).toHaveBeenCalledWith(
        "https://checkout.stripe.test/session",
      );
      expect(mocks.getCheckoutStatus).toHaveBeenCalledWith("cs_test_123");
      expect(mocks.validateLicense).toHaveBeenCalledWith("license-from-stripe");
      expect(mocks.activeLicense).toHaveBeenCalledWith("license-from-stripe");
      expect(mocks.saveLicense).toHaveBeenCalledWith("license-from-stripe");
      expect(onProStatusChange).toHaveBeenCalledWith(true);
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "Pro subscription activated!",
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
      expect(mocks.getCustomerPortalUrl).toHaveBeenCalled();
      expect(mocks.openUrl).toHaveBeenCalledWith(
        "https://billing.stripe.test/portal",
      );
    });
  });
});
