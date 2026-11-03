import { expect, it } from "vitest";
import { shouldShowOverviewDateTick } from "./overview-chart-scale";

it("keeps the final date without crowding it with a nearby regular tick", () => {
  expect(shouldShowOverviewDateTick(30, 31)).toBe(true);
  expect(shouldShowOverviewDateTick(30, 33)).toBe(false);
  expect(shouldShowOverviewDateTick(32, 33)).toBe(true);
  expect(shouldShowOverviewDateTick(25, 33)).toBe(true);
});
