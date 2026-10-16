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

/** Log only the operation name; arguments may contain private portfolio data. */
export function trace(...args: unknown[]): void {
  if (!isDev) return;
  console.log("[skill-trace]", args[0]);
}

/** Log only the operation name. */
export function traceWarn(...args: unknown[]): void {
  if (!isDev) return;
  console.warn("[skill-trace:warn]", args[0]);
}
