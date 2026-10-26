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
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
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
import { useToast } from "@/mobile/components/ui/use-toast";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { getVersion, trackEventWithClientID } from "@/utils/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/mobile/i18n";
import { redactSecrets } from "@/middlelayers/security/redact";
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
  const [version, setVersion] = useState<string>("0.1.0");
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
    void loadLicense().then(() => { if (current && !isIOS()) void checkoutRef.current?.resume(); });
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
          void trackEventWithClientID("subscription_checkout_completed").catch(() => {});
        }
        if (phase === "expired" || phase === "timed-out" || phase === "error") {
          void trackEventWithClientID(`subscription_checkout_${phase === "timed-out" ? "timed_out" : phase}`).catch(() => {});
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
    void trackEventWithClientID("subscription_subscribe_clicked", { planType }).catch(() => {});
    await checkoutRef.current?.start(planType);
  }

  function onCancelCheckout() {
    checkoutRef.current?.cancel();
    void trackEventWithClientID("subscription_checkout_cancelled").catch(() => {});
  }

  async function onManageSubscription() {
    setPortalLoading(true);
    try {
      void trackEventWithClientID("subscription_open_clicked").catch(() => {});
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
    await openUrl("https://track3.domc.me/");
  }

  function formatPeriodEnd(dateStr: string | null): string {
    if (!dateStr) return t("system.legacyLabel");
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function subscriptionStatusLabel(status: string | null): string {
    switch (status) {
      case "active":
        return t("system.statusActive");
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

  if (isIOS() && section === "about") return <div className="ios-d3-system-settings">
    <InsetGroup>
      <ListRow value={version}>{t("system.appVersion")}</ListRow>
    </InsetGroup>
    <p className="ios-d3-settings-note">{t("system.appVersionNote")}</p>
  </div>;

  if (isIOS() && section === "pro") return <div className="ios-d3-system-settings space-y-6">
    <InsetGroup>
      <ListRow value={activeLicense ? t("system.pro") : t("system.free")}>{t("system.proStatus")}</ListRow>
      {activeLicense && subscriptionInfo && subscriptionInfo.status !== "active" && <ListRow value={subscriptionStatusLabel(subscriptionInfo.status)}>{t("system.statusLabel")}</ListRow>}
      {activeLicense && subscriptionInfo?.planType && <ListRow value={t(subscriptionInfo.planType === "monthly" ? "system.monthly" : "system.yearly")}>{t("system.planLabel")}</ListRow>}
    </InsetGroup>
    {activeLicense && subscriptionInfo?.usage && <section><h2 className="ios-d3-section-heading">{t("system.usage.heading")}</h2><InsetGroup><div className="px-4 pb-4">
      <ProUsageRows usage={subscriptionInfo.usage} enforced={usageEnforced} t={t} locale={locale} />
    </div></InsetGroup></section>}
    {!activeLicense && <section>
      <h2 className="ios-d3-section-heading">{t("system.checkout.restore")}</h2>
      <div className="ios-d3-license-group">
        <div className="ios-d3-license-field">
          <Input id="license" aria-label={t("system.checkout.restore")} autoComplete="off" value={inputLicense ?? ""}
            type={showLicense ? "text" : "password"} onChange={(e) => setInputLicense(e.target.value)}
            placeholder={t("system.licensePlaceholder")} disabled={!!activeLicense} />
          <Button type="button" variant="ghost" size="icon" onClick={() => setShowLicense(!showLicense)}
            aria-label={t(showLicense ? "settings.assistant.hideKey" : "settings.assistant.showKey")}>
            {showLicense ? <EyeClosedIcon /> : <EyeOpenIcon />}
          </Button>
        </div>
      </div>
      {(!activeLicense || subscriptionInfo?.isLegacy) && <p className="ios-d3-settings-note">{t(activeLicense ? "system.legacyNote" : "system.checkout.iosRestoreHint")}</p>}
      <Button className="mt-4 w-full" onClick={onSaveLicenseClick} disabled={saveLicenseLoading || !inputLicense}>{t("system.activate")}</Button>
    </section>}
    <p className="ios-d3-settings-note">{t("system.checkout.iosNote")}</p>
    {activeLicense && !subscriptionInfo?.isLegacy && <InsetGroup><ListRow onClick={onManageSubscription}>{t("system.manageSub")}</ListRow></InsetGroup>}
    {activeLicense && <InsetGroup><ConfirmDeleteDialog
      trigger={<button type="button" className="ios-d3-license-deactivate" disabled={inactiveLicenseLoading}>{t("system.inactivate")}</button>}
      title={t("system.inactivateTitle")} description={t("system.inactivateDescLegacy")}
      cancelLabel={t("common.cancel")}
      actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]} /></InsetGroup>}
  </div>;

  return (
    <div className="space-y-6">
      {!section && <div>
        <h3 className="text-lg font-medium tracking-tight">{t("system.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("system.subtitle")}
        </p>
      </div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {section !== "pro" && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("system.appVersion")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{version}</div>
            <p className="text-xs text-muted-foreground">
              {t("system.appVersionNote")}
            </p>
          </CardContent>
        </Card>}
        {section !== "about" && <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("system.proStatus")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {activeLicense ? t("system.pro") : t("system.free")}
            </div>
            <p className="text-xs text-muted-foreground">
              {subInfoLoading
                ? t("common.loading")
                : activeLicense
                  ? subscriptionInfo
                    ? `${subscriptionStatusLabel(subscriptionInfo.status)}${subscriptionInfo.planType ? ` — ${subscriptionInfo.planType === "monthly" ? t("system.monthly") : t("system.yearly")}` : ""}`
                    : t("system.proStatus.legacy")
                  : t("system.proStatus.subPrompt")}
            </p>
            {activeLicense && <ProUsageRows usage={subscriptionInfo?.usage} enforced={usageEnforced} t={t} locale={locale} />}
          </CardContent>
        </Card>}
      </div>

      {section !== "about" && <>
      {!isIOS() && checkoutPhase !== "idle" && (
        <Card>
          <CardContent className="space-y-3 pt-6" role="status">
            <p>{t(`system.checkout.${checkoutPhase}`)}</p>
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
      {/* Active subscription details */}
      {isSubscribed && subscriptionInfo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("system.subscription")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t("system.planLabel")}</span>
                <p className="font-medium">
                  {subscriptionInfo.planType === "monthly"
                    ? t("system.monthly")
                    : t("system.yearly")}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">{t("system.statusLabel")}</span>
                <p className="font-medium">
                  {subscriptionStatusLabel(subscriptionInfo.status)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {subscriptionInfo.cancelAtPeriodEnd ? t("system.expires") : t("system.renews")}
                </span>
                <p className="font-medium">
                  {formatPeriodEnd(subscriptionInfo.currentPeriodEnd)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isIOS() && <Button
                variant="outline"
                onClick={onManageSubscription}
                disabled={portalLoading}
              >
                {t("system.manageSub")}
              </Button>}
              <ConfirmDeleteDialog
                trigger={
                  <Button
                    variant="destructive"
                    disabled={inactiveLicenseLoading}
                  >
                    {inactiveLicenseLoading && (
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("system.inactivate")}
                  </Button>
                }
                title={t("system.inactivateTitle")}
                description={t("system.inactivateDesc")}
                cancelLabel={t("common.cancel")}
                actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legacy license with active subscription-like info */}
      {activeLicense && subscriptionInfo?.isLegacy && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("system.proLicense")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("system.legacyNote")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="license"
                autoComplete="off"
                value={inputLicense ?? ""}
                type={showLicense ? "text" : "password"}
                onChange={(e) => setInputLicense(e.target.value)}
                placeholder={t("system.licensePlaceholder")}
                className="w-full max-w-[520px]"
                disabled={!!activeLicense}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowLicense(!showLicense)}
                className={activeLicense || inputLicense ? "" : "hidden"}
              >
                <img
                  className="view-or-hide-icon"
                  src={showLicense ? ViewIcon : HideIcon}
                  alt="view-or-hide"
                  width={18}
                  height={18}
                />
              </Button>
              <ConfirmDeleteDialog
                trigger={
                  <Button
                    variant="destructive"
                    disabled={inactiveLicenseLoading}
                  >
                    {inactiveLicenseLoading && (
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("system.inactivate")}
                  </Button>
                }
                title={t("system.inactivateTitle")}
                description={t("system.inactivateDescLegacy")}
                cancelLabel={t("common.cancel")}
                actions={[{ label: t("common.confirm"), onClick: onInactiveLicenseClick }]}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription plans — shown when no active license */}
      {!activeLicense && !isIOS() && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("system.upgrade")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("system.upgradeDesc")}
            </p>
            <Button variant="outline" onClick={onViewBenefits}>
              {t("system.viewBenefits")}
            </Button>
            <div className="grid items-stretch gap-4 sm:grid-cols-2">
              <div
                className="flex h-full flex-col gap-3 rounded-lg border p-4"
                data-testid="monthly-plan-card"
              >
                <div className="text-sm font-medium">{t("system.monthly")}</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {formatPlanPrice(monthlyPlan)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /mo
                  </span>
                </div>
                <div className="mt-auto">
                  <Button
                    className="w-full"
                    onClick={() => onSubscribe("monthly")}
                    disabled={!monthlyPlan || checkoutPhase === "starting" || checkoutPhase === "waiting"}
                  >
                    {t("system.subMonthly")}
                  </Button>
                </div>
              </div>
              <div
                className="relative flex h-full flex-col gap-3 rounded-lg border border-primary p-4"
                data-testid="yearly-plan-card"
              >
                {yearlySavingsLabel && (
                  <div className="absolute -top-2 right-3">
                    <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                      {yearlySavingsLabel}
                    </span>
                  </div>
                )}
                <div className="text-sm font-medium">{t("system.yearly")}</div>
                <div className="text-2xl font-semibold tracking-tight">
                  {formatPlanPrice(yearlyPlan)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /yr
                  </span>
                </div>
                <div className="mt-auto">
                  <Button
                    className="w-full"
                    onClick={() => onSubscribe("yearly")}
                    disabled={!yearlyPlan || checkoutPhase === "starting" || checkoutPhase === "waiting"}
                  >
                    {t("system.subYearly")}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legacy license key input — collapsed by default */}
      {!activeLicense && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              <button type="button" className="flex w-full items-center justify-between text-left" aria-expanded={showLegacyInput} onClick={() => setShowLegacyInput(!showLegacyInput)}>
                {t("system.checkout.restore")}
                <span className="text-xs" aria-hidden="true">{showLegacyInput ? "▲" : "▼"}</span>
              </button>
            </CardTitle>
          </CardHeader>
          {showLegacyInput && (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("system.checkout.restoreHint")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="license"
                  autoComplete="off"
                  value={inputLicense ?? ""}
                  type={showLicense ? "text" : "password"}
                  onChange={(e) => setInputLicense(e.target.value)}
                  placeholder={t("system.licensePlaceholder")}
                  className="w-full max-w-[520px]"
                  disabled={!!activeLicense}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowLicense(!showLicense)}
                  className={inputLicense ? "" : "hidden"}
                >
                  <img
                    className="view-or-hide-icon"
                    src={showLicense ? ViewIcon : HideIcon}
                    alt="view-or-hide"
                    width={18}
                    height={18}
                  />
                </Button>
                <Button
                  onClick={onSaveLicenseClick}
                  disabled={saveLicenseLoading}
                >{t("system.activate")}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      )}
      </>}
    </div>
  );
};

export default App;
