import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ios: true, invoke: vi.fn() }));
vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import IOSStartupGate from "@/mobile/components/ios-startup-gate";

beforeEach(() => {
  mocks.ios = true;
  mocks.invoke.mockReset();
});

it("keeps portfolio content inaccessible when the protected key cannot load", async () => {
  mocks.invoke.mockResolvedValue("iOS Keychain and legacy key file differ");
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  expect(await screen.findByRole("alert")).toHaveTextContent("Track3 is locked");
  expect(screen.queryByText("Private portfolio")).not.toBeInTheDocument();
});

it("opens the portfolio after a successful startup check", async () => {
  mocks.invoke.mockResolvedValue(null);
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  expect(await screen.findByText("Private portfolio")).toBeInTheDocument();
});

it("retries a temporarily unavailable key when the app becomes active", async () => {
  mocks.invoke.mockImplementation(async (command: string) => {
    if (command === "ios_startup_failure") return "iOS Keychain read failed (OSStatus -25308)";
    if (command === "ios_retry_startup") return true;
    throw new Error("unexpected command");
  });
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  fireEvent.focus(window);
  expect(await screen.findByText("Private portfolio")).toBeInTheDocument();
});

it("recovers when only the first startup-status request fails", async () => {
  mocks.invoke.mockRejectedValueOnce(new Error("bridge not ready")).mockResolvedValueOnce(null);
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  expect(await screen.findByRole("alert")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Private portfolio")).toBeInTheDocument();
});
