import { act, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import AutoBackupIndicator from "@/mobile/components/auto-backup-indicator";
import { isIOS } from "@/utils/platform";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => true) }));
beforeEach(() => vi.mocked(isIOS).mockReturnValue(true));

it("shows backup progress without a hover gesture on iPhone", () => {
  render(<AutoBackupIndicator status="running" />);
  expect(screen.getByRole("status")).toHaveTextContent("Backing up");
  expect(screen.getByRole("status")).toHaveTextContent("automatically");
  vi.mocked(isIOS).mockReturnValue(false);
});

it("shows iCloud download progress during automatic import", () => {
  render(<AutoBackupIndicator status="running" />);
  act(() => window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: true })));
  expect(screen.getByRole("status")).toHaveTextContent("Downloading from iCloud");
  act(() => window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: false })));
  expect(screen.getByRole("status")).toHaveTextContent("Backing up data");
});

it("shows preparation for a forced backup after startup", () => {
  render(<AutoBackupIndicator status="idle" />);
  act(() => window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: true })));
  expect(screen.getByRole("status")).toHaveTextContent("Downloading from iCloud");
  act(() => window.dispatchEvent(new CustomEvent("track3:backup-folder-preparation", { detail: false })));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
