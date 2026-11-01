import { getClientID } from "@/utils/app";
import { sendHttpRequest } from "./datafetch/utils/http";
import { getLicenseIfIsPro, PRO_API_ENDPOINT } from "./configuration";
import { UserLicenseInfo } from "@/middlelayers/types";
import { getMemoryCacheInstance } from "./datafetch/utils/cache";
import { CACHE_GROUP_KEYS } from "./consts";

export type ResourceUsage = {
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
  periodEnd: string;
};

export type ProUsage = {
  enforced: boolean;
  usage: { erc20: ResourceUsage; tron: ResourceUsage };
};

export type SubscriptionInfo = {
  planType: "monthly" | "yearly" | null;
  status: "active" | "trialing" | "past_due" | "canceled" | "incomplete" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLegacy: boolean;
  usage?: ProUsage["usage"];
};

export type SubscriptionPlan = {
  planType: "monthly" | "yearly";
  currency: string;
  unitAmountCents: number;
  interval: "month" | "year";
};

export type SubscriptionPlansResponse = {
  plans: SubscriptionPlan[];
};

export type LicenseDevices = {
  limit: number;
  devices: {
    id: string;
    current: boolean;
    platform: "macos" | "windows" | "linux" | "ios" | null;
    appVersion: string | null;
    activatedAt: string;
    lastSeenAt: string | null;
  }[];
};

function isLicenseDevices(value: unknown): value is LicenseDevices {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (!Number.isInteger(result.limit) || (result.limit as number) < 1 || !Array.isArray(result.devices)) return false;
  return result.devices.every((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const device = entry as Record<string, unknown>;
    return typeof device.id === "string" && /^[a-f0-9]{16}$/.test(device.id)
      && typeof device.current === "boolean"
      && (device.platform === null || ["macos", "windows", "linux", "ios"].includes(device.platform as string))
      && (device.appVersion === null || typeof device.appVersion === "string")
      && typeof device.activatedAt === "string" && Number.isFinite(Date.parse(device.activatedAt))
      && (device.lastSeenAt === null || typeof device.lastSeenAt === "string" && Number.isFinite(Date.parse(device.lastSeenAt)));
  });
}

const LICENSE_CACHE_TTL_SECONDS = 5 * 60;
const LICENSE_CACHE_KEY_PREFIXES = {
  proStatus: "pro-status",
  subscriptionInfo: "subscription-info",
  subscriptionPlans: "subscription-plans",
  usage: "usage",
  devices: "devices",
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

function setCachedLicenseValue<T>(key: string, value: T, ttl = LICENSE_CACHE_TTL_SECONDS): T {
  licenseCache.setCache(key, value, ttl);
  return value;
}

export function clearLicenseCache(): void {
  licenseCache.clearCache();
}

export async function invalidateUsageCache(): Promise<void> {
  try {
    const license = await getLicenseIfIsPro();
    licenseCache.deleteCache(makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.usage, license));
    licenseCache.deleteCache(makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.subscriptionInfo, license));
  } catch {
    // A cache cleanup failure must not change the refresh result.
  }
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

export async function activateLicenseOnDevice(
  license: string,
  save: (license: string) => Promise<unknown>,
  messages: { invalid: string; failed: string },
): Promise<void> {
  const center = LicenseCenter.getInstance();
  const stored = await getLicenseIfIsPro();
  if (stored === license) {
    licenseCache.deleteCache(makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.proStatus, license));
  }
  const alreadyBound = stored === license && await center.isProUser(license).catch(() => false);
  if (!alreadyBound) {
    const valid = await center.validateLicense(license);
    if (!valid.isValid) throw new Error(messages.invalid);
    const active = await center.activeLicense(license);
    if (!active.success) {
      // Checkout webhooks may bind the device before this request arrives.
      licenseCache.deleteCache(makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.proStatus, license));
      const bound = await center.isProUser(license).catch(() => false);
      if (!bound) throw new Error(active.error ?? messages.failed);
    }
    await save(license);
  }
  clearLicenseCache();
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
    planType?: "monthly" | "yearly";
    periodEnd?: string;
  }> {
    const resp = await sendHttpRequest<{
      status: "pending" | "completed" | "expired";
      license?: string;
      planType?: "monthly" | "yearly";
      periodEnd?: string;
    }>(
      "GET",
      `${this.stripeEndpoint}?action=checkout-status&session_id=${encodeURIComponent(sessionId)}`,
      10000,
      { "x-track3-client-id": await getClientID() },
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

  public async getUsage(): Promise<ProUsage | undefined> {
    try {
      const license = await getLicenseIfIsPro();
      if (!license) return;
      const cacheKey = makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.usage, license);
      const cached = getCachedLicenseValue<ProUsage>(cacheKey);
      if (cached) return cached;
      const resp = await sendHttpRequest<ProUsage>(
        "POST", this.subscriptionInfoEndpoint, 3000,
        { "x-track3-client-id": await getClientID(), "x-track3-api-key": license },
        { action: "usage" },
      );
      if (!resp?.usage?.erc20 || !resp.usage.tron) return;
      return setCachedLicenseValue(cacheKey, resp, 60);
    } catch {
      return;
    }
  }

  public async getLicenseDevices(): Promise<LicenseDevices | undefined> {
    try {
      const license = await getLicenseIfIsPro();
      if (!license) return;
      const cacheKey = makeLicenseCacheKey(LICENSE_CACHE_KEY_PREFIXES.devices, license);
      const cached = getCachedLicenseValue<LicenseDevices>(cacheKey);
      if (cached) return cached;
      const response = await sendHttpRequest<unknown>(
        "POST", this.subscriptionInfoEndpoint, 3000,
        { "x-track3-client-id": await getClientID(), "x-track3-api-key": license },
        { action: "devices" },
      );
      if (!isLicenseDevices(response)) return;
      return setCachedLicenseValue(cacheKey, response, 60);
    } catch {
      return;
    }
  }

  public async getSubscriptionPlans(): Promise<SubscriptionPlansResponse> {
    const cacheKey = makeLicenseCacheKey(
      LICENSE_CACHE_KEY_PREFIXES.subscriptionPlans,
    );
    const cached = getCachedLicenseValue<SubscriptionPlansResponse>(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const resp = await sendHttpRequest<SubscriptionPlansResponse>(
      "POST",
      this.subscriptionInfoEndpoint,
      10000,
      undefined,
      { action: "subscription-plans" },
    );

    return setCachedLicenseValue(cacheKey, resp);
  }
}
