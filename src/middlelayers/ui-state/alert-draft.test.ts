import { expect, it } from "vitest";
import { alertRuleFromDraft, alertDraftFromRule } from "./alert-draft";

it("converts cooldown minutes to seconds in the persisted rule", () => {
  expect(alertRuleFromDraft({ id: 0, kind: "total_value_target", assetType: "crypto", symbol: "", comparator: "gte", threshold: " 5 ", window: "24h", cooldownMinutes: " 2 " })).toEqual({
    id: 0, kind: "total_value_target", assetType: null, symbol: null, comparator: "gte", threshold: 5,
    window: null, enabled: true, cooldownSeconds: 120, lastTriggeredAt: null, lastValue: null, armed: true,
  });
});

it("loads a persisted cooldown in minutes for editing", () => {
  expect(alertDraftFromRule({
    id: 4, kind: "total_value_target", assetType: null, symbol: null,
    comparator: "gte", threshold: 5, window: null, enabled: true,
    cooldownSeconds: 90, lastTriggeredAt: null, lastValue: null, armed: true,
  })).toEqual({
    id: 4, kind: "total_value_target", assetType: "crypto", symbol: "",
    comparator: "gte", threshold: "5", window: "24h", cooldownMinutes: "1.5",
  });
});
