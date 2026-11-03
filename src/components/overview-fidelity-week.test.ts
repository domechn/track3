import { expect, it } from "vitest";
import { selectSevenDayContributionSnapshots } from "./overview-derived";

it("compares the newest daily snapshot with the one seven days earlier", () => {
  const dates = Array.from({ length: 31 }, (_, index) => ({
    id: String(index + 1),
    createdAt: `2026-10-${String(index + 1).padStart(2, "0")}T09:41:00.000Z`,
  })).reverse();
  expect(selectSevenDayContributionSnapshots(dates, new Date("2026-10-01"), new Date("2026-10-31T23:59:59Z")))
    .toEqual({ fromId: "24", toId: "31", count: 7, weekBased: true });
});
