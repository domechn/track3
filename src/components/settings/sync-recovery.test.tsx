import { expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SyncRecoveryExport, SyncRecoveryUnlock } from "./sync-recovery";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { writeRecoveryFile, pickRecoveryFile } from "@/middlelayers/sync/recovery-file-io";
import en from "@/i18n/locales/en.json";

vi.mock("@/middlelayers/sync/runtime", () => ({
  syncRuntime: {
    exportRecoveryFile: vi.fn().mockResolvedValue("encrypted-only"),
    unlockRecoveryFile: vi.fn().mockResolvedValue("ok"),
    getSettings: () => ({ bucket: "test-bucket" }),
  },
}));
vi.mock("@/middlelayers/sync/recovery-file-io", () => ({
  writeRecoveryFile: vi.fn().mockResolvedValue(true),
  pickRecoveryFile: vi.fn().mockResolvedValue("encrypted-only"),
}));
const t = (key: string) => (en as Record<string, string>)[key] ?? key;

it("warns before export and requires confirmation of the separate file passphrase", async () => {
  render(<SyncRecoveryExport t={t} />);
  expect(screen.getByRole("note")).toHaveTextContent(/root key/i);
  fireEvent.change(screen.getByLabelText("Current sync passphrase"), { target: { value: "sync passphrase long enough" } });
  fireEvent.change(screen.getByLabelText("Recovery file passphrase"), { target: { value: "file passphrase long enough" } });
  fireEvent.change(screen.getByLabelText("Confirm recovery file passphrase"), { target: { value: "different" } });
  fireEvent.click(screen.getByRole("button", { name: "Export recovery file" }));
  expect(screen.getByRole("alert")).toHaveTextContent(/match/i);
  expect(syncRuntime.exportRecoveryFile).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm recovery file passphrase"), { target: { value: "file passphrase long enough" } });
  fireEvent.click(screen.getByRole("button", { name: "Export recovery file" }));
  await waitFor(() => expect(writeRecoveryFile).toHaveBeenCalledWith("encrypted-only", "test-bucket"));
});

it("chooses a recovery file and unlocks the session with its passphrase", async () => {
  render(<SyncRecoveryUnlock t={t} />);
  fireEvent.click(screen.getByRole("button", { name: "Use recovery file" }));
  expect(screen.queryByLabelText("Recovery file passphrase")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose .t3key file" }));
  await waitFor(() => expect(pickRecoveryFile).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Recovery file passphrase"), { target: { value: "file passphrase long enough" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock with recovery file" }));
  await waitFor(() => expect(syncRuntime.unlockRecoveryFile).toHaveBeenCalledWith("encrypted-only", "file passphrase long enough"));
});
