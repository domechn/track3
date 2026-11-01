import { useEffect, useState } from "react";
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
const formatBytes = (bytes: number) => bytes >= 1_000_000
  ? `${(bytes / 1_000_000).toFixed(1)} MB`
  : bytes >= 1_000 ? `${(bytes / 1_000).toFixed(1)} KB` : `${bytes.toLocaleString()} B`;

export function SyncDetails({ report, diagnostics, t, ConfirmDialog = ConfirmDeleteDialog }: {
  report?: SyncReport;
  diagnostics?: SyncDiagnostics;
  t: (key: string, fallback?: string) => string;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
}) {
  const [busy, setBusy] = useState<{ id: string; choice: "local" | "remote" } | null>(null);
  const [available, setAvailable] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
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
      ? `${t(`sync.details.conflict.${kind}`)} ${shortId(id)}` : t("sync.details.conflict.other");
  });
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
  return <details className="border-t pt-2">
    <summary className="cursor-pointer font-medium">{t("sync.details.title")}</summary>
    <div className="mt-3 space-y-4 text-xs">
      <section className="space-y-1">
        <h3 className="font-semibold">{t("sync.details.errors")}</h3>
        {errors.size ? <ul className="list-inside list-disc space-y-1">
          {[...errors].map(([text, count]) => <li key={text} className="break-words">{safeError(text, t)} × {count}</li>)}
        </ul> : <p className="text-muted-foreground">{t("sync.details.none")}</p>}
      </section>
      <section className="space-y-2">
        <h3 className="font-semibold">{t("sync.details.conflicts")}</h3>
        {!conflicts.length && <p className="text-muted-foreground">{t("sync.details.none")}</p>}
        {config.filter((id) => available?.includes(id)).map((id) => <ConfigConflictChoices key={id} id={id} t={t} resolve={(key, choice) => void resolve(key, choice)}
          disabled={!!busy} pending={busy?.id === id ? busy.choice : undefined} ConfirmDialog={ConfirmDialog} />)}
        {config.filter((id) => available && !available.includes(id)).map((id) =>
          <p key={id} className="break-words">{t("sync.details.config")} {shortId(id)} · {t("sync.details.noResolution")}</p>)}
        {other.map((label, index) => <p key={index} className="break-words">{label} · {t("sync.details.noResolution")}</p>)}
      </section>
      {diagnostics && <>
        <section className="space-y-1">
          <h3 className="font-semibold">{t("sync.details.timings")}</h3>
          <table className="w-full text-left tabular-nums"><tbody>
            {syncPhases.map((phase) => <tr key={phase}><th className="py-0.5 font-normal">{t(`sync.details.phase.${phase}`)}</th>
              <td className="text-right">{Math.round(diagnostics.phases[phase])} ms</td></tr>)}
          </tbody></table>
          <p>{t("sync.details.wall")}: {Math.round(diagnostics.wallMs)} ms</p>
        </section>
        <section className="space-y-1">
          <h3 className="font-semibold">{t("sync.details.requests")}</h3>
          <div className="overflow-x-auto"><table className="w-full text-left tabular-nums"><thead><tr>
            <th>{t("sync.details.verb")}</th><th>{t("sync.details.count")}</th>
            <th>{t("sync.details.sent")}</th><th>{t("sync.details.received")}</th>
          </tr></thead><tbody>
            {(["GET", "PUT", "LIST", "DELETE", "HEAD"] as const).map((verb) => <tr key={verb}>
              <th className="font-normal">{verb}</th><td>{diagnostics.requests[verb].count.toLocaleString()}</td>
              <td>{formatBytes(diagnostics.requests[verb].bytesSent)}</td><td>{formatBytes(diagnostics.requests[verb].bytesReceived)}</td>
            </tr>)}
          </tbody></table></div>
          <details>
            <summary className="cursor-pointer font-medium">{t("sync.details.outcomes")}</summary>
            {(["GET", "PUT", "LIST", "DELETE", "HEAD"] as const).map((verb) =>
              <p key={verb} className="break-words">{verb}: {([
                "ok", "notModified", "notFound", "preconditionFailed", "conflict", "rateLimited", "serverError", "timeout", "retry", "otherError",
              ] as const).filter((outcome) => diagnostics.requests[verb].outcomes[outcome].count > 0).map((outcome) =>
                `${t(`sync.details.outcome.${outcome}`)} ${diagnostics.requests[verb].outcomes[outcome].count}`).join(" · ") || "0"}</p>)}
          </details>
          <p>{t("sync.details.retries")}: {diagnostics.retries} · {t("sync.details.retryWait")}: {Math.round(diagnostics.retryWaitMs)} ms · {t("sync.details.timeouts")}: {diagnostics.timeouts}</p>
          <p>{t("sync.details.state")}: {formatBytes(diagnostics.syncStateBytes)} · {t("sync.details.snapshots")}: {diagnostics.snapshots.toLocaleString()}</p>
          <p>{t("sync.details.entries")}: {diagnostics.entries.toLocaleString()} · {t("sync.details.known")}: {diagnostics.knownTokens.toLocaleString()}</p>
          <p>{t("sync.details.slowest")}: {diagnostics.slowest.map((item) =>
            `${item.verb} ${t(`sync.details.phase.${item.phase}`)} ${Math.round(item.ms)} ms`).join(", ") || "—"}</p>
          <p className="text-muted-foreground">{t("sync.details.bytesNote")}</p>
        </section>
        <Button size="sm" variant="outline" onClick={() => void copy()}>{t("sync.details.copy")}</Button>
      </>}
      {message && <p role="status">{message}</p>}
    </div>
  </details>;
}
