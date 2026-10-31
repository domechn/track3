import { trackEventWithClientID } from "@/utils/app";

export const trackRefreshEvent = (properties: Record<string, string>) => trackEventWithClientID("data_refreshed", properties);
export const trackCheckoutCompleted = () => trackEventWithClientID("subscription_checkout_completed");
export const trackCheckoutPhase = (phase: string) => trackEventWithClientID(`subscription_checkout_${phase === "timed-out" ? "timed_out" : phase}`);
export const trackSubscribeClicked = (properties: Record<string, string>) => trackEventWithClientID("subscription_subscribe_clicked", properties);
export const trackCheckoutCancelled = () => trackEventWithClientID("subscription_checkout_cancelled");
export const trackOpenClicked = () => trackEventWithClientID("subscription_open_clicked");
