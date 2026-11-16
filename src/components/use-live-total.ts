import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export type LiveTotalState = "idle" | "connecting" | "live" | "partial" | "stale" | "error" | "off";

type Snapshot = { state: LiveTotalState; value?: number; lastAt?: number; firstReveal: boolean;
  partial?: boolean; error?: string };
type Event =
  | { type: "reset"; value?: number; at?: number }
  | { type: "start" }
  | { type: "success"; value: number; at: number; live: boolean; stale?: boolean; partial?: boolean; reason?: string }
  | { type: "stale" }
  | { type: "error"; reason?: string }
  | { type: "off" };

// The one list of Live total reasons: the parser, the log text and the details view all read it.
export const LIVE_TOTAL_REASONS = ["rateLimited", "pricesMissing", "stockPricesMissing", "rateUnavailable",
  "ibkrToken", "partialSource", "unknown"] as const;
export type LiveTotalReason = typeof LIVE_TOTAL_REASONS[number];

const sessionValues = new Map<string, number>();
const sessionSuccessAt = new Map<string, number>();

export function safeLiveTotalError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/^pricesMissing:[1-9]\d*$/.test(message)) return message;
  if (/ibkrToken|IBKR.*(?:1012|token expired)|(?:1012|token expired).*IBKR/i.test(message)) return "ibkrToken";
  if (/(?:429|1018|rate.?limit|too many requests|rateLimited)/i.test(message)) return "rateLimited";
  if (/rateUnavailable|(?:exchange|currency|fx) rate/i.test(message)) return "rateUnavailable";
  if (/partialSource/.test(message)) return "partialSource";
  if (/stockPricesMissing|stock.*(?:quote|price)/i.test(message)) return "stockPricesMissing";
  if (/pricesMissing|coin.*(?:quote|price)/i.test(message)) return "pricesMissing";
  return "unknown";
}

export function safeLiveTotalLogMessage(error: unknown): string {
  const kind = safeLiveTotalError(error).split(":")[0] as LiveTotalReason;
  const description: Record<LiveTotalReason, string> = {
    rateLimited: "Price service rate limited",
    pricesMissing: "Coin prices missing",
    stockPricesMissing: "Stock prices missing",
    rateUnavailable: "Currency rate unavailable",
    ibkrToken: "IBKR token expired",
    partialSource: "Portfolio source partial",
    unknown: "Live price request failed",
  };
  const message = error instanceof Error ? error.message : String(error);
  const status = message.match(/\b([1-5]\d{2})\b/)?.[1];
  return `${description[kind] ?? description.unknown}${status ? ` (HTTP ${status})` : ""}`;
}

export function liveTotalTransition(snapshot: Snapshot, event: Event): Snapshot {
  switch (event.type) {
    case "reset":
      return { state: "idle", value: event.value, lastAt: event.at, firstReveal: false };
    case "start":
      return { ...snapshot, state: snapshot.state === "live" || snapshot.state === "partial"
        ? snapshot.state : "connecting", firstReveal: false };
    case "success":
      return { state: event.stale ? "stale" : event.partial ? "partial" : event.live ? "live" : "off",
        value: event.value, lastAt: event.stale || event.partial ? snapshot.lastAt : event.at,
        firstReveal: snapshot.value === undefined, partial: event.partial, error: event.reason };
    case "stale":
      return snapshot.state === "connecting" || snapshot.state === "live" || snapshot.state === "partial"
        ? { ...snapshot, state: "stale", firstReveal: false } : snapshot;
    case "error":
      return { ...snapshot, state: snapshot.value === undefined ? "error" : "stale",
        error: event.reason, firstReveal: false };
    case "off":
      return { ...snapshot, state: "off", firstReveal: false };
  }
}

