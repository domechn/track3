import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ ios: true, invoke: vi.fn() }));
vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import IOSKeyRecoveryNotice from "@/mobile/components/ios-key-recovery-notice";

beforeEach(() => {
  mocks.ios = true;
  mocks.invoke.mockReset();
});

it("shows a settings link when a restored iOS database has unreadable credentials", async () => {
  mocks.invoke.mockResolvedValue(true);
  render(<IOSKeyRecoveryNotice />);
  expect(await screen.findByRole("alert")).toHaveTextContent("Re-enter");
  expect(screen.getByRole("link", { name: "Open settings" })).toHaveAttribute(
    "href",
    "#/settings/configuration",
  );
});

it("stays hidden when the encryption key is available", async () => {
  mocks.invoke.mockResolvedValue(false);
  render(<IOSKeyRecoveryNotice />);
  await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("ios_key_recovery_needed"));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
