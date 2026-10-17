import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import type { PendingAction } from "@/middlelayers/ai/actions/lifecycle";

export default function ActionCard({
  action, onDecide, canDecide = true,
}: {
  action: PendingAction;
  onDecide?: (id: string, decision: "approve" | "reject") => void;
  canDecide?: boolean;
}) {
  const { t } = useTranslation();
  const [expired, setExpired] = useState(() => Date.now() >= Date.parse(action.expiresAt));
  useEffect(() => {
    const remaining = Date.parse(action.expiresAt) - Date.now();
    setExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [action.expiresAt]);
  const pending = action.status === "pending" && !expired;
  const status = action.status === "pending" && expired ? "expired" : action.status;
  const preview = (value: string) => value.startsWith("assistant.action.") ? t(value, value) : value;

  return (
    <section aria-label={t("assistant.action.confirmation")} className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <h3 className="font-semibold">{t(`assistant.action.name.${action.name}`)}</h3>
      <p className="text-xs text-muted-foreground">{t("assistant.action.risk")}: {t(`assistant.action.risk.${action.risk}`)}</p>
      <dl className="mt-2 grid gap-1 text-xs">
        <div><dt className="inline font-medium">{t("assistant.action.before")}: </dt><dd className="inline break-all">{preview(action.preview.before)}</dd></div>
        <div><dt className="inline font-medium">{t("assistant.action.after")}: </dt><dd className="inline break-all">{preview(action.preview.after)}</dd></div>
      </dl>
      <p className="mt-2 text-xs font-medium">{t("assistant.action.arguments")}</p>
      <pre className="mt-1 overflow-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs">{JSON.stringify(action.args, null, 2)}</pre>
      {pending ? (
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" onClick={() => onDecide?.(action.id, "approve")} disabled={!canDecide || !onDecide}>{t("assistant.action.approve")}</Button>
          <Button type="button" size="sm" variant="outline" onClick={() => onDecide?.(action.id, "reject")} disabled={!canDecide || !onDecide}>{t("assistant.action.reject")}</Button>
        </div>
      ) : (
        <p role="status" className="mt-3 text-xs">{t(`assistant.action.status.${status}`)}{action.result ? `: ${preview(action.result)}` : ""}</p>
      )}
    </section>
  );
}
