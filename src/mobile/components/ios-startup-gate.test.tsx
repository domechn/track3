import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

it("stays locked when retry reports false", async () => {
  mocks.invoke.mockImplementation(async (command: string) => {
    if (command === "ios_startup_failure") return "iOS Keychain read failed (OSStatus -25308)";
    if (command === "ios_retry_startup") return false;
    throw new Error("unexpected command");
  });
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("ios_retry_startup"));
  expect(screen.getByRole("alert")).toHaveTextContent("Track3 is locked");
  expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(screen.queryByText("Private portfolio")).not.toBeInTheDocument();
});

function startupBridge(status: () => unknown, retry: () => boolean = () => false) {
  mocks.invoke.mockImplementation(async (command: string) => {
    const current = status() as { message?: string } | null;
    if (command === "ios_startup_failure") return current?.message ?? null;
    if (command === "ios_startup_status") return current;
    if (command === "ios_retry_startup") return retry();
    throw new Error("unexpected command");
  });
}

it("shows the startup failure reason under the lock message", async () => {
  startupBridge(() => ({ state: "failed", message: "iOS Keychain read failed (OSStatus -25308)", retryable: true }));
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("iOS Keychain read failed (OSStatus -25308)");
  expect(alert).toHaveAttribute("data-state", "failed-retryable");
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});

it("keeps Retry visible but disabled when the failure cannot be retried", async () => {
  startupBridge(() => ({ state: "failed", message: "database is newer than this app", retryable: false }));
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("database is newer than this app");
  expect(alert).toHaveAttribute("data-state", "failed-terminal");
  expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
});

it("shows the reason and keeps Retry enabled when the status command is unavailable", async () => {
  mocks.invoke.mockImplementation(async (command: string) => {
    if (command === "ios_startup_failure") return "Protected key unavailable";
    throw new Error(`Unhandled Tauri command: ${command}`);
  });
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Protected key unavailable");
  expect(alert).toHaveAttribute("data-state", "locked");
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
});

it("replaces the reason and disables Retry when a retry ends in a terminal failure", async () => {
  let status = { state: "failed", message: "iOS Keychain read failed (OSStatus -25308)", retryable: true };
  startupBridge(() => status, () => {
    status = { state: "failed", message: "migration failed", retryable: false };
    return false;
  });
  render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
  await waitFor(() => expect(screen.getByRole("alert")).toHaveAttribute("data-state", "failed-terminal"));
  expect(screen.getByRole("alert")).toHaveTextContent("migration failed");
  expect(screen.getByRole("alert")).not.toHaveTextContent("iOS Keychain read failed");
  expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
  expect(screen.queryByText("Private portfolio")).not.toBeInTheDocument();
});

it("marks the startup check for automation while it is pending", () => {
  mocks.invoke.mockReturnValue(new Promise(() => {}));
  const { container } = render(<IOSStartupGate><div>Private portfolio</div></IOSStartupGate>);
  expect(container.firstElementChild).toHaveAttribute("data-state", "checking");
  expect(container.firstElementChild).toHaveAttribute("aria-busy", "true");
});