export function useLiveTotal({ key, load, enabled, live, intervalMs, timeoutMs = 30_000, hideValues = false, refreshToken }: {
  key: string;
  load: () => Promise<number | { value: number; stale?: boolean; partial?: boolean; reason?: string }>;
  enabled: boolean;
  live: boolean;
  intervalMs: number;
  timeoutMs?: number;
  hideValues?: boolean;
  refreshToken?: number;
}) {
  const [snapshot, dispatch] = useReducer(liveTotalTransition, key, (cacheKey): Snapshot => ({
    state: "idle", value: sessionValues.get(cacheKey), lastAt: sessionSuccessAt.get(cacheKey), firstReveal: false,
  }));
  const [animatedValue, setAnimatedValue] = useState(snapshot.value);
  const [announcedValue, setAnnouncedValue] = useState(snapshot.value);
  const lastAnnouncedAt = useRef(0);
  const loadRef = useRef(load);
  const refreshRef = useRef<() => void>(() => {});
  loadRef.current = load;
  const visible = () => document.visibilityState !== "hidden";
  const reducedMotion = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = snapshot.value !== undefined && !hideValues && !reducedMotion && visible() && !snapshot.firstReveal;

  useLayoutEffect(() => {
    dispatch({ type: "reset", value: sessionValues.get(key), at: sessionSuccessAt.get(key) });
    setAnimatedValue(sessionValues.get(key));
    setAnnouncedValue(sessionValues.get(key));
  }, [key]);

  useEffect(() => {
    if (!enabled) {
      dispatch({ type: "off" });
      return;
    }
    let active = true;
    let pending = false;
    let interval: number | undefined;
    let staleTimer: number | undefined;
    let retryTimer: number | undefined;
    let watchdog: number | undefined;
    let failures = 0;
    let lastAt = 0;
    const refresh = async () => {
      if (!visible() || pending) return;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
      pending = true;
      dispatch({ type: "start" });
      try {
        // A load that never answers must not hold `pending` forever: it fails like any other error.
        const result = await new Promise<Awaited<ReturnType<typeof load>>>((resolve, reject) => {
          watchdog = window.setTimeout(() => reject(new Error("Live total timed out")), timeoutMs);
          loadRef.current().then(resolve, reject);
        });
        if (!active) return;
        const value = typeof result === "number" ? result : result.value;
        const stale = typeof result === "number" ? false : result.stale;
        const partial = typeof result === "number" ? false : result.partial;
        const reason = typeof result === "number" ? undefined : result.reason;
        failures = 0;
        lastAt = Date.now();
        if (live) sessionValues.set(key, value);
        if (live && !stale && !partial) sessionSuccessAt.set(key, lastAt);
        dispatch({ type: "success", value, at: lastAt, live, stale, partial, reason });
        if (lastAnnouncedAt.current === 0 || lastAt - lastAnnouncedAt.current >= 300_000) {
          lastAnnouncedAt.current = lastAt || 1;
          setAnnouncedValue(value);
        }
        if (staleTimer !== undefined) window.clearTimeout(staleTimer);
        if (live) staleTimer = window.setTimeout(() => {
          if (active && visible() && Date.now() - lastAt > intervalMs * 2) dispatch({ type: "stale" });
        }, intervalMs * 2 + 1);
      } catch (error) {
        if (!active) return;
        const reason = safeLiveTotalError(error);
        console.error("Live total failed:", safeLiveTotalLogMessage(error));
        dispatch({ type: "error", reason });
        const delay = [5_000, 15_000, 60_000][Math.min(failures++, 2)];
        retryTimer = window.setTimeout(refresh, delay);
      } finally {
        window.clearTimeout(watchdog);
        pending = false;
      }
    };
    refreshRef.current = () => { void refresh(); };
    const onVisibility = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      if (!visible()) return;
      // The stale timer does not fire in a hidden tab, so an old value is relabelled on return.
      if (lastAt > 0 && Date.now() - lastAt > intervalMs * 2) dispatch({ type: "stale" });
      void refresh();
      if (live) interval = window.setInterval(() => {
        if (retryTimer === undefined) void refresh();
      }, intervalMs);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (interval !== undefined) window.clearInterval(interval);
      if (staleTimer !== undefined) window.clearTimeout(staleTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.clearTimeout(watchdog);
    };
  }, [key, enabled, live, intervalMs, timeoutMs, refreshToken]);

  useEffect(() => {
    if (snapshot.value === undefined) return;
    if (!animate || animatedValue === undefined || animatedValue === snapshot.value) {
      setAnimatedValue(snapshot.value);
      return;
    }
    const from = animatedValue;
    const to = snapshot.value;
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      if (!visible()) {
        setAnimatedValue(to);
        return;
      }
      const fraction = Math.min(1, (now - started) / 280);
      setAnimatedValue(from + (to - from) * (1 - (1 - fraction) ** 3));
      if (fraction < 1 && visible()) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [snapshot.value, hideValues, reducedMotion]);

  return { ...snapshot, animatedValue, announcedValue, animate, retryNow: () => refreshRef.current() };
}
