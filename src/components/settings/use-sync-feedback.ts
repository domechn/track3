import { createElement, useRef, useState, type ReactElement } from "react";
import { classifySyncError, type SyncConnectionResult } from "@/middlelayers/sync/settings";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { serializeSyncDiagnostics } from "@/middlelayers/sync/diagnostics";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";

type ShowToast = (options: {
  title?: string; description: string; variant?: "destructive";
  duration?: number; syncStatus?: "success" | "pending" | "error";
  action?: ToastActionElement;
}) => {
  dismiss: () => void;
};

export function waitForSyncResult(): Promise<void> {
  if (syncRuntime.status().sync.phase !== "syncing") return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = syncRuntime.subscribe(() => {
      if (syncRuntime.status().sync.phase === "syncing") return;
      setTimeout(() => {
        if (syncRuntime.status().sync.phase === "syncing") return;
        unsubscribe();
        resolve();
      }, 0);
    });
  });
}

export function useSyncFeedback(t: (key: string) => string, toast: ShowToast, desktopActions = false) {
  const [busy, setBusy] = useState<string>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const running = useRef(false);
  const pendingToast = useRef<{ dismiss: () => void }>();
  const lastError = useRef<{ message: string; dismiss: () => void }>();
  const currentAction = useRef<string>();

  function clearPending() {
    pendingToast.current?.dismiss();
    pendingToast.current = undefined;
  }

  function error(message: string, titleKey?: string) {
    setStatusMessage(undefined);
    clearPending();
    if (lastError.current?.message === message) lastError.current.dismiss();
    const action = currentAction.current;
    const diagnostics = syncRuntime.status().sync.diagnostics;
    const details = diagnostics ? `${message}\n${serializeSyncDiagnostics(diagnostics)}` : message;
    const actions: ReactElement = createElement("div", { className: "t3-sync-toast-actions" },
      createElement(ToastAction, { altText: t("startup.fidelity.copyDetails"), onClick: () => {
        void navigator.clipboard?.writeText(details);
      } }, t("startup.fidelity.copyDetails")),
      createElement(ToastAction, { altText: t("refresh.details"), onClick: () => {
        window.location.hash = "#/settings/sync";
      } }, t("refresh.details")));
    const shown = toast({
      title: t(titleKey ?? (action === "test" || action === "unlock" ? "sync.toast.connectionFailed"
        : action === "save" ? "sync.toast.settingsFailed"
        : action?.startsWith("rename-") ? "sync.toast.renameFailed"
        : action?.startsWith("conflict-") ? "sync.toast.conflictFailed"
        : action === "disable" ? "sync.toast.disableFailed"
        : action === "forget" ? "sync.toast.forgetFailed" : "sync.toast.failed")),
      description: message, variant: "destructive",
      syncStatus: "error", duration: 8000,
      action: desktopActions ? actions : undefined,
    });
    lastError.current = { message, dismiss: shown.dismiss };
  }

  function success(message: string, keepStatus = false, titleKey = "sync.toast.complete") {
    setStatusMessage(keepStatus ? message : undefined);
    lastError.current = undefined;
    clearPending();
    toast({ title: t(titleKey), description: message, syncStatus: "success", duration: 4000 });
  }

  function result(value: SyncConnectionResult, successMessage: string, keepStatus = false, titleKey?: string) {
    if (value === "ok") success(successMessage, keepStatus, titleKey);
    else error(t(`sync.connection.${value}`));
  }

  async function run(name: string, action: () => Promise<void>, failureKey?: string) {
    if (running.current) return;
    running.current = true;
    currentAction.current = name;
    setBusy(name);
    setStatusMessage(undefined);
    const pendingKey = name.startsWith("conflict-") ? "resolve"
      : name.startsWith("rename-") ? "save" : name;
    clearPending();
    pendingToast.current = toast({
      title: t(`sync.pending.${pendingKey}`), description: t("sync.toast.inProgress"),
      syncStatus: "pending", duration: Infinity,
    });
    try {
      await action();
    } catch (failure) {
      error(t(failureKey ?? `sync.connection.${classifySyncError(failure)}`));
    } finally {
      clearPending();
      running.current = false;
      currentAction.current = undefined;
      setBusy(undefined);
    }
  }

  return { busy, statusMessage, clearStatus: () => setStatusMessage(undefined), error, success, result, run };
}
