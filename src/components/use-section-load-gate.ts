import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * Loading gate for a page whose sections load independently: it opens once
 * `expected` sections have reported, and closes again when `resetKey` changes.
 * `enabled = false` keeps it open (nothing will load). `markLoaded` opens it
 * without counting, for a page that has a second way to finish.
 * Transition table: docs/state-machines/ui.md.
 */
export function useSectionLoadGate(expected: number, resetKey: string, enabled = true) {
  const [loading, setLoading] = useState(true);
  const reported = useRef(0);

  // Layout effect: the gate must be closed before the first paint of the new key.
  useLayoutEffect(() => {
    reported.current = 0;
    setLoading(enabled);
  }, [resetKey, enabled]);

  const reportLoaded = useCallback(() => {
    reported.current += 1;
    if (reported.current >= expected) setLoading(false);
  }, [expected]);
  const markLoaded = useCallback(() => setLoading(false), []);

  return { loading, state: loading ? "loading" as const : "loaded" as const, reportLoaded, markLoaded };
}
