import { describe, expect, it } from "vitest";
import { groupHistoryMonths } from "@/mobile/components/history-months";

describe("groupHistoryMonths", () => {
  it("keeps page order and separates the same month across years", () => {
    const rows = [
      { id: "a", createdAt: "2025-01-20T12:00:00" },
      { id: "b", createdAt: "2025-01-02T12:00:00" },
      { id: "c", createdAt: "2024-12-31T12:00:00" },
      { id: "d", createdAt: "2024-01-03T12:00:00" },
    ];

    expect(groupHistoryMonths(rows).map((group) => [
      group.key, group.rows.map((row) => row.id),
    ])).toEqual([
      ["2025-01", ["a", "b"]],
      ["2024-12", ["c"]],
      ["2024-01", ["d"]],
    ]);
  });
});
