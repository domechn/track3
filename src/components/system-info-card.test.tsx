import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SystemInfoCard, subscriptionSummary } from "./system-info-card";
import type { SubscriptionInfo } from "@/middlelayers/license";
import en from "@/i18n/locales/en.json";
import zh from "@/i18n/locales/zh.json";

const info: SubscriptionInfo = {
  planType: "monthly",
  status: "active",
  currentPeriodEnd: "2026-11-28T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  isLegacy: false,
};

it("uses singular and plural day counts and the selected language", () => {
  const tEn = (key: string) => (en as Record<string, string>)[key];
  const tZh = (key: string) => (zh as Record<string, string>)[key];
  expect(subscriptionSummary(info, tEn, "en", Date.parse("2026-11-27T12:00:00Z")))
    .toBe("Monthly plan · renews Nov 28, 2026 · in 1 day");
  expect(subscriptionSummary(info, tEn, "en", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("Monthly plan · renews Nov 28, 2026 · in 31 days");
  expect(subscriptionSummary({ ...info, cancelAtPeriodEnd: true }, tZh, "zh", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("月付套餐 · 到期于2026年11月28日 · 31 天后");
});

it("counts renewal days by the UTC calendar date shown beside the count", () => {
  const t = (key: string) => (en as Record<string, string>)[key];
  const lateEnd = { ...info, currentPeriodEnd: "2026-11-28T23:00:00Z" };
  expect(subscriptionSummary(lateEnd, t, "en", Date.parse("2026-11-27T01:00:00Z")))
    .toBe("Monthly plan · renews Nov 28, 2026 · in 1 day");
  expect(subscriptionSummary(info, t, "en", Date.parse("2026-11-27T23:00:00Z")))
    .toBe("Monthly plan · renews Nov 28, 2026 · in 1 day");
  expect(subscriptionSummary(info, t, "en", Date.parse("2026-11-26T23:00:00Z")))
    .toBe("Monthly plan · renews Nov 28, 2026 · in 2 days");
});

it("omits the day count when renewal is later on the same UTC day", () => {
  const t = (key: string) => (en as Record<string, string>)[key];
  expect(subscriptionSummary({ ...info, currentPeriodEnd: "2026-10-28T23:00:00Z" }, t, "en", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("Monthly plan · renews Oct 28, 2026");
});

it("omits an invalid period end but keeps an elapsed date without a day count", () => {
  const t = (key: string) => (en as Record<string, string>)[key];
  expect(subscriptionSummary({ ...info, currentPeriodEnd: "invalid" }, t, "en")).toBe("Monthly plan");
  expect(subscriptionSummary({ ...info, currentPeriodEnd: "2026-10-28T11:00:00Z" }, t, "en", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("Monthly plan · renews Oct 28, 2026");
  expect(subscriptionSummary({ ...info, cancelAtPeriodEnd: true, currentPeriodEnd: "2026-10-27T11:00:00Z" }, t, "en", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("Monthly plan · expires Oct 27, 2026");
});

it("uses the existing expiry translation key for the date phrase", () => {
  const t = (key: string) => ({
    "system.monthly": "Monthly",
    "system.planSummary": "{plan} plan",
    "system.expires": "expires {date}",
    "system.inDays.other": "in {n} days",
  })[key] ?? key;
  expect(subscriptionSummary({ ...info, cancelAtPeriodEnd: true }, t, "en", Date.parse("2026-10-28T12:00:00Z")))
    .toBe("Monthly plan · expires Nov 28, 2026 · in 31 days");
});

it("shows a trialing subscription with the active status tone", () => {
  render(<SystemInfoCard title="Track3 Pro" status={{ label: "Trialing", value: "trialing" }} version="0.9.4" t={(key) => key} />);
  expect(screen.getByText("Trialing")).toHaveClass("text-green-700");
});

it("keeps separators with the following plan segment when the summary wraps", () => {
  render(<SystemInfoCard title="Track3 Pro" description="Yearly plan · renews Nov 28, 2026 · in 31 days" version="0.9.4" t={(key) => key} />);
  const segments = screen.getByText(/Yearly plan/).closest("p")!.querySelectorAll("span");
  expect(Array.from(segments, (segment) => segment.textContent)).toEqual([
    "Yearly plan", "·\u00a0renews Nov 28, 2026", "·\u00a0in 31 days",
  ]);
  expect(segments[0].parentElement).toHaveClass("gap-x-1");
  expect(Array.from(segments).every((segment) => segment.classList.contains("whitespace-nowrap"))).toBe(true);
});
