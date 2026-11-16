import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";

type Gate = {
  state: "checking" | "ready" | "locked";
  reason?: string;
  detail?: "failed-retryable" | "failed-terminal" | "retrying";
};

// Best-effort: without a readable status the gate keeps the failure text and an enabled Retry.
async function lockedGate(failure: string): Promise<Gate> {
  let status: unknown = null;
  try { status = await invoke<unknown>("ios_startup_status"); } catch { /* status stays unknown */ }
  if (!status || typeof status !== "object") return { state: "locked", reason: failure };
  const { state, message, retryable } = status as { state?: unknown; message?: unknown; retryable?: unknown };
  return {
    state: "locked",
    reason: typeof message === "string" ? message : failure,
    detail: state === "retrying" ? "retrying"
      : state !== "failed" ? undefined
      : retryable === false ? "failed-terminal" : "failed-retryable",
  };
}

export default function IOSStartupGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [gate, setGate] = useState<Gate>({ state: isIOS() ? "checking" : "ready" });
  const state = gate.state;
  const retry = useCallback(() => {
    void (async () => {
      try {
        const failure = await invoke<string | null>("ios_startup_failure");
        if (!failure || await invoke<boolean>("ios_retry_startup")) setGate({ state: "ready" });
        else setGate(await lockedGate(failure));
      } catch {
        // Keep the portfolio locked while startup status is unknown.
      }
    })();
  }, []);

  useEffect(() => {
    if (!isIOS()) return;
    let active = true;
    void invoke<string | null>("ios_startup_failure")
      .then((failure) => failure ? lockedGate(failure) : { state: "ready" } as Gate)
      .then((next) => { if (active) setGate(next); })
      .catch(() => { if (active) setGate({ state: "locked" }); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (state !== "locked") return;
    const onFocus = () => { if (document.visibilityState !== "hidden") retry(); };
    const onVisibility = () => { if (document.visibilityState === "visible") retry(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state, retry]);

  if (state === "checking") return <div className="ios-d3-startup-check min-h-dvh bg-background" aria-busy="true" data-state="checking">
    <div aria-hidden="true" /><div aria-hidden="true" /><div aria-hidden="true" />
  </div>;
  if (state === "locked") return <main role="alert" data-state={gate.detail ?? "locked"} className="ios-d3-startup-lock flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
    <div className="ios-d3-lock-art" aria-hidden="true"><svg viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="45" fill="currentColor" opacity=".08" />
      <rect x="27" y="42" width="42" height="34" rx="9" stroke="currentColor" strokeWidth="3" />
      <path d="M35 42V31a13 13 0 0 1 26 0v11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="48" cy="58" r="3" fill="currentColor" />
    </svg></div>
    <h1 className="text-2xl font-semibold">{t("ios.startupLocked.title")}</h1>
    <p className="max-w-sm text-sm text-muted-foreground">{t("ios.startupLocked.message")}</p>
    {gate.reason && <p className="max-w-sm break-words text-sm text-muted-foreground">{gate.reason}</p>}
    <button className="min-h-11 rounded-lg bg-primary px-5 text-primary-foreground disabled:opacity-50" onClick={retry} disabled={gate.detail === "failed-terminal"}>{t("ios.startupLocked.retry")}</button>
  </main>;
  return <>{children}</>;
}
