import { expect, it } from "vitest";
import desktopEn from "./locales/en.json";
import desktopZh from "./locales/zh.json";
import mobileEn from "@/mobile/en.json";
import mobileZh from "@/mobile/zh.json";

it("preserves the original Summary copy and mobile net funding copy in both locales", () => {
  expect(desktopEn["summary.fidelity.fullSubtitle"]).toBe(
    "Is the portfolio earning or just growing? {market} of the {gain} gain since {date} is market P&L; {deposits} is money you added.",
  );
  expect(desktopZh["summary.fidelity.fullSubtitle"]).toBe(
    "投资组合在盈利，还是仅仅在增长？自 {date} 起增长 {gain} 中，{market} 来自市场盈亏；{deposits} 是新增资金。",
  );
  expect(mobileEn["fidelity.summary.explainer.dynamic"]).toBe(
    "Is the portfolio earning or just growing? {pnl} of the {gain} gain since {date} is market P&L; {flow} is money you added.",
  );
  expect(mobileZh["fidelity.summary.explainer.dynamic"]).toBe(
    "投资组合是在盈利，还是仅在增长？自 {date} 起，{gain} 的增长中 {pnl} 来自市场盈亏，{flow} 是您追加的资金。",
  );
  expect(mobileEn["fidelity.summary.explainer.net"]).toContain("net funding");
  expect(mobileZh["fidelity.summary.explainer.net"]).toContain("净转入");
});
