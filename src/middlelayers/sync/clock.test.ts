import { expect, it } from "vitest";
import { compareClock, nextClock } from "./clock";

it("keeps a local event newer after observing a clock one hour ahead", () => {
  const remote = { ms: 3_600_000, counter: 4, deviceId: "remote" };
  const local = nextClock({ ms: 1_000, counter: 1, deviceId: "local" }, "local", 1_001, remote);
  expect(local).toEqual({ ms: 3_600_000, counter: 5, deviceId: "local" });
  expect(compareClock(local, remote)).toBeGreaterThan(0);
});

it("uses the device id when simultaneous events share physical and logical time", () => {
  expect(compareClock(
    { ms: 1_000, counter: 0, deviceId: "b" },
    { ms: 1_000, counter: 0, deviceId: "a" },
  )).toBeGreaterThan(0);
});
