import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";

export type LiveTotalState = "idle" | "connecting" | "live" | "stale" | "error" | "off";

type Snapshot = { state: LiveTotalState; value?: number; lastAt?: number; firstReveal: boolean };
type Event =
  | { type: "reset"; value?: number }
  | { type: "start" }
  | { type: "success"; value: number; at: number; live: boolean; stale?: boolean }
  | { type: "stale" }
  | { type: "error" }
  | { type: "off" };

const sessionValues = new Map<string, number>();

export function liveTotalTransition(snapshot: Snapshot, event: Event): Snapshot {
  switch (event.type) {
    case "reset":
      return { state: "idle", value: event.value, firstReveal: false };
    case "start":
      return { ...snapshot, state: snapshot.state === "live" ? "live" : "connecting", firstReveal: false };
    case "success":
      return { state: event.stale ? "stale" : event.live ? "live" : "off", value: event.value, lastAt: event.at,
        firstReveal: snapshot.value === undefined };
    case "stale":
      return snapshot.state === "connecting" || snapshot.state === "live"
        ? { ...snapshot, state: "stale", firstReveal: false } : snapshot;
    case "error":
      return { ...snapshot, state: snapshot.value === undefined ? "error" : "stale", firstReveal: false };
    case "off":
      return { ...snapshot, state: "off", firstReveal: false };
  }
}

export function useLiveTotal({ key, load, enabled, live, intervalMs, hideValues = false, refreshToken }: {
  key: string;
  load: () => Promise<number | { value: number; stale: boolean }>;
  enabled: boolean;
  live: boolean;
  intervalMs: number;
  hideValues?: boolean;
  refreshToken?: number;
}) {
  const [snapshot, dispatch] = useReducer(liveTotalTransition, key, (cacheKey): Snapshot => ({
    state: "idle", value: sessionValues.get(cacheKey), firstReveal: false,
  }));
  const [animatedValue, setAnimatedValue] = useState(snapshot.value);
  const [announcedValue, setAnnouncedValue] = useState(snapshot.value);
  const lastAnnouncedAt = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const visible = () => document.visibilityState !== "hidden";
  const reducedMotion = typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const animate = snapshot.value !== undefined && !hideValues && !reducedMotion && visible() && !snapshot.firstReveal;

  useLayoutEffect(() => {
    dispatch({ type: "reset", value: sessionValues.get(key) });
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
    let failures = 0;
    let lastAt = 0;
    const refresh = async () => {
      if (!visible() || pending) return;
      pending = true;
      dispatch({ type: "start" });
      try {
        const result = await loadRef.current();
        if (!active) return;
        const value = typeof result === "number" ? result : result.value;
        const stale = typeof result === "number" ? false : result.stale;
        failures = 0;
        lastAt = Date.now();
        if (live) sessionValues.set(key, value);
        dispatch({ type: "success", value, at: lastAt, live, stale });
        if (lastAnnouncedAt.current === 0 || lastAt - lastAnnouncedAt.current >= 300_000) {
          lastAnnouncedAt.current = lastAt || 1;
          setAnnouncedValue(value);
        }
        if (staleTimer !== undefined) window.clearTimeout(staleTimer);
        if (live) staleTimer = window.setTimeout(() => {
          if (active && visible() && Date.now() - lastAt > intervalMs * 2) dispatch({ type: "stale" });
        }, intervalMs * 2 + 1);
      } catch {
        if (!active) return;
        dispatch({ type: "error" });
        if (failures++ < 2) retryTimer = window.setTimeout(refresh, 1_000);
      } finally {
        pending = false;
      }
    };
    const onVisibility = () => {
      if (interval !== undefined) window.clearInterval(interval);
      interval = undefined;
      if (!visible()) return;
      void refresh();
      if (live) interval = window.setInterval(refresh, intervalMs);
    };
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      if (interval !== undefined) window.clearInterval(interval);
      if (staleTimer !== undefined) window.clearTimeout(staleTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [key, enabled, live, intervalMs, refreshToken]);

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

  return { ...snapshot, animatedValue, announcedValue, animate };
}
