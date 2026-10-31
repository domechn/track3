import { beforeEach, expect, it, vi } from "vitest";
import { trackEventWithClientID } from "@/utils/app";
import {
  trackCheckoutCancelled, trackCheckoutCompleted, trackCheckoutPhase,
  trackOpenClicked, trackRefreshEvent, trackSubscribeClicked,
} from "./telemetry";

vi.mock("@/utils/app", () => ({ trackEventWithClientID: vi.fn() }));
beforeEach(() => vi.mocked(trackEventWithClientID).mockClear());

it("sends refresh details through the existing telemetry event", () => {
  trackRefreshEvent({ source: "manual" });
  expect(vi.mocked(trackEventWithClientID).mock.calls).toEqual([
    ["data_refreshed", { source: "manual" }],
  ]);
});

it("sends the subscription events and normalizes timeout phase spelling", () => {
  trackCheckoutCompleted();
  trackCheckoutPhase("timed-out");
  trackCheckoutPhase("started");
  trackSubscribeClicked({ location: "settings" });
  trackCheckoutCancelled();
  trackOpenClicked();
  expect(vi.mocked(trackEventWithClientID).mock.calls).toEqual([
    ["subscription_checkout_completed"],
    ["subscription_checkout_timed_out"],
    ["subscription_checkout_started"],
    ["subscription_subscribe_clicked", { location: "settings" }],
    ["subscription_checkout_cancelled"],
    ["subscription_open_clicked"],
  ]);
});
