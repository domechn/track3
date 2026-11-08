import { useEffect, useRef, useState } from "react";
import {
  cleanLicense,
  getLicenseIfIsPro,
  saveLicense,
} from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/mobile/components/ui/card";
import { EyeOpenIcon, EyeClosedIcon, ReloadIcon, ExternalLinkIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import {
  activateLicenseOnDevice,
  clearLicenseCache,
  LicenseCenter,
  type SubscriptionPlan,
  type SubscriptionPlansResponse,
  type SubscriptionInfo,
  type LicenseDevices,
} from "@/middlelayers/license";
import { CheckoutFlow, type CheckoutPhase } from "@/middlelayers/checkout";
import { ProUsageRows } from "@/components/pro-usage-rows";
import { ProLicenseDevices } from "@/components/pro-license-devices";
import { SystemInfoCard, subscriptionSummary } from "@/components/system-info-card";
import { useToast } from "@/mobile/components/ui/use-toast";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { getVersion } from "@/utils/app";
import { trackCheckoutCompleted, trackCheckoutPhase, trackSubscribeClicked, trackCheckoutCancelled, trackOpenClicked } from "@/middlelayers/ui-state/telemetry";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/mobile/i18n";
import { TrackLogo } from "@/components/brand/track-logo";
import { redactSecrets } from "@/middlelayers/security/redact";
import { requestOnboardingReplay } from "@/middlelayers/onboarding";
import { isIOS } from "@/utils/platform";
import { useSearchParams } from "react-router-dom";
import { InsetGroup, ListRow } from "@/mobile/components/mobile";

const App = ({
  onProStatusChange,
}: {
  onProStatusChange: (active: boolean) => void;
}) => {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const tRef = useRef(t);
  tRef.current = t;
  const [searchParams] = useSearchParams();
  const [version, setVersion] = useState<string>(t("common.loading"));
  const [licenseLoaded, setLicenseLoaded] = useState(false);
  const [activeLicense, setActiveLicense] = useState<string | undefined>();
  const [inputLicense, setInputLicense] = useState<string | undefined>();
  const [showLicense, setShowLicense] = useState(false);
  const [saveLicenseLoading, setSaveLicenseLoading] = useState(false);
  const [inactiveLicenseLoading, setInactiveLicenseLoading] = useState(false);
  const [showLegacyInput, setShowLegacyInput] = useState(isIOS());

  // subscription states
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<SubscriptionInfo | null>(null);
  const [usageEnforced, setUsageEnforced] = useState(false);
  const [licenseDevices, setLicenseDevices] = useState<LicenseDevices>();
  const [subInfoLoading, setSubInfoLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutPhase, setCheckoutPhase] = useState<CheckoutPhase>("idle");
  const [checkoutError, setCheckoutError] = useState<string>();
  const checkoutRef = useRef<CheckoutFlow>();
  const [subscriptionPlans, setSubscriptionPlans] =
    useState<SubscriptionPlansResponse | null>(null);
  const safeError = (error: unknown) =>
    redactSecrets(error instanceof Error ? error.message : String(error), [activeLicense ?? "", inputLicense ?? ""]);

  useEffect(() => {
    let current = true;
    loadVersion();
    void loadLicense()
      .then(() => { if (current && !isIOS()) void checkoutRef.current?.resume(); })
      .catch(() => {})
      .finally(() => { if (current) setLicenseLoaded(true); });
    if (!isIOS()) loadSubscriptionPlans();
    return () => { current = false; checkoutRef.current?.dispose(); };
  }, []);

  useEffect(() => {
    let current = true;
    setUsageEnforced(false);
    setLicenseDevices(undefined);
    if (activeLicense) {
      loadSubscriptionInfo();
      void LicenseCenter.getInstance().getUsage().then((result) => {
        if (current) setUsageEnforced(result?.enforced === true);
      });
      void LicenseCenter.getInstance().getLicenseDevices()
        .then((result) => { if (current) setLicenseDevices(result); })
        .catch(() => { if (current) setLicenseDevices(undefined); });
    } else {
      setSubscriptionInfo(null);
    }
    return () => { current = false; };
  }, [activeLicense]);

  function loadVersion() {
    getVersion().then(setVersion);
  }

  function loadLicense() {
    return getLicenseIfIsPro().then((license) => {
      setSubInfoLoading(!!license);
      setActiveLicense(license);
      setInputLicense(license);
    });
  }

  async function loadSubscriptionInfo() {
    setSubInfoLoading(true);
    try {
      const info = await LicenseCenter.getInstance().getSubscriptionInfo();
      setSubscriptionInfo(info);
    } catch {
      setSubscriptionInfo(null);
    } finally {
      setSubInfoLoading(false);
    }
  }

  async function loadSubscriptionPlans() {
    try {
      const plans = await LicenseCenter.getInstance().getSubscriptionPlans();
      setSubscriptionPlans(plans);
    } catch {
      setSubscriptionPlans(null);
    }
  }

  async function inactiveDevice(license: string) {
    const inactiveRes =
      await LicenseCenter.getInstance().inactiveLicense(license);
    if (!inactiveRes.success) {
      throw new Error(inactiveRes.error ?? t("system.inactiveFailed"));
    }
    await cleanLicense();
    clearLicenseCache();
    setSubscriptionInfo(null);
    onProStatusChange(false);
  }

  async function activeDevice(license: string) {
    await activateLicenseOnDevice(license, saveLicense, {
      invalid: tRef.current("system.invalidLicenseKey"),
      failed: tRef.current("system.activeLicenseFailed"),
    });
    onProStatusChange(true);
  }

  if (!checkoutRef.current && !isIOS()) {
    checkoutRef.current = new CheckoutFlow(
      LicenseCenter.getInstance(),
      openUrl,
      async (license) => {
        await activeDevice(license);
        setActiveLicense(license);
        setInputLicense(license);
      },
      (phase, error) => {
        setCheckoutPhase(phase);
        setCheckoutError(error);
        if (phase === "completed") {
          toast({ description: tRef.current("system.checkout.completed") });
          void trackCheckoutCompleted().catch(() => {});
        }
        if (phase === "expired" || phase === "timed-out" || phase === "error") {
          void trackCheckoutPhase(phase).catch(() => {});
        }
      },
    );
  }

  function onSaveLicenseClick() {
    if (!inputLicense) {
      return;
    }
    if (inputLicense.length > 10000) {
      toast({
        description: "License key is too long",
        variant: "destructive",
      });
      return;
    }
    setSaveLicenseLoading(true);
    activeDevice(inputLicense)
      .then(() => {
        checkoutRef.current?.clearPending();
        setActiveLicense(inputLicense);
        toast({
          description: t("system.licenseSaved"),
        });
      })
      .catch((err) => {
        toast({
          description: safeError(err),
          variant: "destructive",
        });
      })
      .finally(() => {
        setSaveLicenseLoading(false);
      });
  }

  function onInactiveLicenseClick() {
    if (!activeLicense) {
      return;
    }
    setInactiveLicenseLoading(true);
    inactiveDevice(activeLicense)
      .then(() => {
        setActiveLicense(undefined);
        setInputLicense(undefined);
        toast({
          description: t("system.deviceInactivated"),
        });
      })
      .catch((err) => {
        toast({
          description: safeError(err),
          variant: "destructive",
        });
      })
      .finally(() => {
        setInactiveLicenseLoading(false);
      });
  }

  async function onSubscribe(planType: "monthly" | "yearly") {
    if (isIOS()) return;
    void trackSubscribeClicked({ planType }).catch(() => {});
    await checkoutRef.current?.start(planType);
  }

  function onCancelCheckout() {
    checkoutRef.current?.cancel();
    void trackCheckoutCancelled().catch(() => {});
  }

  async function onManageSubscription() {
    setPortalLoading(true);
    try {
      void trackOpenClicked().catch(() => {});
      const { url } = await LicenseCenter.getInstance().getCustomerPortalUrl();
      await openUrl(url);
    } catch (err) {
      toast({
        description:
          err instanceof Error ? safeError(err) : t("system.openPortalFailed"),
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  }

  async function onViewBenefits() {
    await openUrl("https://track3.dev/#pro");
  }

  function subscriptionStatusLabel(status: string | null): string {
    switch (status) {
      case "active":
        return t("system.statusActive");
      case "trialing":
        return t("system.statusTrialing");
      case "past_due":
        return t("system.statusPastDue");
      case "canceled":
        return t("system.statusCanceled");
      case "incomplete":
        return t("system.statusIncomplete");
      default:
        return t("system.legacyLabel");
    }
  }

  function getPlan(planType: "monthly" | "yearly"): SubscriptionPlan | null {
    const plans = subscriptionPlans?.plans;
    return Array.isArray(plans)
      ? plans.find((plan) => plan.planType === planType) ?? null
      : null;
  }

  function formatPlanPrice(plan: SubscriptionPlan | null): string {
    if (!plan) return t("system.loadingPlan");
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currency.toUpperCase(),
      minimumFractionDigits: plan.unitAmountCents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(plan.unitAmountCents / 100);
  }

  function getYearlySavingsLabel(
    monthlyPlan: SubscriptionPlan | null,
    yearlyPlan: SubscriptionPlan | null,
  ): string | null {
    if (!monthlyPlan || !yearlyPlan) return null;

    const annualMonthlyCost = monthlyPlan.unitAmountCents * 12;
    if (annualMonthlyCost <= yearlyPlan.unitAmountCents) return null;

    const discount = Math.round(
      ((annualMonthlyCost - yearlyPlan.unitAmountCents) / annualMonthlyCost) *
        100,
    );
    return t("system.saveDiscount").replace("{n}", String(discount));
  }

  const isSubscribed =
    activeLicense && subscriptionInfo && !subscriptionInfo.isLegacy;
  const monthlyPlan = getPlan("monthly");
  const yearlyPlan = getPlan("yearly");
  const yearlySavingsLabel = getYearlySavingsLabel(monthlyPlan, yearlyPlan);
  const section = isIOS() ? searchParams.get("section") : null;
  const showPurchaseUI = !isIOS();

  if (isIOS() && section === "about") return <div className="ios-d3-system-settings fidelity-b fidelity-b-about">
    <p className="fidelity-b-subtitle">{t("fidelity.b.about.subtitle")}</p>
    <section className="fidelity-b-card fidelity-b-about-app">
      <div className="fidelity-b-about-brand">
        <TrackLogo size={56} decorative />
        <div><h2>Track3</h2><p>{t("fidelity.b.about.versionLine").replace("{version}", version)}</p></div>
      </div>
      <dl className="fidelity-b-pro-dl">
        <div><dt>{t("system.appVersion")}</dt><dd>Track3 <span className="mobile-list-value">{version}</span></dd></div>
        <div><dt>{t("fidelity.b.about.platform")}</dt><dd>iOS</dd></div>
        <div><dt>{t("fidelity.b.about.database")}</dt><dd>SQLite</dd></div>
        <div><dt>{t("fidelity.b.about.dataFolder")}</dt><dd>{t("fidelity.b.about.local")}</dd></div>
      </dl>
      <div className="fidelity-b-card-foot">
        <button type="button" className="fidelity-b-about-check"
          onClick={() => void openUrl("https://github.com/domechn/track3/releases")}>
          <ExternalLinkIcon aria-hidden="true" />{t("fidelity.b.about.viewReleases")}</button>
        <p className="fidelity-b-result">{t("fidelity.b.about.updateHint")}</p>
      </div>
    </section>
    <section className="fidelity-b-card fidelity-b-about-help">
      <h2>{t("fidelity.b.about.help")}</h2>
      <div className="fidelity-b-about-row">
        <div><strong>{t("fidelity.b.about.firstRun")}</strong>
          <small>{t("fidelity.b.about.firstRunHint")}</small></div>
        <button type="button" onClick={requestOnboardingReplay}
          data-testid="onboarding-replay">{t("fidelity.b.about.replay")}</button>
      </div>
      {([
        ["fidelity.b.about.docs", "docs.track3.dev", "https://docs.track3.dev"],
        ["fidelity.b.about.website", "track3.dev", "https://track3.dev"],
        ["fidelity.b.about.github", "github.com/domechn/track3", "https://github.com/domechn/track3"],
      ] as const).map(([key, label, url]) => <button type="button" key={key}
        className="fidelity-b-about-row" onClick={() => void openUrl(url)}>
        <span><strong>{t(key)}</strong><small>{label}</small></span>
        <ExternalLinkIcon aria-hidden="true" />
      </button>)}
    </section>
    <section className="fidelity-b-card fidelity-b-about-licenses">
      <div className="fidelity-b-card-head"><div><h2>{t("fidelity.b.about.licenses")}</h2>
        <p>{t("fidelity.b.about.licensesHint")}</p></div></div>
      <button type="button" className="fidelity-b-about-link"
        onClick={() => void openUrl("https://github.com/domechn/track3/blob/master/LICENSE")}>
        {t("fidelity.b.about.viewLicenses")}<ExternalLinkIcon aria-hidden="true" />
      </button>
    </section>
    <section className="fidelity-b-card fidelity-b-about-notes">
      <div className="fidelity-b-card-head"><div><h2>{t("fidelity.b.about.whatsNew").replace("{version}", version)}</h2>
        <p>{t("fidelity.b.about.notesHint")}</p></div></div>
      <button type="button" className="fidelity-b-about-link"
        onClick={() => void openUrl("https://github.com/domechn/track3/releases")}>
        {t("fidelity.b.about.fullNotes")}<ExternalLinkIcon aria-hidden="true" />
      </button>
    </section>
  </div>;

  if (!licenseLoaded) return <div className={isIOS() ? "ios-d3-system-settings" : "space-y-6"}>
    {!isIOS() && <div>
      <h3 className="text-lg font-medium tracking-tight">{t("system.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("system.subtitle")}</p>
    </div>}
    <SystemInfoCard title="Track3" headingLevel={isIOS() ? 2 : 3} description={t("common.loading")} version={version} t={t} />
  </div>;

  if (isIOS() && section === "pro") {
    const expired = !!subscriptionInfo?.currentPeriodEnd &&
      new Date(subscriptionInfo.currentPeriodEnd).getTime() < Date.now();
    const end = subscriptionInfo?.currentPeriodEnd ? new Date(subscriptionInfo.currentPeriodEnd) : null;
    const formatDate = (date: Date) => date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB",
      { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    const endText = end && Number.isFinite(end.getTime()) ? formatDate(end) : "—";
    const daysExpired = end && Number.isFinite(end.getTime())
      ? Math.max(0, Math.floor((Date.now() - end.getTime()) / 86_400_000)) : 0;
    const deviceCount = licenseDevices?.devices.length;
    const deviceLimit = licenseDevices?.limit;
    const usage = subscriptionInfo?.usage;
    const benefits = [
      ["fidelity.b.pro.erc20", "fidelity.b.pro.monthly"],
      ["fidelity.b.pro.tron", "fidelity.b.pro.monthly"],
      ["fidelity.b.pro.assistant", "fidelity.b.pro.assistantDetail"],
      ["fidelity.b.pro.insights", "fidelity.b.pro.optional"],
    ] as const;
    const deactivate = activeLicense && !subInfoLoading && <ConfirmDeleteDialog
      trigger={<Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-red-400/50 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-400" disabled={inactiveLicenseLoading}>
        {inactiveLicenseLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
        {t("system.inactivateLicense")}
      </Button>}
      title={t("system.inactivateTitle")} description={t("system.inactivateDescLegacy")}
      cancelLabel={t("common.cancel")}
      actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]} />;
    return <div className={`ios-d3-system-settings fidelity-b fidelity-b-pro${!activeLicense ? " is-free" : expired ? " is-expired" : ""}`}>
      <p className="fidelity-b-subtitle">{t("fidelity.b.pro.subtitle")}</p>
      {expired && <div className="fidelity-b-pro-banner is-warning" role="alert">
        <ExclamationTriangleIcon aria-hidden="true" />
        <div>
          <strong>{t("fidelity.b.pro.expiredBannerTitle").replace("{date}", endText)}</strong>
          <p>{t("fidelity.b.pro.expiredBannerBody")}</p>
        </div>
      </div>}
      {usage && usage.erc20?.used === usage.erc20?.limit && usageEnforced &&
        <div className="fidelity-b-pro-banner is-error" role="alert">
          <ExclamationTriangleIcon aria-hidden="true" />
          <div>
            <strong>{t("fidelity.b.pro.limitBannerTitle")}</strong>
            <p>{t("fidelity.b.pro.limitBannerUsage").replace("{used}", String(usage.erc20.used))
              .replace("{limit}", String(usage.erc20.limit))}
              {usage.erc20.periodEnd && Number.isFinite(Date.parse(usage.erc20.periodEnd)) && ` ${t("fidelity.b.pro.limitBannerReset")
                .replace("{date}", formatDate(new Date(usage.erc20.periodEnd)))}`}
              {usage.tron && ` ${t("fidelity.b.pro.limitBannerTron").replace("{remaining}", String(usage.tron.remaining))}`}</p>
          </div>
        </div>}
      <SystemInfoCard title={activeLicense ? t("system.track3Pro") : t("system.track3Free")}
        displayTitle={activeLicense ? undefined : t("system.track3Pro")} headingLevel={2}
        status={{ label: !activeLicense ? t("fidelity.b.pro.free") : expired ? t("fidelity.b.pro.expired")
          : subInfoLoading ? t("common.loading")
            : subscriptionInfo ? subscriptionStatusLabel(subscriptionInfo.status) : t("system.legacyLabel"),
          value: !activeLicense ? null : expired ? "canceled" : subscriptionInfo?.status ?? null }}
        description={activeLicense
          ? subInfoLoading ? t("common.loading") : subscriptionInfo?.isLegacy
            ? t("system.legacyNote") : subscriptionInfo ? subscriptionSummary(subscriptionInfo, t, locale)
              : t("system.proStatus.legacy") : undefined}
        headerDetails={<div className="fidelity-b-pro-details">
          <div className="fidelity-b-pro-kpis">
            <div><span>{t("fidelity.b.pro.plan")}</span><strong>{activeLicense
              ? subscriptionInfo?.planType === "monthly" ? t("fidelity.b.pro.monthlyPlan")
                : subscriptionInfo?.planType === "yearly" ? t("fidelity.b.pro.yearlyPlan")
                  : t("fidelity.b.pro.legacyPlan") : t("fidelity.b.pro.free")}</strong></div>
            <div><span>{t(expired ? "fidelity.b.pro.expired" : "fidelity.b.pro.renews")}</span>
              <strong>{activeLicense ? endText : "—"}</strong></div>
            <div><span>{t("fidelity.b.pro.devices")}</span>
              <strong>{deviceCount === undefined ? "—" : `${deviceCount} of ${deviceLimit}`}</strong></div>
          </div>
          <p className="fidelity-b-pro-summary">{!activeLicense ? t("fidelity.b.pro.freeSummary")
            : expired ? t(daysExpired === 0 ? "fidelity.b.pro.expiredSummaryToday"
              : daysExpired === 1 ? "fidelity.b.pro.expiredSummaryOne" : "fidelity.b.pro.expiredSummaryDays")
              .replace("{days}", String(daysExpired))
              : end && !subscriptionInfo?.isLegacy
                ? t("fidelity.b.pro.renewSummary").replace("{date}", endText)
                : t("system.legacyNote")}</p>
          <dl className="fidelity-b-pro-dl">
            <div><dt>{t("fidelity.b.pro.billing")}</dt><dd>{!activeLicense ? "—"
              : subscriptionInfo?.planType === "monthly" ? t(expired ? "fidelity.b.pro.monthlyNotRenewed" : "fidelity.b.pro.monthlyBilling")
                : subscriptionInfo?.planType === "yearly" ? t(expired ? "fidelity.b.pro.yearlyNotRenewed" : "fidelity.b.pro.yearlyBilling") : "—"}</dd></div>
            <div><dt>{t("fidelity.b.pro.memberSince")}</dt><dd>—</dd></div>
            <div><dt>{t(expired ? "fidelity.b.pro.lastPeriod" : "fidelity.b.pro.period")}</dt><dd>{end ? t("fidelity.b.pro.until").replace("{date}", endText) : "—"}</dd></div>
          </dl>
        </div>}
        action={activeLicense && !subInfoLoading && !subscriptionInfo?.isLegacy &&
          <div className="fidelity-b-pro-actions"><Button onClick={onManageSubscription} disabled={portalLoading}
            aria-label={t("system.manageSub")}>{t("fidelity.b.pro.manage")}</Button></div>}
        version={version} t={t}>
        {!subInfoLoading && <section className="fidelity-b-card fidelity-b-pro-benefits">
          <h2>{t("fidelity.b.pro.benefits")}</h2>
          <div>{benefits.map(([name, detail]) => <div className="fidelity-b-pro-benefit" key={name}>
            <span className={activeLicense && !expired ? "is-positive" : ""} aria-hidden="true">
              <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {activeLicense && !expired
                  ? <path d="M3.5 9.5l3.5 3.5 7.5-8" />
                  : <><rect x="4" y="8" width="10" height="7" rx="1.5" /><path d="M6 8V6a3 3 0 0 1 6 0v2" /></>}
              </svg>
            </span>
            <div><strong>{t(name)}</strong><small>{t(detail)}</small></div>
          </div>)}</div>
        </section>}
        {usage && <section className="fidelity-b-card fidelity-b-pro-usage">
          <div className="fidelity-b-card-head"><div><h3>{t("system.usage.heading")}</h3>
            <p>{t("fidelity.b.pro.usageHint")}</p></div>
            </div>
          <ProUsageRows usage={usage} enforced={usageEnforced} t={t} locale={locale} compact />
        </section>}
        <section className="fidelity-b-card fidelity-b-pro-license">
          <div className="fidelity-b-card-head"><div>
            <h2>{t("fidelity.b.pro.license")}</h2>
            <p>{t("fidelity.b.pro.licenseHint")}</p></div></div>
          {!activeLicense && <h3 className="sr-only">{t("system.checkout.restore")}</h3>}
          <label htmlFor="license">{t("fidelity.b.pro.key")}</label>
          <div className="fidelity-b-pro-keyrow">
            <div className="ios-d3-license-field fidelity-b-pro-keyinput">
              <Input id="license" aria-label={activeLicense ? t("system.licensePlaceholder") : t("system.checkout.restore")}
                autoComplete="off" value={inputLicense ?? ""} type={showLicense ? "text" : "password"}
                onChange={(e) => setInputLicense(e.target.value)}
                placeholder={t("fidelity.b.pro.keyPlaceholder")} disabled={!!activeLicense} />
              {activeLicense && !showLicense && <span className="fidelity-b-pro-keymask" aria-hidden="true">
                {activeLicense.length > 9 ? `${activeLicense.slice(0, 4)}-••••-••••-••••-${activeLicense.slice(-4)}` : "••••••••"}
              </span>}
              <button type="button" onClick={() => setShowLicense(!showLicense)}
                aria-label={t(showLicense ? "settings.assistant.hideKey" : "settings.assistant.showKey")}>
                {showLicense ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
            {activeLicense ? <Button variant="outline" onClick={() => void loadSubscriptionInfo()}>{t("fidelity.b.pro.verify")}</Button>
              : <Button onClick={onSaveLicenseClick} disabled={saveLicenseLoading || !inputLicense}>
                {saveLicenseLoading ? t("fidelity.b.pro.activating") : t("fidelity.b.pro.verify")}</Button>}
          </div>
          <p className={`fidelity-b-pro-key-result ${activeLicense && !expired ? "is-positive" : expired ? "is-warning" : ""}`}>
            {activeLicense ? expired ? t("fidelity.b.pro.keyExpired")
              : t("fidelity.b.pro.keyValid") : t("fidelity.b.pro.slotHint")}</p>
          <dl className="fidelity-b-pro-dl">
            <div><dt>{t("fidelity.b.pro.deviceSlots")}</dt><dd>{deviceCount === undefined ? "—"
              : `${deviceCount} of ${deviceLimit} ${t("fidelity.b.pro.used")}`}</dd></div>
            <div><dt>{t("fidelity.b.pro.activated")}</dt><dd>{licenseDevices?.devices.find((device) => device.current)
              ? formatDate(new Date(licenseDevices.devices.find((device) => device.current)!.activatedAt)) : "—"}</dd></div>
          </dl>
        </section>
        {activeLicense && licenseDevices
          ? <section className="fidelity-b-pro-device-card">
            <ProLicenseDevices value={licenseDevices} locale={locale} t={t} />
            <div className="fidelity-b-pro-deactivate">{deactivate}</div>
          </section>
          : <section className="fidelity-b-card fidelity-b-pro-no-devices">
            {t("fidelity.b.pro.noDevices")}
          </section>}
        {activeLicense && !licenseDevices && <div className="fidelity-b-pro-deactivate">{deactivate}</div>}
      </SystemInfoCard>
      <p className="fidelity-b-pro-ios-note">{t("system.checkout.iosNote")}</p>
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium tracking-tight">{t("system.title")}</h3>
        <p className="text-sm text-muted-foreground">{t("system.subtitle")}</p>
      </div>

      {showPurchaseUI && checkoutPhase !== "idle" && (
        <Card className="overflow-hidden">
          <CardContent className="space-y-3 p-6 text-sm" role="status">
            <p className="font-medium">{t(`system.checkout.${checkoutPhase}`)}</p>
            {checkoutPhase === "error" && checkoutError && <p>{checkoutError}</p>}
            {(checkoutPhase === "starting" || checkoutPhase === "waiting" || checkoutPhase === "timed-out" || checkoutPhase === "error") && (
              <div className="flex flex-wrap gap-2">
                {checkoutPhase !== "starting" && <Button variant="outline" onClick={() => checkoutRef.current?.checkAgain()}>{t("system.checkout.checkAgain")}</Button>}
                <Button variant="outline" onClick={onCancelCheckout}>{t("common.cancel")}</Button>
              </div>
            )}
            {(checkoutPhase === "completed" || checkoutPhase === "expired") &&
              <Button variant="outline" onClick={() => checkoutRef.current?.dismiss()}>{t("common.close")}</Button>}
          </CardContent>
        </Card>
      )}

      <SystemInfoCard
        title={activeLicense ? t("system.track3Pro") : t("system.track3Free")}
        headingLevel={isIOS() ? 2 : 3}
        status={activeLicense && !subInfoLoading && subscriptionInfo
          ? { label: subscriptionStatusLabel(subscriptionInfo.status), value: subscriptionInfo.status }
          : undefined}
        description={activeLicense
          ? subInfoLoading
            ? t("common.loading")
            : subscriptionInfo?.isLegacy
              ? t("system.legacyNote")
              : subscriptionInfo
                ? subscriptionSummary(subscriptionInfo, t, locale)
                : t("system.proStatus.legacy")
          : t("system.proStatus.subPrompt")}
        action={showPurchaseUI && isSubscribed && <Button onClick={onManageSubscription} disabled={portalLoading}>{t("system.manageSub")}</Button>}
        version={version}
        t={t}
        footerAction={activeLicense && !subInfoLoading && <ConfirmDeleteDialog
          trigger={<Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-red-400/50 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-400" disabled={inactiveLicenseLoading}>
            {inactiveLicenseLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
            {t("system.inactivateLicense")}
          </Button>}
          title={t("system.inactivateTitle")}
          description={t(isIOS() || subscriptionInfo?.isLegacy ? "system.inactivateDescLegacy" : "system.inactivateDesc")}
          cancelLabel={t("common.cancel")}
          actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]}
        />}
      >
        {activeLicense ? subscriptionInfo?.usage || subscriptionInfo?.isLegacy ? <>
          {subscriptionInfo?.usage && <ProUsageRows usage={subscriptionInfo.usage} enforced={usageEnforced} t={t} locale={locale} />}
          {subscriptionInfo?.isLegacy && <div className={`flex flex-wrap items-center gap-2 p-6 ${subscriptionInfo.usage ? "border-t" : ""}`}>
            <Input id="license" autoComplete="off" value={inputLicense ?? ""}
              type={showLicense ? "text" : "password"} onChange={(e) => setInputLicense(e.target.value)}
              placeholder={t("system.licensePlaceholder")} className="w-full max-w-[520px]" disabled={!!activeLicense} />
            <Button variant="ghost" size="icon" onClick={() => setShowLicense(!showLicense)}
              className={activeLicense || inputLicense ? "" : "hidden"}>
              <img className="view-or-hide-icon dark:invert" src={showLicense ? ViewIcon : HideIcon}
                alt="view-or-hide" width={18} height={18} />
            </Button>
          </div>}
        </> : null : <>
          {showPurchaseUI && <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="font-semibold">{t("system.upgrade")}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{t("system.upgradeDesc")}</p>
              </div>
              <Button variant="outline" onClick={onViewBenefits}>{t("system.viewBenefits")}</Button>
            </div>
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <div className="flex h-full flex-col gap-3 rounded-lg border p-4" data-testid="monthly-plan-card">
                <div className="text-sm font-medium">{t("system.monthly")}</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {formatPlanPrice(monthlyPlan)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                </div>
                <div className="mt-auto"><Button className="w-full" onClick={() => onSubscribe("monthly")}
                  disabled={!monthlyPlan || checkoutPhase === "starting" || checkoutPhase === "waiting"}>{t("system.subMonthly")}</Button></div>
              </div>
              <div className="relative flex h-full flex-col gap-3 rounded-lg border border-primary p-4" data-testid="yearly-plan-card">
                {yearlySavingsLabel && <div className="absolute -top-2 right-3">
                  <span className="t3-tag" data-tone="accent">{yearlySavingsLabel}</span>
                </div>}
                <div className="text-sm font-medium">{t("system.yearly")}</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {formatPlanPrice(yearlyPlan)}<span className="text-sm font-normal text-muted-foreground">/yr</span>
                </div>
                <div className="mt-auto"><Button className="w-full" onClick={() => onSubscribe("yearly")}
                  disabled={!yearlyPlan || checkoutPhase === "starting" || checkoutPhase === "waiting"}>{t("system.subYearly")}</Button></div>
              </div>
            </div>
          </div>}
          <div className={`${showPurchaseUI ? "border-t " : ""}p-6`}>
            <button type="button" className="flex w-full items-center justify-between text-left text-sm font-medium"
              aria-expanded={showLegacyInput} onClick={() => setShowLegacyInput(!showLegacyInput)}>
              {t("system.checkout.restore")}
              <span className="text-xs" aria-hidden="true">{showLegacyInput ? "▲" : "▼"}</span>
            </button>
            {showLegacyInput && <div className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">{t("system.checkout.restoreHint")}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Input id="license" autoComplete="off" value={inputLicense ?? ""} type={showLicense ? "text" : "password"}
                  onChange={(e) => setInputLicense(e.target.value)} placeholder={t("system.licensePlaceholder")}
                  className="w-full max-w-[520px]" disabled={!!activeLicense} />
                <Button variant="ghost" size="icon" onClick={() => setShowLicense(!showLicense)} className={inputLicense ? "" : "hidden"}>
                  <img className="view-or-hide-icon dark:invert" src={showLicense ? ViewIcon : HideIcon} alt="view-or-hide" width={18} height={18} />
                </Button>
                <Button onClick={onSaveLicenseClick} disabled={saveLicenseLoading}>{t("system.activate")}</Button>
              </div>
            </div>}
          </div>
        </>}
      </SystemInfoCard>
      {activeLicense && licenseDevices && <ProLicenseDevices value={licenseDevices} locale={locale} t={t} />}
    </div>
  );

};

export default App;
