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
  vi.clearAllMocks();
  vi.mocked(getClientID).mockResolvedValue(clientId);

  const clearLicenseCache = (licenseModule as Record<string, unknown>)
    .clearLicenseCache;
  if (typeof clearLicenseCache === "function") {
    clearLicenseCache();
  }
});

describe("LicenseCenter subscription APIs", () => {
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
