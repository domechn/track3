import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import { AutoRetrySetting } from "./auto-retry-setting";
import { RETRY_ENABLED_KEY, refreshRetryScheduler } from "@/middlelayers/refresh-retry-scheduler";

beforeEach(() => { localStorage.removeItem(RETRY_ENABLED_KEY); refreshRetryScheduler.setEnabled(true); });

it("defaults to on and saves the Settings switch immediately", () => {
  render(<AutoRetrySetting t={(key) => key === "refresh.autoRetry.setting" ? "Retry failed sources automatically" : key} />);
  const toggle = screen.getByRole("switch", { name: "Retry failed sources automatically" });
  expect(toggle).toBeChecked();
  fireEvent.click(toggle);
  expect(toggle).not.toBeChecked();
  expect(localStorage.getItem(RETRY_ENABLED_KEY)).toBe("false");
});
