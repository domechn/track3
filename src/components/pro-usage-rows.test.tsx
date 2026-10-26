import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProUsageRows } from "./pro-usage-rows";

it("formats reset dates in the selected language and marks an exhausted bar", () => {
  render(<ProUsageRows locale="zh" t={(key) => ({
    "system.usage.erc20": "ERC20 钱包刷新",
    "system.usage.tron": "TRON 钱包刷新",
    "system.usage.resetsOn": "{date} 重置",
  })[key] ?? key} enforced usage={{
    erc20: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00Z" },
    tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03T00:00:00Z" },
  }} />);
  expect(screen.getAllByText(/2026年11月3日 重置/)).toHaveLength(2);
  expect(screen.getByRole("progressbar", { name: "ERC20 钱包刷新" })).toHaveAttribute("aria-valuenow", "300");
  expect(screen.getByRole("progressbar", { name: "ERC20 钱包刷新" }).firstElementChild).toHaveClass("bg-destructive");
});

it("keeps a full bar neutral when limits are not enforced", () => {
  render(<ProUsageRows locale="en" t={(key) => key} enforced={false} usage={{
    erc20: { limit: 300, used: 300, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
    tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
  }} />);
  expect(screen.getByRole("progressbar", { name: "system.usage.erc20" }).firstElementChild).not.toHaveClass("bg-destructive");
});

it("accepts a zero limit without passing an invalid maximum to the progress bar", () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(<ProUsageRows locale="en" t={(key) => key} enforced usage={{
      erc20: { limit: 0, used: 0, remaining: 0, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
      tron: { limit: 300, used: 8, remaining: 292, periodStart: "2026-10-03", periodEnd: "2026-11-03" },
    }} />);
    expect(error).not.toHaveBeenCalled();
    expect(screen.getByRole("progressbar", { name: "system.usage.erc20" }).firstElementChild).not.toHaveClass("bg-destructive");
  } finally {
    error.mockRestore();
  }
});
