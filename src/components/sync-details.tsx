import { useEffect, useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { ConfigConflictChoices } from "@/components/sync-conflict-choices";
import { syncCategory } from "@/middlelayers/sync/config-keys";
import { serializeSyncDiagnostics, syncPhases, type SyncDiagnostics } from "@/middlelayers/sync/diagnostics";
import type { SyncReport } from "@/middlelayers/sync/engine";
import { syncRuntime } from "@/middlelayers/sync/runtime";

const fixedErrors: Record<string, string> = {
  "Failed to read sync manifest": "manifestRead",
  "Failed to recover config apply": "configRecovery",
  "Failed to read local config": "localConfigRead",
  "Failed to read remote snapshot": "remoteSnapshotRead",
  "Failed to read local snapshot": "localSnapshotRead",
  "Failed to apply tombstone object": "tombstoneApply",
  "Failed to apply snapshot edit": "editApply",
  "Failed to apply asset deletion": "assetDeletion",
  "Failed to apply config object": "configApply",
  "Failed to read local session": "sessionRead",
  "Failed to retain local session": "sessionRetain",
  "Failed to apply session deletion": "sessionDeletion",
  "Failed to apply session object": "sessionApply",
  "Immutable sync object changed": "immutableChanged",
  "Sync manifest is too large": "manifestTooLarge",
  "Failed to prune old sync object": "prune",
  "Failed to write sync manifest": "manifestWrite",
};
const objectError = /^Failed to (pull|push|verify) (snapshot|config|session|tombstone|session-delete|edit) object$/;
const safeError = (error: string, t: (key: string, fallback?: string) => string) => {
  if (fixedErrors[error]) return t(`sync.details.error.${fixedErrors[error]}`);
  const match = objectError.exec(error);
  return match
    ? t(`sync.details.error.${match[1]}`).replace("{kind}", t(`sync.details.kind.${match[2]}`))
    : t("sync.details.error.generic");
};
const shortId = (id: string) => `${id.slice(0, 8)}${id.length > 8 ? "…" : ""}`;
let rememberedDetailsExpanded: boolean | undefined;
export function SyncDefinitionRow({ label, value, total = false }: { label: ReactNode; value: ReactNode; total?: boolean }) {
  return <div className={`t3-sync-definition-row${total ? " t3-sync-definition-total" : ""}`}>
    <dt>{label}</dt><dd>{value}</dd>
  </div>;
}

export function SyncDetails({ report, diagnostics, t, summaryLabel, ConfirmDialog = ConfirmDeleteDialog, defaultExpanded = false, showConflicts = true, errorLabel }: {
  report?: SyncReport;
  diagnostics?: SyncDiagnostics;
  t: (key: string, fallback?: string) => string;
  summaryLabel?: string;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
  defaultExpanded?: boolean;
  showConflicts?: boolean;
  errorLabel?: string;
}) {
  const [busy, setBusy] = useState<{ id: string; choice: "local" | "remote" } | null>(null);
  const [available, setAvailable] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const panelId = useId();
  const [expanded, setExpanded] = useState(() => defaultExpanded || rememberedDetailsExpanded === true);
  useEffect(() => {
    if (!report?.conflicts.some((id) => !!syncCategory(id))) {
      setAvailable([]);
      return;
    }
    let active = true;
    setAvailable(null);
    void syncRuntime.configConflicts().then((conflicts) => {
      if (active) setAvailable(conflicts.map(({ id }) => id));
    }).catch(() => { if (active) setAvailable([]); });
    return () => { active = false; };
  }, [report]);
  if (!report && !diagnostics) return null;
  const locale = document.documentElement.lang || navigator.language;
  const number = (value: number) => value.toLocaleString(locale);
  const decimal = (value: number) => value.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const duration = (ms: number) => ms >= 1000 ? `${decimal(ms / 1000)} s` : `${number(Math.round(ms))} ms`;
  const bytes = (value: number) => value >= 1_000_000 ? `${decimal(value / 1_000_000)} MB`
    : value >= 1000 ? `${decimal(value / 1000)} KB` : `${number(value)} B`;
  const verbs = ["GET", "PUT", "LIST", "DELETE", "HEAD"] as const;
  const outcomes = ["ok", "notModified", "notFound", "preconditionFailed", "conflict",
    "rateLimited", "serverError", "timeout", "retry", "otherError"] as const;
  const failedOutcomes = ["preconditionFailed", "conflict", "rateLimited", "serverError", "timeout", "otherError"] as const;
  const totalRequests = diagnostics ? verbs.reduce((sum, verb) => sum + diagnostics.requests[verb].count, 0) : 0;
  const failures = diagnostics ? verbs.reduce((sum, verb) =>
    sum + failedOutcomes.reduce((count, outcome) => count + diagnostics.requests[verb].outcomes[outcome].count, 0), 0) : 0;
  const hasOutcomes = diagnostics && verbs.some((verb) => outcomes.some((outcome) => diagnostics.requests[verb].outcomes[outcome].count > 0));
  const sent = diagnostics ? verbs.reduce((sum, verb) => sum + diagnostics.requests[verb].bytesSent, 0) : 0;
  const received = diagnostics ? verbs.reduce((sum, verb) => sum + diagnostics.requests[verb].bytesReceived, 0) : 0;
  const errors = new Map<string, number>();
  for (const error of report?.errors ?? []) {
    const safe = fixedErrors[error] || objectError.test(error) ? error : "Sync operation failed";
    errors.set(safe, (errors.get(safe) ?? 0) + 1);
  }
  const conflicts = [...new Set(report?.conflicts ?? [])];
  const config = conflicts.filter((id) => !!syncCategory(id));
  const other = conflicts.filter((id) => !syncCategory(id)).map((conflict) => {
    const [kind, id] = conflict.split(":", 2);
    return ["snapshot", "edit", "session"].includes(kind) && id
      ? { label: t(`sync.details.conflict.${kind}`), id: shortId(id) }
      : { label: t("sync.details.conflict.other"), id: undefined };
  });
  const issueCount = report ? report.errors.length + conflicts.length : 0;
  async function resolve(id: string, choice: "local" | "remote") {
    if (busy) return;
    setBusy({ id, choice });
    setMessage("");
    try {
      await syncRuntime.resolveConfigConflict(id, choice);
      setAvailable((current) => current?.filter((item) => item !== id) ?? []);
    }
    catch { setMessage(t("sync.configConflict.failed")); }
    finally { setBusy(null); }
  }
  async function copy() {
    if (!diagnostics) return;
    try {
      await navigator.clipboard.writeText(serializeSyncDiagnostics(diagnostics));
      setMessage(t("sync.details.copied"));
    } catch { setMessage(t("sync.details.copyFailed")); }
  }
  return <div className="t3-sync-details">
    <button type="button" className="t3-sync-details-toggle" aria-expanded={expanded} aria-controls={panelId}
      aria-label={issueCount ? `${summaryLabel ?? t("sync.details.title")}, ${t(issueCount === 1 ? "sync.details.oneIssue" : "sync.details.issueCount").replace("{count}", number(issueCount))}` : undefined}
      onClick={() => {
        setExpanded(!expanded);
        rememberedDetailsExpanded = !expanded;
      }}>
      <ChevronDownIcon aria-hidden="true" />
      <span>{summaryLabel ?? t("sync.details.title")}</span>
      {issueCount > 0 &&
        <span className="t3-sync-details-badge" aria-hidden="true">
          {number(issueCount)}
        </span>}
    </button>
    {expanded && <div id={panelId} className="t3-sync-details-panel">
      <section className="t3-sync-details-section">
        <h3>{t("sync.details.errors")}</h3>
        {errorLabel && <p className="t3-sync-details-error">{errorLabel}</p>}
        {errors.size ? <ul className="t3-sync-details-list">
          {[...errors].map(([text, count]) => <li key={text}>{safeError(text, t)} × {number(count)}</li>)}
        </ul> : !errorLabel && <p className="t3-sync-details-empty">{t("sync.details.none")}</p>}
      </section>
      {showConflicts && <section className="t3-sync-details-section">
        <h3>{t("sync.details.conflicts")}</h3>
        {!conflicts.length && <p className="t3-sync-details-empty">{t("sync.details.none")}</p>}
        {config.filter((id) => available?.includes(id)).map((id) => <ConfigConflictChoices key={id} id={id} t={t} resolve={(key, choice) => void resolve(key, choice)}
          disabled={!!busy} pending={busy?.id === id ? busy.choice : undefined} ConfirmDialog={ConfirmDialog} />)}
        {config.filter((id) => available && !available.includes(id)).map((id) =>
          <p key={id} className="t3-sync-details-item">{t("sync.details.config")} <code>{shortId(id)}</code> · {t("sync.details.noResolution")}</p>)}
        {other.map(({ label, id }, index) => <p key={index} className="t3-sync-details-item">
          {label} {id && <code>{id}</code>} · {t("sync.details.noResolution")}
        </p>)}
      </section>}
      {diagnostics && <>
        <section className="t3-sync-details-section">
          <h3>{t("sync.details.timings")}</h3>
          <dl>{syncPhases.map((phase) => <SyncDefinitionRow key={phase} label={t(`sync.details.phase.${phase}`)}
            value={duration(diagnostics.phases[phase])} />)}
            <SyncDefinitionRow label={t("sync.details.wall")} value={duration(diagnostics.wallMs)} total />
          </dl>
        </section>
        <section className="t3-sync-details-section">
          <h3>{t("sync.details.requests")}</h3>
          <dl>
            <SyncDefinitionRow label={t("sync.details.totalRequests")} value={number(totalRequests)} />
            <SyncDefinitionRow label={t("sync.details.failures")} value={number(failures)} />
            <SyncDefinitionRow label={t("sync.details.retries")} value={number(diagnostics.retries)} />
            <SyncDefinitionRow label={t("sync.details.sentBytes")} value={bytes(sent)} />
            <SyncDefinitionRow label={t("sync.details.receivedBytes")} value={bytes(received)} />
          </dl>
          <h3>{t("sync.details.verb")}</h3>
          <dl>
            {verbs.map((verb) => <SyncDefinitionRow key={verb} label={verb} value={number(diagnostics.requests[verb].count)} />)}
            {verbs.flatMap((verb) => [
              diagnostics.requests[verb].bytesSent > 0 &&
                <SyncDefinitionRow key={`${verb}-sent`} label={`${verb} · ${t("sync.details.sent")}`} value={bytes(diagnostics.requests[verb].bytesSent)} />,
              diagnostics.requests[verb].bytesReceived > 0 &&
                <SyncDefinitionRow key={`${verb}-received`} label={`${verb} · ${t("sync.details.received")}`} value={bytes(diagnostics.requests[verb].bytesReceived)} />,
            ])}
          </dl>
          {hasOutcomes && <><h3>{t("sync.details.outcomes")}</h3>
          <dl>
            {verbs.flatMap((verb) => outcomes.filter((outcome) => diagnostics.requests[verb].outcomes[outcome].count > 0)
              .map((outcome) => <SyncDefinitionRow key={`${verb}-${outcome}`} label={`${verb} · ${t(`sync.details.outcome.${outcome}`)}`}
                value={number(diagnostics.requests[verb].outcomes[outcome].count)} />))}
          </dl></>}
          <h3>{t("sync.details.otherMeasures")}</h3>
          <dl>
            <SyncDefinitionRow label={t("sync.details.retryWait")} value={duration(diagnostics.retryWaitMs)} />
            <SyncDefinitionRow label={t("sync.details.timeouts")} value={number(diagnostics.timeouts)} />
            <SyncDefinitionRow label={t("sync.details.state")} value={bytes(diagnostics.syncStateBytes)} />
            <SyncDefinitionRow label={t("sync.details.snapshots")} value={number(diagnostics.snapshots)} />
            <SyncDefinitionRow label={t("sync.details.entries")} value={number(diagnostics.entries)} />
            <SyncDefinitionRow label={t("sync.details.known")} value={number(diagnostics.knownTokens)} />
          </dl>
          <h3>{t("sync.details.slowest")}</h3>
          {diagnostics.slowest.length ? <dl>{diagnostics.slowest.map((item, index) =>
            <SyncDefinitionRow key={index} label={`${item.verb} ${t(`sync.details.phase.${item.phase}`)}`}
              value={duration(item.ms)} />)}</dl> : <p className="t3-sync-details-empty">{t("sync.details.none")}</p>}
          <p className="t3-sync-details-note">{t("sync.details.bytesNote")}</p>
        </section>
        <Button size="sm" variant="outline" onClick={() => void copy()}>{t("sync.details.copy")}</Button>
      </>}
      {message && <p role="status">{message}</p>}
    </div>}
  </div>;
}
