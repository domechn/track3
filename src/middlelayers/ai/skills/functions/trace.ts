// Dev-only debug tracing for the AI skills system.
// Active when Vite dev server is running (import.meta.env.DEV === true).
// Logs to browser DevTools console with the [skill-trace] prefix.
// In production (import.meta.env.PROD) all calls are no-ops.

function isDevEnv(): boolean {
  try {
    return (
      typeof import.meta !== "undefined" &&
      typeof (import.meta as unknown as { env?: Record<string, unknown> }).env !== "undefined" &&
      ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true ||
        (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === "development")
    );
  } catch {
    return false;
  }
}

 const isDev = /* @__PURE__ */ isDevEnv();

/** Log a trace message. No-op in production. */
export function trace(...args: unknown[]): void {
  if (!isDev) return;
  console.log("[skill-trace]", ...args);
}

/** Log a warning trace message. No-op in production. */
export function traceWarn(...args: unknown[]): void {
  if (!isDev) return;
  console.warn("[skill-trace:warn]", ...args);
}

/** Log an error trace message. No-op in production — does NOT surface error details to the browser console. */
export function traceError(msg: string, err?: unknown): void {
  if (!isDev) return;
  console.error("[skill-trace:error]", msg, err ?? "");
}
