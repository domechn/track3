export type Hlc = { ms: number; counter: number; deviceId: string };
export const MAX_REMOTE_SKEW_MS = 24 * 60 * 60 * 1000;

export function validRemoteClock(value: Hlc, owner: string, now: number): boolean {
  return value && Number.isSafeInteger(value.ms) && value.ms >= 0 &&
    value.ms <= now + MAX_REMOTE_SKEW_MS &&
    Number.isSafeInteger(value.counter) && value.counter >= 0 && value.deviceId === owner;
}

export function compareClock(a: Hlc, b: Hlc): number {
  return a.ms - b.ms || a.counter - b.counter || a.deviceId.localeCompare(b.deviceId);
}

export function nextClock(last: Hlc | undefined, deviceId: string, now: number, seen?: Hlc): Hlc {
  const ms = Math.max(now, last?.ms ?? 0, seen?.ms ?? 0);
  const counter = ms === last?.ms && ms === seen?.ms
    ? Math.max(last!.counter, seen!.counter) + 1
    : ms === last?.ms ? last!.counter + 1 : ms === seen?.ms ? seen!.counter + 1 : 0;
  return { ms, counter, deviceId };
}
