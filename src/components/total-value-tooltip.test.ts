import { expect, it } from "vitest";
import { formatTotalValueTooltip } from "./total-value-tooltip";

it("keeps cents in the Overview line tooltip while showing compact axis ticks", () => {
  expect(formatTotalValueTooltip(-52314.07, "$", false, false)).toBe("−$52,314.07");
  expect(formatTotalValueTooltip(3.0567, "$", true, false)).toBe("3.06%");
  expect(formatTotalValueTooltip(0.12345678, "₿", false, true)).toBe("₿0.12345678");
});
