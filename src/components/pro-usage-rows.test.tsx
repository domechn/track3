import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ProUsageRows } from "./pro-usage-rows";

it("formats reset dates in the selected language and marks an exhausted bar", () => {
  render(<ProUsageRows locale="zh" t={(key) => ({
    "system.usage.erc20": "ERC20 钱包刷新",
    "system.usage.tron": "TRON 钱包刷新",
    "system.usage.resetsOn": "{date} 重置",
  })[key] ?? key} usage={{
    erc20: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00Z" },
    tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00Z" },
  }} />);
  expect(screen.getAllByText(/2026年11月3日 重置/)).toHaveLength(2);
  expect(screen.getByRole("progressbar", { name: "ERC20 钱包刷新" })).toHaveAttribute("aria-valuenow", "300");
  expect(screen.getByRole("progressbar", { name: "ERC20 钱包刷新" }).firstElementChild).toHaveClass("bg-destructive");
});
