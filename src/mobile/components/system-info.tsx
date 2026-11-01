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
import { EyeOpenIcon, EyeClosedIcon, ReloadIcon } from "@radix-ui/react-icons";
import {
  activateLicenseOnDevice,
  clearLicenseCache,
  LicenseCenter,
  type SubscriptionPlan,
  type SubscriptionPlansResponse,
  type SubscriptionInfo,
} from "@/middlelayers/license";
import { CheckoutFlow, type CheckoutPhase } from "@/middlelayers/checkout";
import { ProUsageRows } from "@/components/pro-usage-rows";
import { SystemInfoCard, subscriptionSummary } from "@/components/system-info-card";
import { useToast } from "@/mobile/components/ui/use-toast";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { getVersion } from "@/utils/app";
import { trackCheckoutCompleted, trackCheckoutPhase, trackSubscribeClicked, trackCheckoutCancelled, trackOpenClicked } from "@/middlelayers/ui-state/telemetry";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/mobile/i18n";
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
    if (activeLicense) {
      loadSubscriptionInfo();
      void LicenseCenter.getInstance().getUsage().then((result) => {
        if (current) setUsageEnforced(result?.enforced === true);
      });
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

  if (isIOS() && section === "about") return <div className="ios-d3-system-settings">
    <InsetGroup>
      <ListRow value={version}>{t("system.appVersion")}</ListRow>
    </InsetGroup>
    <p className="ios-d3-settings-note ios-d3-version-note">{t("system.appVersionNote")}</p>
    <InsetGroup>
      <ListRow onClick={requestOnboardingReplay} data-testid="onboarding-replay">{t("onboarding.replay.action")}</ListRow>
    </InsetGroup>
  </div>;

  if (!licenseLoaded) return <div className={isIOS() ? "ios-d3-system-settings" : "space-y-6"}>
    {!isIOS() && <div>
      <h3 className="text-lg font-medium tracking-tight">{t("system.title")}</h3>
      <p className="text-sm text-muted-foreground">{t("system.subtitle")}</p>
    </div>}
    <SystemInfoCard title="Track3" headingLevel={isIOS() ? 2 : 3} description={t("common.loading")} version={version} t={t} />
  </div>;

  if (isIOS() && section === "pro") return <div className="ios-d3-system-settings space-y-4">
    <SystemInfoCard
      title={activeLicense ? t("system.track3Pro") : t("system.track3Free")}
      headingLevel={2}
      status={activeLicense && !subInfoLoading && subscriptionInfo
        ? { label: subscriptionStatusLabel(subscriptionInfo.status), value: subscriptionInfo.status }
        : undefined}
      description={activeLicense
        ? subInfoLoading ? t("common.loading") : subscriptionInfo?.isLegacy
          ? t("system.legacyNote") : subscriptionInfo
            ? subscriptionSummary(subscriptionInfo, t, locale) : t("system.proStatus.legacy")
        : undefined}
      action={activeLicense && !subInfoLoading && !subscriptionInfo?.isLegacy && <Button onClick={onManageSubscription} disabled={portalLoading}>{t("system.manageSub")}</Button>}
      version={version}
      t={t}
      footerAction={activeLicense && !subInfoLoading && <ConfirmDeleteDialog
        trigger={<Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive dark:border-red-400/50 dark:text-red-400 dark:hover:bg-red-400/10 dark:hover:text-red-400" disabled={inactiveLicenseLoading}>
          {inactiveLicenseLoading && <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />}
          {t("system.inactivateLicense")}
        </Button>}
        title={t("system.inactivateTitle")}
        description={t("system.inactivateDescLegacy")}
        cancelLabel={t("common.cancel")}
        actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]}
      />}
    >
      {activeLicense
        ? subscriptionInfo?.usage || subscriptionInfo?.isLegacy ? <>
            {subscriptionInfo?.usage && <><h3 className="sr-only">{t("system.usage.heading")}</h3><ProUsageRows usage={subscriptionInfo.usage} enforced={usageEnforced} t={t} locale={locale} /></>}
            {subscriptionInfo?.isLegacy && <div className={`p-6 ${subscriptionInfo.usage ? "border-t" : ""}`}>
              <div className="ios-d3-license-field flex w-full items-center rounded-[10px] bg-secondary pr-2">
                <Input id="license" aria-label={t("system.licensePlaceholder")} autoComplete="off" value={inputLicense ?? ""} type={showLicense ? "text" : "password"}
                  onChange={(e) => setInputLicense(e.target.value)} placeholder={t("system.licensePlaceholder")} disabled />
                <Button type="button" variant="ghost" size="icon" onClick={() => setShowLicense(!showLicense)}
                  aria-label={t(showLicense ? "settings.assistant.hideKey" : "settings.assistant.showKey")}>
                  {showLicense ? <EyeClosedIcon /> : <EyeOpenIcon />}
                </Button>
              </div>
            </div>}
          </> : null
        : <section className="space-y-4 p-6">
          <h3 className="text-sm font-semibold">{t("system.checkout.restore")}</h3>
          <div className="ios-d3-license-field flex w-full items-center rounded-[10px] bg-secondary pr-2">
            <Input id="license" aria-label={t("system.checkout.restore")} autoComplete="off" value={inputLicense ?? ""}
              type={showLicense ? "text" : "password"} onChange={(e) => setInputLicense(e.target.value)}
              placeholder={t("system.licensePlaceholder")} disabled={!!activeLicense} />
            <Button type="button" variant="ghost" size="icon" onClick={() => setShowLicense(!showLicense)}
              aria-label={t(showLicense ? "settings.assistant.hideKey" : "settings.assistant.showKey")}>
              {showLicense ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("system.checkout.iosRestoreHint")}</p>
          <Button className="w-full" onClick={onSaveLicenseClick} disabled={saveLicenseLoading || !inputLicense}>{t("system.activate")}</Button>
        </section>}
    </SystemInfoCard>
    <p className="ios-d3-settings-note">{t("system.checkout.iosNote")}</p>
  </div>;

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
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{yearlySavingsLabel}</span>
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
    </div>
  );

};

export default App;
