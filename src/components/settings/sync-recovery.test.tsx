import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
afterEach(cleanup);

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

async function unlockAttempt() {
  render(<SyncRecoveryUnlock t={t} />);
  fireEvent.click(screen.getByRole("button", { name: "Use recovery file" }));
  fireEvent.click(screen.getByRole("button", { name: "Choose .t3key file" }));
  fireEvent.change(await screen.findByLabelText("Recovery file passphrase"), { target: { value: "file passphrase long enough" } });
  fireEvent.click(screen.getByRole("button", { name: "Unlock with recovery file" }));
}

it("keeps the did-not-match message for a wrong recovery file passphrase", async () => {
  vi.mocked(syncRuntime.unlockRecoveryFile).mockResolvedValueOnce("passphrase");
  await unlockAttempt();
  expect(await screen.findByRole("alert")).toHaveTextContent("The recovery file, passphrase, or sync bucket did not match.");
  expect(screen.getByLabelText("Recovery file passphrase")).toHaveValue("file passphrase long enough");
});

it("keeps the generic message when the unlock throws", async () => {
  vi.mocked(syncRuntime.unlockRecoveryFile).mockRejectedValueOnce(new Error("secret detail"));
  await unlockAttempt();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("The recovery file, passphrase, or sync bucket did not match.");
  expect(alert).not.toHaveTextContent("secret detail");
});

it("clears the chosen file and its passphrase after a successful unlock", async () => {
  await unlockAttempt();
  await waitFor(() => expect(screen.queryByLabelText("Recovery file passphrase")).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it.each([
  ["network", "Could not reach the sync store. Check the endpoint and network."],
  ["timeout", "Sync timed out. Check your connection and try again."],
  ["access", "Access denied. Check the access key and bucket permissions."],
  ["bucket", "Bucket not found. Check the bucket name and endpoint."],
  ["header", "The sync header is damaged or unsupported."],
  ["configuration", "Check the endpoint, bucket, region and credentials."],
  ["conditions", "The store does not enforce conditional writes. Multi-device sync needs this S3 feature."],
] as const)("names the %s failure instead of blaming the recovery file", async (result, message) => {
  vi.mocked(syncRuntime.unlockRecoveryFile).mockResolvedValueOnce(result);
  await unlockAttempt();
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(message);
  expect(alert).not.toHaveTextContent("did not match");
});
