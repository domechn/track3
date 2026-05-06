import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "./datafetch/utils/http";
import { getLicenseIfIsPro, PRO_API_ENDPOINT } from "./configuration";
import { UserLicenseInfo } from "@/middlelayers/types";
import { getMemoryCacheInstance } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";

type SubscriptionInfo = {
  planType: "monthly" | "yearly" | null;
  status: "active" | "past_due" | "canceled" | "incomplete" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLegacy: boolean;
};

const LICENSE_CACHE_TTL_SECONDS = 5 * 60;
const LICENSE_CACHE_KEY_PREFIXES = {
  proStatus: "pro-status",
  subscriptionInfo: "subscription-info",
};

const licenseCache = getMemoryCacheInstance(
  CACHE_GROUP_KEYS.LICENSE_CACHE_GROUP_KEY,
);

function makeLicenseCacheKey(prefix: string, license?: string | null): string {
  return `${prefix}:${license ?? "anonymous"}`;
}

function getCachedLicenseValue<T>(key: string): T | undefined {
  return licenseCache.getCache<T>(key);
}

function setCachedLicenseValue<T>(key: string, value: T): T {
  licenseCache.setCache(key, value, LICENSE_CACHE_TTL_SECONDS);
  return value;
}

export function clearLicenseCache(): void {
  licenseCache.clearCache();
}

export async function isProVersion(): Promise<UserLicenseInfo> {
  // check if pro user
  const license = await getLicenseIfIsPro();
  let isPro = false;
  if (license) {
    isPro = await LicenseCenter.getInstance().isProUser(license);
  }

  return {
    isPro,
    license,
  };
}

export class LicenseCenter {
  private static instance: LicenseCenter;

  private readonly endpoint = PRO_API_ENDPOINT;

  private readonly validateEndpoint = this.endpoint + "/api/license/validate";
  private readonly activeEndpoint = this.endpoint + "/api/license/active";
  private readonly inactiveEndpoint = this.endpoint + "/api/license/inactive";
  private readonly isProEndpoint = this.endpoint + "/api/license/isPro";
  private readonly stripeEndpoint = this.endpoint + "/api/stripe";
  private readonly subscriptionInfoEndpoint = this.endpoint + "/api/license";

  private constructor() {}

  public static getInstance(): LicenseCenter {
    if (!LicenseCenter.instance) {
      LicenseCenter.instance = new LicenseCenter();
    }

    return LicenseCenter.instance;
  }

  public async validateLicense(license: string): Promise<{
    isValid: boolean;
  }> {
    const resp = await sendHttpRequest<{
      isValid: boolean;
    }>("POST", this.validateEndpoint, 10000, {
      "x-track3-client-id": await getClientID(),
      "x-track3-api-key": license,
    });

    return {
      isValid: resp.isValid,
    };
  }

  public async activeLicense(license: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    const resp = await sendHttpRequest<{
      success: boolean;
      error?: string;
    }>("POST", this.activeEndpoint, 10000, {
      "x-track3-client-id": await getClientID(),
      "x-track3-api-key": license,
    });

    return {
      success: resp.success,
      error: resp.error,
    };
  }

  public async inactiveLicense(
    license: string,
  ): Promise<{ success: boolean; error?: string }> {
    const resp = await sendHttpRequest<{
      success: boolean;
      error?: string;
    }>("POST", this.inactiveEndpoint, 10000, {
      "x-track3-client-id": await getClientID(),
      "x-track3-api-key": license,
    });

    return {
      success: resp.success,
      error: resp.error,
    };
  }

  public async isProUser(license: string): Promise<boolean> {
    const cacheKey = makeLicenseCacheKey(
      LICENSE_CACHE_KEY_PREFIXES.proStatus,
      license,
    );
    const cached = getCachedLicenseValue<boolean>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const resp = await sendHttpRequest<{
      isPro: boolean;
    }>("POST", this.isProEndpoint, 10000, {
      "x-track3-client-id": await getClientID(),
      "x-track3-api-key": license,
    });

    return setCachedLicenseValue(cacheKey, resp.isPro);
  }

  public async createCheckoutSession(planType: "monthly" | "yearly"): Promise<{
    sessionId: string;
    url: string;
  }> {
    const resp = await sendHttpRequest<{
      sessionId: string;
      url: string;
    }>(
      "POST",
      this.stripeEndpoint,
      15000,
      {
        "x-track3-client-id": await getClientID(),
      },
      { action: "create-checkout-session", planType },
    );

    return resp;
  }

  public async getCheckoutStatus(sessionId: string): Promise<{
    status: "pending" | "completed" | "expired";
    license?: string;
  }> {
    const resp = await sendHttpRequest<{
      status: "pending" | "completed" | "expired";
      license?: string;
    }>(
      "GET",
      `${this.stripeEndpoint}?action=checkout-status&session_id=${encodeURIComponent(sessionId)}`,
      10000,
    );

    return resp;
  }

  public async getCustomerPortalUrl(): Promise<{ url: string }> {
    const license = await getLicenseIfIsPro();
    const resp = await sendHttpRequest<{ url: string }>(
      "POST",
      this.stripeEndpoint,
      10000,
      {
        "x-track3-client-id": await getClientID(),
        "x-track3-api-key": license ?? "",
      },
      { action: "customer-portal" },
    );

    return resp;
  }

  public async getSubscriptionInfo(): Promise<SubscriptionInfo> {
    const license = await getLicenseIfIsPro();
    const cacheKey = makeLicenseCacheKey(
      LICENSE_CACHE_KEY_PREFIXES.subscriptionInfo,
      license,
    );
    const cached = getCachedLicenseValue<SubscriptionInfo>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const resp = await sendHttpRequest<SubscriptionInfo>(
      "POST",
      this.subscriptionInfoEndpoint,
      10000,
      {
        "x-track3-client-id": await getClientID(),
        "x-track3-api-key": license ?? "",
      },
      { action: "subscription-info" },
    );

    return setCachedLicenseValue(cacheKey, resp);
  }
}
