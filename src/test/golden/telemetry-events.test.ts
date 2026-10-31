import { expect, it } from "vitest";
import { currentGolden, frozenGolden } from "./read-golden";

it("keeps telemetry event arguments emitted across src", () => {
  expect(currentGolden("telemetry-events")).toEqual(frozenGolden("telemetry-events"));
});
