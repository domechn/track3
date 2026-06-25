import { useEffect, useState } from "react";
import {
  cleanLicense,
  getLicenseIfIsPro,
  saveLicense,
} from "@/middlelayers/configuration";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  clearLicenseCache,
  LicenseCenter,
  type SubscriptionPlan,
  type SubscriptionPlansResponse,
} from "@/middlelayers/license";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { getVersion, trackEventWithClientID } from "@/utils/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTranslation } from "@/i18n";

type SubscriptionInfo = {
  planType: "monthly" | "yearly" | null;
  status: "active" | "past_due" | "canceled" | "incomplete" | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  isLegacy: boolean;
};

const App = ({
  onProStatusChange,
}: {
  onProStatusChange: (active: boolean) => void;
}) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>("0.1.0");
  const [activeLicense, setActiveLicense] = useState<string | undefined>();
  const [inputLicense, setInputLicense] = useState<string | undefined>();
  const [showLicense, setShowLicense] = useState(false);
  const [saveLicenseLoading, setSaveLicenseLoading] = useState(false);
  const [inactiveLicenseLoading, setInactiveLicenseLoading] = useState(false);
  const [showLegacyInput, setShowLegacyInput] = useState(false);

  // subscription states
  const [subscriptionInfo, setSubscriptionInfo] =
    useState<SubscriptionInfo | null>(null);
  const [subInfoLoading, setSubInfoLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscriptionPlans, setSubscriptionPlans] =
    useState<SubscriptionPlansResponse | null>(null);

  useEffect(() => {
    loadVersion();
    loadLicense();
    loadSubscriptionPlans();
  }, []);

  useEffect(() => {
    if (activeLicense) {
      loadSubscriptionInfo();
    } else {
      setSubscriptionInfo(null);
    }
  }, [activeLicense]);

  function loadVersion() {
    getVersion().then(setVersion);
  }

  function loadLicense() {
    getLicenseIfIsPro().then((license) => {
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
    const validRes = await LicenseCenter.getInstance().validateLicense(license);
    if (!validRes.isValid) {
      throw new Error(t("system.invalidLicenseKey"));
    }
    const activeRes = await LicenseCenter.getInstance().activeLicense(license);
    if (!activeRes.success) {
      throw new Error(activeRes.error ?? t("system.activeLicenseFailed"));
    }
    await saveLicense(license);
    clearLicenseCache();
    onProStatusChange(true);
  }

  function onSaveLicenseClick() {
    if (!inputLicense) {
      return;
    }
    setSaveLicenseLoading(true);
    activeDevice(inputLicense)
      .then(() => {
        setActiveLicense(inputLicense);
        toast({
          description: t("system.licenseSaved"),
        });
      })
      .catch((err) => {
        toast({
          description: err.message,
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
          description: err.message,
          variant: "destructive",
        });
      })
      .finally(() => {
        setInactiveLicenseLoading(false);
      });
  }

  async function onSubscribe(planType: "monthly" | "yearly") {
    /*
    setSubLoading(true);
    try {
      const { sessionId, url } =
        await LicenseCenter.getInstance().createCheckoutSession(planType);
      await openUrl(url);

      const license = await pollForLicense(sessionId);
      await activeDevice(license);
      setActiveLicense(license);
      toast({ description: "Pro subscription activated!" });
    } catch (err) {
      toast({
        description: err instanceof Error ? err.message : "Subscription failed",
        variant: "destructive",
      });
    } finally {
      setSubLoading(false);
    }
    */

    await trackEventWithClientID("subscription_subscribe_clicked", {
      planType,
    });
    toast({
      description:
        t("system.subNotSupported"),
    });
  }

  /*
  async function pollForLicense(
    sessionId: string,
    maxAttempts = 100,
  ): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
      const result =
        await LicenseCenter.getInstance().getCheckoutStatus(sessionId);
      if (result.status === "completed" && result.license) {
        return result.license;
      }
      if (result.status === "expired") {
        throw new Error("Checkout session expired. Please try again.");
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error(
      "Payment verification timed out. Your license may still be processing — check back in a moment.",
    );
  }
  */

  async function onManageSubscription() {
    setPortalLoading(true);
    try {
      await trackEventWithClientID("subscription_open_clicked");
      const { url } = await LicenseCenter.getInstance().getCustomerPortalUrl();
      await openUrl(url);
    } catch (err) {
      toast({
        description:
          err instanceof Error ? err.message : t("system.openPortalFailed"),
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
    return (
      subscriptionPlans?.plans.find((plan) => plan.planType === planType) ??
      null
    );
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium tracking-tight">{t("system.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("system.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
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
        </Card>
        <Card>
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
          </CardContent>
        </Card>
      </div>

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
              <Button
                variant="outline"
                onClick={onManageSubscription}
                disabled={portalLoading}
              >
                {t("system.manageSub")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={inactiveLicenseLoading}
                  >
                    {inactiveLicenseLoading && (
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("system.inactivate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("system.inactivateTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("system.inactivateDescLegacy")}
                      This does not cancel your Stripe subscription.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onInactiveLicenseClick}>
                      {t("common.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={inactiveLicenseLoading}
                  >
                    {inactiveLicenseLoading && (
                      <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("system.inactivate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("system.inactivateTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("system.inactivateDescLegacy")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onInactiveLicenseClick}>
                      {t("common.confirm")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subscription plans — shown when no active license */}
      {!activeLicense && (
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
                    disabled={!monthlyPlan}
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
                    disabled={!yearlyPlan}
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
          <CardHeader
            className="pb-2 cursor-pointer"
            onClick={() => setShowLegacyInput(!showLegacyInput)}
          >
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
              {t("system.legacyInputTitle")}
              <span className="text-xs">{showLegacyInput ? "▲" : "▼"}</span>
            </CardTitle>
          </CardHeader>
          {showLegacyInput && (
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t("system.legacyInputDesc")}
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
    </div>
  );
};

export default App;
