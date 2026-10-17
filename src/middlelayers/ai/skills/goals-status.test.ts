import { expect, it, vi } from "vitest";
import skill from "./goals-status";
import { listAlertRules, countUnreadAlerts } from "../../alerts";

vi.mock("../../alerts", () => ({ listAlertRules: vi.fn(), countUnreadAlerts: vi.fn() }));

it("reports saved goals and unread alerts without changing them", async () => {
  vi.mocked(listAlertRules).mockResolvedValue([{
    id: 4, kind: "total_value_target", assetType: null, symbol: null,
    comparator: "gte", threshold: 1000, window: null, enabled: true,
    cooldownSeconds: 3600, lastTriggeredAt: null, lastValue: 950, armed: true,
  }]);
  vi.mocked(countUnreadAlerts).mockResolvedValue(2);
  const result = await skill.run({}, { baseCurrency: { currency: "USD", rate: 1 } } as never);
  expect(result.data).toMatchObject({ unread: 2, rules: [{ id: 4, lastValue: 950 }] });
});
