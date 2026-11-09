import { useEffect, useState } from "react";
import { BellIcon, CheckIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import { queryLastAssetsBySymbol } from "@/middlelayers/charts-assets";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/mobile/i18n";
import ActionCard, { actionFieldKeys } from "@/components/assistant/action-card";

const usd = (value: number, fractionDigits = 2) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits,
}).format(value);

export default function PhoneActionCard({ action, onDecide, canDecide = true }: {
  action: PendingAction;
  onDecide?: (id: string, decision: "approve" | "reject") => void;
  canDecide?: boolean;
  baseCurrency?: CurrencyRateDetail;
}) {
  const { t } = useTranslation();
  const [currentAsset, setCurrentAsset] = useState<{ symbol: string; assetType?: string; price: number }>();
  const [expired, setExpired] = useState(() => Date.now() >= Date.parse(action.expiresAt));
  useEffect(() => {
    const remaining = Date.parse(action.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [action.expiresAt]);
  const symbol = String(action.args.symbol ?? "");
  const threshold = Number(action.args.threshold);
  const assetType = action.args.assetType === "crypto" || action.args.assetType === "stock"
    ? action.args.assetType : undefined;
  const price = currentAsset?.symbol === symbol && currentAsset.assetType === assetType ? currentAsset.price : undefined;
  useEffect(() => {
    if (action.name !== "create_alert" || action.args.kind !== "asset_price_target" ||
      action.args.comparator !== "gte" || !symbol) return;
    let active = true;
    void queryLastAssetsBySymbol(symbol, undefined, assetType).then((asset) => {
      if (active && asset && Number.isFinite(asset.price)) setCurrentAsset({ symbol, assetType, price: asset.price });
    }).catch(() => {});
    return () => { active = false; };
  }, [action.name, action.args.kind, action.args.comparator, symbol, assetType]);
  if (action.name !== "create_alert" || action.args.kind !== "asset_price_target" ||
    action.args.comparator !== "gte" || !symbol || !Number.isFinite(threshold) || threshold <= 0) {
    return <ActionCard action={action} onDecide={onDecide} canDecide={canDecide} />;
  }
  const pending = action.status === "pending" && !expired;
  const approved = action.status === "approved";
  const currentPrice = price === undefined ? undefined : usd(price);
  const metadata = Object.entries(action.args).filter(([field]) => ["assetType", "enabled"].includes(field));
  return <section aria-label={t("assistant.action.confirmation")} className={`fidelity-action-card${approved ? " is-approved" : ""}`}>
    <div className="fidelity-action-head">
      {approved ? <CheckIcon aria-hidden="true" /> : <BellIcon aria-hidden="true" />}
      <span>{t(approved ? "fidelity.assistant.alertCreated" : "fidelity.assistant.approvalNeeded")}</span>
      <span className={`fidelity-action-status${approved ? " is-approved" : ""}`}>
        {t(approved ? "fidelity.assistant.approved" : pending ? "fidelity.assistant.waiting" : "assistant.action.status.expired")}
      </span>
    </div>
    <h3>{t("fidelity.assistant.createAlert").replace("{symbol}", symbol).replace("{threshold}", usd(threshold, Number.isInteger(threshold) ? 0 : 2))}</h3>
    <div className="fidelity-action-summary">
      <p className="fidelity-action-label">{t("fidelity.assistant.whatChanges")}</p>
      {metadata.length > 0 && <p className="fidelity-action-meta">{metadata.map(([field, value]) =>
        <span key={field}>{typeof value === "boolean" ? t(value ? "goals.enabled" : "finance.paused")
          : <><b>{t(actionFieldKeys[field])}</b> {String(value)}</>}</span>)}</p>}
    </div>
    <dl>
      <div><dt>{t("fidelity.assistant.adds")}</dt><dd>{t("fidelity.assistant.oneRule")}</dd></div>
      <div><dt>{t("fidelity.assistant.condition")}</dt><dd>{t("fidelity.assistant.assetPriceTarget").replace("{symbol}", symbol).replace("{threshold}", usd(threshold, Number.isInteger(threshold) ? 0 : 2))}</dd></div>
      {Object.entries(action.args).filter(([field]) =>
        !["kind", "symbol", "threshold", "comparator", "assetType", "enabled"].includes(field)).map(([field, value]) => {
        const label = actionFieldKeys[field] ? t(actionFieldKeys[field]) : field;
        const unit = /\s*[（(](?:seconds|秒)[）)]$/.exec(label)?.[0];
        const hours = unit && typeof value === "number" && value >= 3600 && value % 3600 === 0
          ? value / 3600 : undefined;
        return <div key={field}><dt>{hours === undefined ? label : label.slice(0, -(unit?.length ?? 0))}</dt>
          <dd>{hours === undefined
            ? typeof value === "boolean" ? t(value ? "goals.enabled" : "finance.paused") : String(value)
            : t("fidelity.assistant.cooldownHours").replace("{count}", String(hours))}</dd></div>;
      })}
      {price !== undefined && <div><dt>{t("fidelity.assistant.rightNow")}</dt>
        <dd>{t("fidelity.assistant.progress").replace("{price}", currentPrice ?? "").replace("{percent}", (price / threshold * 100).toFixed(1))}</dd></div>}
    </dl>
    <p className="fidelity-action-note">{t("fidelity.assistant.actionNote")}</p>
    {pending ? <div className="fidelity-action-buttons">
      <button type="button" onClick={() => onDecide?.(action.id, "approve")} disabled={!canDecide || !onDecide}>
        <CheckIcon aria-hidden="true" />{t("assistant.action.approve")}
      </button>
      <button type="button" onClick={() => onDecide?.(action.id, "reject")} disabled={!canDecide || !onDecide}>
        {t("assistant.action.reject")}
      </button>
    </div> : approved ? <Link to="/goals" className="fidelity-action-open">
      {t("fidelity.assistant.openGoals")} <ChevronRightIcon aria-hidden="true" />
    </Link> : <p role="status">{t(`assistant.action.status.${action.status}`)}</p>}
  </section>;
}
