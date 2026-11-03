import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ProDesign } from "./pro-design";

it("offers activation for a device without a license", () => {
  const onSubscribe = vi.fn();
  render(<ProDesign subscriptionInfo={null} usageEnforced={false} saveLicenseLoading={false}
    inactiveLicenseLoading={false} portalLoading={false} setInputLicense={vi.fn()}
    onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={vi.fn()} onManageSubscription={vi.fn()}
    onSubscribe={onSubscribe} onViewBenefits={vi.fn()} />);
  expect(screen.getAllByText("Free", { exact: true }).length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button", { name: /Subscribe/ }));
  expect(onSubscribe).toHaveBeenCalledOnce();
});

it("shows activation, reset countdown, and remaining devices from subscription data", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T09:52:00.000Z"));
  const { container } = render(<ProDesign license="test-license" inputLicense="test-license"
    subscriptionInfo={{ planType: "yearly", status: "active", cancelAtPeriodEnd: false, isLegacy: false,
      currentPeriodEnd: "2027-03-14T00:00:00.000Z", usage: {
        erc20: { used: 143, limit: 300, remaining: 157, periodStart: "2026-03-14T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z" },
        tron: { used: 41, limit: 300, remaining: 259, periodStart: "2026-03-14T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z" },
      } }}
    devices={{ limit: 3, devices: [
      { id: "current", current: true, platform: "macos", appVersion: "0.9.4", activatedAt: "2026-03-14T09:41:00.000Z", lastSeenAt: null },
      { id: "other", current: false, platform: "windows", appVersion: "0.9.4", activatedAt: "2026-04-02T09:41:00.000Z", lastSeenAt: null },
    ] }}
    usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={vi.fn()}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  expect(container.querySelector(".t3-b-pro-license")).toHaveTextContent("Valid. Pro yearly, activated on this device on 14 Mar 2026");
  expect(container.querySelector(".t3-b-pro-usage")).toHaveTextContent("Resets in 1 day");
  fireEvent.click(screen.getByRole("button", { name: "Deactivate this device" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("1 of 3 devices stays active");
  vi.useRealTimers();
});

it("uses the licensed billing period in the activation status", () => {
  const { container } = render(<ProDesign license="test-license" inputLicense="test-license"
    subscriptionInfo={{ planType: "monthly", status: "active", currentPeriodEnd: "2027-03-14T00:00:00.000Z",
      cancelAtPeriodEnd: false, isLegacy: false }}
    devices={{ limit: 3, devices: [{ id: "current", current: true, platform: "macos", appVersion: "0.9.4",
      activatedAt: "2026-03-14T09:41:00.000Z", lastSeenAt: null }] }}
    usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={vi.fn()}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  expect(container.querySelector(".t3-b-pro-license")).toHaveTextContent("Pro monthly, activated on this device on 14 Mar 2026");
});

it("pluralizes a reset countdown longer than one day", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T09:52:00.000Z"));
  const { container } = render(<ProDesign license="test-license" subscriptionInfo={{
    planType: "yearly", status: "active", currentPeriodEnd: "2027-03-14T00:00:00.000Z",
    cancelAtPeriodEnd: false, isLegacy: false,
    usage: { erc20: { used: 1, limit: 300, remaining: 299, periodStart: "2026-10-01T00:00:00.000Z",
      periodEnd: "2026-11-01T00:00:00.000Z" }, tron: { used: 1, limit: 300, remaining: 299,
      periodStart: "2026-10-01T00:00:00.000Z", periodEnd: "2026-11-01T00:00:00.000Z" } },
  }} usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={vi.fn()}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  expect(container.querySelector(".t3-b-pro-usage")).toHaveTextContent("Resets in 3 days");
  vi.useRealTimers();
});

it("keeps an expired licensed device visible and deactivatable", () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-31T09:52:00.000Z"));
  const deactivate = vi.fn();
  const { container } = render(<ProDesign license="test-license" inputLicense="test-license"
    subscriptionInfo={{ planType: "yearly", status: "canceled", currentPeriodEnd: "2026-10-14T00:00:00.000Z",
      cancelAtPeriodEnd: false, isLegacy: false }}
    devices={{ limit: 3, devices: [{ id: "current", current: true, platform: "macos", appVersion: "0.9.4",
      activatedAt: "2024-10-14T09:41:00.000Z", lastSeenAt: null }] }}
    usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={deactivate}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  expect(container.querySelector(".t3-b-pro-devices")).toHaveTextContent("macOS");
  expect(container.querySelector(".t3-b-pro-license .t3-b-result")).toHaveTextContent("Key recognised, subscription expired");
  expect(container.querySelector(".t3-b-banner.warning")).toHaveTextContent("Pro expired on 14 Oct 2026");
  expect(container.querySelector(".t3-b-pro-summary")).toHaveTextContent("Expired 17 days ago.");
  expect(container.querySelector(".t3-b-pro-usage")).toHaveTextContent("Frozen since 14 Oct");
  expect(container.querySelector(".t3-b-pro-usage")).toHaveTextContent("Counters restart when Pro is active again.");
  expect(container.querySelector(".t3-b-pro-devices")).toHaveTextContent("Active now");
  fireEvent.click(screen.getByRole("button", { name: "Deactivate this device" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Deactivate this device" }));
  expect(deactivate).toHaveBeenCalledOnce();
  vi.useRealTimers();
});

it("offers local deactivation when a saved license has no device list", () => {
  const deactivate = vi.fn();
  render(<ProDesign license="legacy-license" subscriptionInfo={null}
    usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={deactivate}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Deactivate this device" }));
  fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Deactivate this device" }));
  expect(deactivate).toHaveBeenCalledOnce();
  expect(screen.queryByText("Enter a license key above to activate this device.")).not.toBeInTheDocument();
});

it("uses plural grammar when deactivation leaves two devices active", () => {
  render(<ProDesign license="test-license" subscriptionInfo={null}
    devices={{ limit: 3, devices: [
      { id: "current", current: true, platform: "macos", appVersion: null, activatedAt: "2026-03-14T09:41:00.000Z", lastSeenAt: null },
      { id: "other-1", current: false, platform: "windows", appVersion: null, activatedAt: "2026-04-02T09:41:00.000Z", lastSeenAt: null },
      { id: "other-2", current: false, platform: "windows", appVersion: null, activatedAt: "2026-04-03T09:41:00.000Z", lastSeenAt: null },
    ] }}
    usageEnforced saveLicenseLoading={false} inactiveLicenseLoading={false} portalLoading={false}
    setInputLicense={vi.fn()} onSaveLicenseClick={vi.fn()} onInactiveLicenseClick={vi.fn()}
    onManageSubscription={vi.fn()} onSubscribe={vi.fn()} onViewBenefits={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Deactivate this device" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("2 of 3 devices stay active");
});
