import { CheckIcon, DesktopIcon, ExclamationTriangleIcon, ExternalLinkIcon, LaptopIcon, LockClosedIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import type { LicenseDevices, SubscriptionInfo } from "@/middlelayers/license";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";

type Props = {
  license?: string;
  inputLicense?: string;
  setInputLicense: (value: string) => void;
  subscriptionInfo: SubscriptionInfo | null;
  usageEnforced: boolean;
  devices?: LicenseDevices;
  saveLicenseLoading: boolean;
  activationError?: string;
  inactiveLicenseLoading: boolean;
  portalLoading: boolean;
  onSaveLicenseClick: () => void;
  onInactiveLicenseClick: () => void;
  onManageSubscription: () => void;
  onSubscribe: () => void;
  onViewBenefits: () => void;
};

function formatDate(value: string | null | undefined) {
  if (!value || Number.isNaN(Date.parse(value))) return "—";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function maskLicense(value: string) {
  const parts = value.split("-");
  return parts.length >= 5 ? `${parts[0]}-••••-••••-••••-${parts.at(-1)}` : "••••••••";
}

export function ProDesign(p: Props) {
  const { t } = useTranslation();
  const end = p.subscriptionInfo?.currentPeriodEnd;
  const expired = !!end && Date.parse(end) < Date.now();
  const active = !!p.license && !expired;
  const hasLicense = !!p.license;
  const current = p.devices?.devices.find((device) => device.current);
  const name = hasLicense ? t(p.subscriptionInfo?.planType === "monthly" ? "fidelity.settingsB.pro.planMonthly"
    : p.subscriptionInfo?.planType === "yearly" ? "fidelity.settingsB.pro.planYearly" : "fidelity.settingsB.pro.planPro")
    : t("fidelity.settingsB.pro.planFree");
  const quota = p.subscriptionInfo?.usage;
  const exhausted = !!quota?.erc20 && quota.erc20.used >= quota.erc20.limit;
  const slots = `${p.devices?.devices.length ?? 0} ${t("fidelity.settingsB.pro.of")} ${p.devices?.limit ?? 3}`;
  const resetDays = quota?.erc20?.periodEnd ? Math.ceil((Date.parse(quota.erc20.periodEnd) - Date.now()) / 86_400_000) : 0;
  const expiredDays = expired ? Math.floor((Date.now() - Date.parse(end!)) / 86_400_000) : 0;
  const devicesAfterDeactivate = Math.max(0, (p.devices?.devices.length ?? 0) - 1);
  const deactivate = (fallback = false) => <ConfirmDeleteDialog
    trigger={<button className="t3-b-button small t3-b-deactivate" disabled={p.inactiveLicenseLoading}>{t("fidelity.settingsB.pro.deactivateThis")}</button>}
    title={t("fidelity.settingsB.pro.deactivateTitle")} description={t("fidelity.settingsB.pro.deactivateBody")}
    contentClassName="t3-b-pro-deactivate-dialog"
    cancelLabel={t("common.cancel")} actions={[{ label: t("fidelity.settingsB.pro.deactivateThis"), onClick: p.onInactiveLicenseClick }]}>
      <ul>
        {!fallback && <li>{t(devicesAfterDeactivate === 1 ? "fidelity.settingsB.pro.deactivateSlotCount" : "fidelity.settingsB.pro.deactivateSlotCountMany")
          .replace("{count}", String(devicesAfterDeactivate)).replace("{limit}", String(p.devices?.limit ?? 3))}</li>}
        <li>{t("fidelity.settingsB.pro.deactivateData")}</li>
        <li>{t("fidelity.settingsB.pro.deactivateAgain")}</li>
      </ul>
    </ConfirmDeleteDialog>;

  const meter = (resource: "erc20" | "tron") => {
    const row = quota?.[resource];
    const used = hasLicense && row ? row.used : 0;
    const limit = row?.limit ?? 300;
    const remaining = Math.max(0, limit - used);
    const label = resource === "erc20" ? t("fidelity.settingsB.pro.erc20") : t("fidelity.settingsB.pro.tron");
    return <div className="t3-b-meter" key={resource}>
      <div className="t3-b-meter-head"><span>{label}</span><b>{hasLicense && row ? <>{used} <small>{t("fidelity.settingsB.pro.of")} {limit} · {remaining ? `${remaining} ${t("fidelity.settingsB.pro.left")}` : t("fidelity.settingsB.pro.limitReached")}</small></> : <small>{t("fidelity.settingsB.pro.unavailable")}</small>}</b></div>
      <div className="t3-b-meter-track"><i className={expired ? "expired" : used >= limit && active ? "full" : ""} style={{ width: `${Math.min(100, used / limit * 100)}%` }} /></div>
      <div className="t3-b-meter-scale"><span>0</span><span>{limit}</span></div>
    </div>;
  };

  return <div className="t3-b-pro t3-b-grid">
    {exhausted && <div className="t3-b-banner negative"><ExclamationTriangleIcon /><div><b>{t("fidelity.settingsB.pro.limitBanner")}</b><span>{t("fidelity.settingsB.pro.limitBannerDesc")}</span></div></div>}
    {expired && <div className="t3-b-banner warning"><ExclamationTriangleIcon /><div><b>{t("fidelity.settingsB.pro.expiredBannerDated").replace("{date}", formatDate(end))}</b><span>{t("fidelity.settingsB.pro.expiredBannerDesignDesc")}</span></div></div>}
    <section className="t3-b-card t3-b-pro-plan">
      <div className="t3-b-card-head"><h3>{t("fidelity.settingsB.pro.track3Pro")}</h3><span className="t3-tag" data-tone={active ? "positive" : expired ? "negative" : "neutral"}>{t(active ? "fidelity.settingsB.pro.active" : expired ? "fidelity.settingsB.pro.expired" : "fidelity.settingsB.pro.free")}</span></div>
      <div className="t3-b-kpis">
        <div><small>{t("fidelity.settingsB.pro.plan")}</small><strong>{name}</strong></div>
        <div><small>{t(expired ? "fidelity.settingsB.pro.expired" : "fidelity.settingsB.pro.renews")}</small><strong>{active || expired ? formatDate(end) : "—"}</strong></div>
        <div><small>{t("fidelity.settingsB.pro.devices")}</small><strong>{slots}</strong></div>
      </div>
      <p className="t3-b-pro-summary">{t(active ? p.subscriptionInfo?.cancelAtPeriodEnd ? "fidelity.settingsB.pro.cancelSummary" : "fidelity.settingsB.pro.activeSummary" : expired ? expiredDays === 0 ? "fidelity.settingsB.pro.expiredSummaryToday" : expiredDays === 1 ? "fidelity.settingsB.pro.expiredSummaryOneDay" : "fidelity.settingsB.pro.expiredSummaryDated" : "fidelity.settingsB.pro.freeSummary")
        .replace("{date}", formatDate(end)).replace("{days}", String(expiredDays))}</p>
      <dl className="t3-b-dl">
        {active || expired ? <>
          <dt>{t("fidelity.settingsB.pro.billing")}</dt><dd>{t(expired ? "fidelity.settingsB.pro.yearlyEnded" : "fidelity.settingsB.pro.yearlyBilling")}</dd>
          <dt>{t("fidelity.settingsB.pro.memberSince")}</dt><dd>{formatDate(current?.activatedAt)}</dd>
          <dt>{t(expired ? "fidelity.settingsB.pro.lastPeriod" : "fidelity.settingsB.pro.currentPeriod")}</dt><dd>{end ? `${formatDate(quota?.erc20?.periodStart)} ${t("fidelity.settingsB.pro.to")} ${formatDate(end)}` : "—"}</dd>
        </> : <>
          <dt>{t("fidelity.settingsB.pro.freeIncludes")}</dt><dd>{t("fidelity.settingsB.pro.freeAssets")}</dd>
          <dt>{t("fidelity.settingsB.pro.needsPro")}</dt><dd>{t("fidelity.settingsB.pro.proAssets")}</dd>
        </>}
      </dl>
      <div className="t3-b-plan-actions">
        {active ? <button className="t3-b-button" onClick={p.onManageSubscription} disabled={p.portalLoading}>{t("fidelity.settingsB.pro.manage")}</button>
          : <button className="t3-b-button primary" onClick={p.onSubscribe}>{t(expired ? "fidelity.settingsB.pro.subscribeAgain" : "fidelity.settingsB.pro.subscribe")}</button>}
        {expired ? <button className="t3-b-button" onClick={p.onManageSubscription} disabled={p.portalLoading}>{t("fidelity.settingsB.pro.manage")}</button>
          : !active && <button className="t3-b-button" onClick={p.onViewBenefits}><ExternalLinkIcon />{t("fidelity.settingsB.pro.compare")}</button>}
      </div>
    </section>
    <section className="t3-b-card t3-b-pro-benefits">
      <div className="t3-b-card-head"><h3>{t("fidelity.settingsB.pro.includes")}</h3></div>
      <div className="t3-b-benefit-list">
        {([
          ["erc20", "300Monthly"], ["tron", "300Monthly"], ["assistant", "assistantDetail"], ["insights", "optional"],
        ] as const).map(([item, detail]) => <div key={item}>
          {active ? <CheckIcon className="positive" /> : <LockClosedIcon />}
          <div><b>{t(`fidelity.settingsB.pro.${item}`)}</b><small>{t(`fidelity.settingsB.pro.${detail}`)}</small></div>
        </div>)}
      </div>
      <button className="t3-b-benefit-link" onClick={p.onViewBenefits}>track3.dev/#pro <ExternalLinkIcon /></button>
    </section>
    <section className="t3-b-card t3-b-pro-usage">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.pro.usage")}</h3><p>{t(active || expired ? "fidelity.settingsB.pro.usageDesc" : "fidelity.settingsB.pro.usageFreeDesc")}</p></div>
        <span className="t3-b-usage-stamp">{expired ? t("fidelity.settingsB.pro.frozenSince")
          .replace("{date}", new Date(end!).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }))
          : quota?.erc20?.periodEnd ? `${t("fidelity.settingsB.pro.resets")} ${formatDate(quota.erc20.periodEnd)}` : ""}</span></div>
      <div className="t3-b-stack">{meter("erc20")}{meter("tron")}</div>
      <div className="t3-b-usage-foot"><span>◷</span>{active && !exhausted && resetDays > 0
        ? t(resetDays === 1 ? "fidelity.settingsB.pro.resetIn" : "fidelity.settingsB.pro.resetInMany")
          .replace("{days}", String(resetDays))
        : t(expired ? "fidelity.settingsB.pro.expiredUsageNote" : exhausted ? "fidelity.settingsB.pro.exhaustedNote" : active ? "fidelity.settingsB.pro.usageNote" : "fidelity.settingsB.pro.freeNote")}</div>
    </section>
    <section className="t3-b-card t3-b-pro-license">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.pro.license")}</h3><p>{t("fidelity.settingsB.pro.licenseDesc")}</p></div></div>
      <label htmlFor="license" className="t3-b-label">{t("fidelity.settingsB.pro.key")}</label>
      <div className="t3-b-license-entry"><div className="t3-b-license-key"><input id="license" className="t3-b-input mono" autoComplete="off" type="text"
        value={hasLicense ? maskLicense(p.inputLicense ?? "") : p.inputLicense ?? ""} onChange={(event) => p.setInputLicense(event.target.value)} disabled={hasLicense || p.saveLicenseLoading}
        aria-invalid={!!p.activationError}
        placeholder="T3P-XXXX-XXXX-XXXX-XXXX" />{hasLicense && <CheckIcon aria-hidden="true" />}</div>
        <button className={`t3-b-button ${hasLicense ? "" : "primary"}`} onClick={p.onSaveLicenseClick} disabled={hasLicense || p.saveLicenseLoading}>
          {p.saveLicenseLoading && <ReloadIcon className="animate-spin" />}{p.saveLicenseLoading ? t("fidelity.settingsB.pro.activating") : t("fidelity.settingsB.pro.verify")}</button></div>
      <div className={`t3-b-result ${active ? "positive" : p.activationError ? "negative" : expired ? "warning" : ""}`}>{active ? <CheckIcon /> : <ExclamationTriangleIcon />}
        <span>{p.activationError || (expired ? t("fidelity.settingsB.pro.expiredKey").replace("{date}", formatDate(end))
          : active && current?.activatedAt
          ? t("fidelity.settingsB.pro.validKeyDated").replace("{plan}", name).replace("{date}", formatDate(current.activatedAt))
          : t(active ? "fidelity.settingsB.pro.validKey" : "fidelity.settingsB.pro.slotNote"))}</span></div>
      <dl className="t3-b-dl t3-b-license-meta">
        <dt>{t("fidelity.settingsB.pro.activated")}</dt><dd>{formatDate(current?.activatedAt)}</dd>
        <dt>{t("fidelity.settingsB.pro.lastVerified")}</dt><dd>—</dd>
        <dt>{t("fidelity.settingsB.pro.deviceSlots")}</dt><dd>{slots} {t("fidelity.settingsB.pro.used")}</dd>
      </dl>
    </section>
    <section className="t3-b-card t3-b-pro-devices">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.pro.devicesTitle")}</h3>{hasLicense && <p>{t("fidelity.settingsB.pro.devicesDesc")}</p>}</div>
        {hasLicense && <span className="t3-b-usage-stamp">{slots} {t("fidelity.settingsB.pro.used")}</span>}</div>
      {hasLicense && p.devices?.devices.length ? <>
        <div className="t3-b-dev-head"><span>{t("fidelity.settingsB.pro.device")}</span><span>{t("fidelity.settingsB.pro.system")}</span><span>{t("fidelity.settingsB.pro.activated")}</span><span>{t("fidelity.settingsB.pro.lastSeen")}</span><span /></div>
        {p.devices.devices.map((device) => <div className="t3-b-dev-row" key={device.id}>
          <div className="t3-b-device-identity"><span className="t3-b-device-platform">{device.platform === "macos" ? <LaptopIcon aria-hidden="true" /> : <DesktopIcon aria-hidden="true" />}</span><span><b>{t(device.platform ? `system.devices.platform.${device.platform}` : "system.devices.unknown")}</b>
            <small>{device.current ? t("fidelity.settingsB.pro.thisDevice") : device.id.slice(0, 8)}</small></span></div>
          <span>{device.appVersion ? `Track3 ${device.appVersion}` : "—"}</span><span>{formatDate(device.activatedAt)}</span>
          <span>{device.current ? t("fidelity.settingsB.pro.activeNow") : device.lastSeenAt ? formatDate(device.lastSeenAt) : t("system.devices.never")}</span>
          {device.current ? deactivate()
            : <span className="t3-b-remote-na">{t("fidelity.settingsB.pro.remoteUnavailable")}</span>}
        </div>)}
        {!current && deactivate(true)}
      </> : hasLicense ? <div className="t3-b-notice"><b>{t("fidelity.settingsB.pro.devicesUnavailable")}</b>{deactivate(true)}</div>
        : <div className="t3-b-notice"><b>{t("fidelity.settingsB.pro.noDevices")}</b>{t("fidelity.settingsB.pro.noDevicesDesc")}</div>}
    </section>
  </div>;
}
