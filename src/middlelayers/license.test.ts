import { beforeEach, describe, expect, it, vi } from "vitest";
import { getClientID } from "@/utils/app";
import { getLicenseIfIsPro, PRO_API_ENDPOINT } from "./configuration";
import { sendHttpRequest } from "./datafetch/utils/http";
import * as licenseModule from "./license";
import { isProVersion, LicenseCenter } from "./license";

vi.mock("@/utils/app", () => ({
  getClientID: vi.fn(),
}));

vi.mock("./datafetch/utils/http", () => ({
  sendHttpRequest: vi.fn(),
}));

vi.mock("./configuration", () => ({
  PRO_API_ENDPOINT: "https://track3-pro.test",
  getLicenseIfIsPro: vi.fn(),
}));

const clientId = "client-123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getClientID).mockResolvedValue(clientId);

  const clearLicenseCache = (licenseModule as Record<string, unknown>)
    .clearLicenseCache;
  if (typeof clearLicenseCache === "function") {
    clearLicenseCache();
  }
});

describe("LicenseCenter subscription APIs", () => {
  it("accepts an already bound checkout device and saves its license", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/validate")) return { isValid: true };
      if (url.endsWith("/active")) return { success: false, error: "Already active" };
      if (url.endsWith("/isPro")) return { isPro: true };
      return {};
    });
    const save = vi.fn();
    await licenseModule.activateLicenseOnDevice("stripe-license", save, {
      invalid: "Invalid key", failed: "Activation failed",
    });
    expect(save).toHaveBeenCalledExactlyOnceWith("stripe-license");
  });

  it("rechecks device binding after the webhook updates an earlier negative Pro lookup", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
    let bound = false;
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/validate")) return { isValid: true };
      if (url.endsWith("/active")) { bound = true; return { success: false, error: "Already active" }; }
      if (url.endsWith("/isPro")) return { isPro: bound };
      return {};
    });
    await LicenseCenter.getInstance().isProUser("stripe-license");
    const save = vi.fn();
    await licenseModule.activateLicenseOnDevice("stripe-license", save, {
      invalid: "Invalid key", failed: "Activation failed",
    });
    expect(save).toHaveBeenCalledExactlyOnceWith("stripe-license");
  });

  it("preserves a device limit error when restore cannot bind this device", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue(undefined);
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/validate")) return { isValid: true };
      if (url.endsWith("/active")) return { success: false, error: "Three device limit reached" };
      if (url.endsWith("/isPro")) return { isPro: false };
      return {};
    });
    const save = vi.fn();
    await expect(licenseModule.activateLicenseOnDevice("stripe-license", save, {
      invalid: "Invalid key", failed: "Activation failed",
    })).rejects.toThrow("Three device limit reached");
    expect(save).not.toHaveBeenCalled();
  });

  it("does not treat a locally stored but unbound key as activated", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stripe-license");
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, url) => {
      if (url.endsWith("/isPro")) return { isPro: false };
      if (url.endsWith("/validate")) return { isValid: true };
      if (url.endsWith("/active")) return { success: false, error: "Three device limit reached" };
      return {};
    });
    await expect(licenseModule.activateLicenseOnDevice("stripe-license", vi.fn(), {
      invalid: "Invalid key", failed: "Activation failed",
    })).rejects.toThrow("Three device limit reached");
  });
  it("refreshes the usage lookup after one minute", async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
      vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
      vi.mocked(sendHttpRequest).mockResolvedValue({
        enforced: true,
        usage: {
          erc20: { limit: 300, used: 298, remaining: 2, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
          tron: { limit: 300, used: 297, remaining: 3, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
        },
      });
      await LicenseCenter.getInstance().getUsage();
      vi.setSystemTime(new Date("2026-10-26T00:00:59Z"));
      await LicenseCenter.getInstance().getUsage();
      expect(sendHttpRequest).toHaveBeenCalledTimes(1);
      vi.setSystemTime(new Date("2026-10-26T00:01:01Z"));
      await LicenseCenter.getInstance().getUsage();
      expect(sendHttpRequest).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("loads usage once within its cache window and tolerates a failed lookup", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
    const usage = {
      enforced: true,
      usage: {
        erc20: { limit: 300, used: 4, remaining: 296, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
        tron: { limit: 300, used: 1, remaining: 299, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
      },
    };
    vi.mocked(sendHttpRequest).mockResolvedValueOnce(usage);
    expect(await LicenseCenter.getInstance().getUsage()).toEqual(usage);
    expect(await LicenseCenter.getInstance().getUsage()).toEqual(usage);
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).toHaveBeenCalledWith("POST", `${PRO_API_ENDPOINT}/api/license`, 3000,
      { "x-track3-client-id": clientId, "x-track3-api-key": "stored-license" }, { action: "usage" });
    licenseModule.clearLicenseCache();
    vi.mocked(sendHttpRequest).mockRejectedValueOnce(new Error("offline"));
    expect(await LicenseCenter.getInstance().getUsage()).toBeUndefined();
    vi.mocked(sendHttpRequest).mockResolvedValueOnce(usage);
    expect(await LicenseCenter.getInstance().getUsage()).toEqual(usage);
  });
  it("invalidates usage and subscription details after a refresh without discarding the Pro status", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
    vi.mocked(sendHttpRequest).mockImplementation(async (_method, _url, _timeout, _headers, body) => {
      const action = (body as { action?: string } | undefined)?.action;
      if (action === "usage") return { enforced: true, usage: {
        erc20: { limit: 300, used: 4, remaining: 296, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
        tron: { limit: 300, used: 1, remaining: 299, periodStart: "2026-10-01", periodEnd: "2026-11-01" },
      } };
      if (action === "subscription-info") return {
        planType: "monthly", status: "active", currentPeriodEnd: "2026-11-01",
        cancelAtPeriodEnd: false, isLegacy: false,
      };
      return { isPro: true };
    });
    await isProVersion();
    await LicenseCenter.getInstance().getUsage();
    await LicenseCenter.getInstance().getSubscriptionInfo();
    await licenseModule.invalidateUsageCache();
    await isProVersion();
    await LicenseCenter.getInstance().getUsage();
    await LicenseCenter.getInstance().getSubscriptionInfo();
    expect(sendHttpRequest).toHaveBeenCalledTimes(5);
  });
  it("reuses the cached pro status for the same stored license", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
    vi.mocked(sendHttpRequest).mockResolvedValue({ isPro: true });

    const first = await isProVersion();
    const second = await isProVersion();

    expect(first).toEqual({
      isPro: true,
      license: "stored-license",
    });
    expect(second).toEqual(first);
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("clears cached license lookups on demand", async () => {
    const clearLicenseCache = (
      licenseModule as { clearLicenseCache?: () => void }
    ).clearLicenseCache;

    expect(clearLicenseCache).toBeTypeOf("function");

    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
    vi.mocked(sendHttpRequest).mockResolvedValue({ isPro: true });

    await isProVersion();
    await isProVersion();
    clearLicenseCache?.();
    await isProVersion();

    expect(sendHttpRequest).toHaveBeenCalledTimes(2);
  });

  it("reuses the cached subscription info for the stored license", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValue("stored-license");
    vi.mocked(sendHttpRequest).mockResolvedValue({
      planType: "yearly",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      isLegacy: false,
    });

    const first = await LicenseCenter.getInstance().getSubscriptionInfo();
    const second = await LicenseCenter.getInstance().getSubscriptionInfo();

    expect(first).toEqual({
      planType: "yearly",
      status: "active",
      currentPeriodEnd: "2026-06-01T00:00:00.000Z",
      cancelAtPeriodEnd: false,
      isLegacy: false,
    });
    expect(second).toEqual(first);
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
  });

  it("reuses the cached subscription plans", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValue({
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

    const first = await LicenseCenter.getInstance().getSubscriptionPlans();
    const second = await LicenseCenter.getInstance().getSubscriptionPlans();

    expect(first).toEqual({
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
    expect(second).toEqual(first);
    expect(sendHttpRequest).toHaveBeenCalledTimes(1);
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      `${PRO_API_ENDPOINT}/api/license`,
      10000,
      undefined,
      { action: "subscription-plans" },
    );
  });

  it("creates a Stripe checkout session with the selected plan", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    });

    const result =
      await LicenseCenter.getInstance().createCheckoutSession("yearly");

    expect(result).toEqual({
      sessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      `${PRO_API_ENDPOINT}/api/stripe`,
      15000,
      { "x-track3-client-id": clientId },
      { action: "create-checkout-session", planType: "yearly" },
    );
  });

  it("queries checkout status by session id", async () => {
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      status: "completed",
      license: "license-from-stripe",
    });

    const result =
      await LicenseCenter.getInstance().getCheckoutStatus("cs_test_123");

    expect(result).toEqual({
      status: "completed",
      license: "license-from-stripe",
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "GET",
      `${PRO_API_ENDPOINT}/api/stripe?action=checkout-status&session_id=cs_test_123`,
      10000,
      { "x-track3-client-id": clientId },
    );
  });

  it("opens the customer portal with the stored license key", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValueOnce("stored-license");
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      url: "https://billing.stripe.test/portal",
    });

    const result = await LicenseCenter.getInstance().getCustomerPortalUrl();

    expect(result).toEqual({ url: "https://billing.stripe.test/portal" });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      `${PRO_API_ENDPOINT}/api/stripe`,
      10000,
      {
        "x-track3-client-id": clientId,
        "x-track3-api-key": "stored-license",
      },
      { action: "customer-portal" },
    );
  });

  it("loads subscription info with an empty api key when no license is stored", async () => {
    vi.mocked(getLicenseIfIsPro).mockResolvedValueOnce(undefined);
    vi.mocked(sendHttpRequest).mockResolvedValueOnce({
      planType: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isLegacy: true,
    });

    const result = await LicenseCenter.getInstance().getSubscriptionInfo();

    expect(result).toEqual({
      planType: null,
      status: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      isLegacy: true,
    });
    expect(sendHttpRequest).toHaveBeenCalledWith(
      "POST",
      `${PRO_API_ENDPOINT}/api/license`,
      10000,
      {
        "x-track3-client-id": clientId,
        "x-track3-api-key": "",
      },
      { action: "subscription-info" },
    );
  });
});
