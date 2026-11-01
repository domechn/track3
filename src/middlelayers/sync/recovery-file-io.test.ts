import { expect, it, vi } from "vitest";
import { writeRecoveryFile, pickRecoveryFile } from "./recovery-file-io";
import { exportFile } from "@/utils/export-file";
import { shareExport } from "@/utils/share-export";
import { isIOS } from "@/utils/platform";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";

vi.mock("@/utils/export-file", () => ({ exportFile: vi.fn().mockResolvedValue(true) }));
vi.mock("@/utils/share-export", () => ({ shareExport: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/utils/platform", () => ({ isIOS: vi.fn().mockReturnValue(false) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn().mockResolvedValue(true) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn().mockResolvedValue("/picked/recovery.t3key") }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn().mockResolvedValue("encrypted"),
  stat: vi.fn().mockResolvedValue({ size: 9 }),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

it("saves only encrypted bytes through the desktop save dialog", async () => {
  vi.mocked(isIOS).mockReturnValue(false);
  await writeRecoveryFile("encrypted", "private.bucket");
  const [filename, extensions, write] = vi.mocked(exportFile).mock.calls.at(-1)!;
  expect(filename).toBe("track3-sync-private-bucket.t3key");
  expect(extensions).toEqual(["t3key"]);
  await write("/chosen/file.t3key");
  expect(writeTextFile).toHaveBeenCalledWith("/chosen/file.t3key", "encrypted");
});

it("authenticates before sharing on iOS and never shares after failed authentication", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  vi.mocked(invoke).mockResolvedValueOnce(false);
  await expect(writeRecoveryFile("encrypted", "private.bucket")).rejects.toThrow();
  expect(shareExport).not.toHaveBeenCalled();
  vi.mocked(invoke).mockResolvedValueOnce(true);
  await writeRecoveryFile("encrypted", "private.bucket");
  const [write, filename] = vi.mocked(shareExport).mock.calls.at(-1)!;
  expect(filename).toBe("track3-sync-private-bucket.t3key");
  await write("/cache/file.t3key");
  expect(writeTextFile).toHaveBeenCalledWith("/cache/file.t3key", "encrypted");
});

it("rejects oversized files before reading", async () => {
  vi.mocked(stat).mockResolvedValueOnce({ size: 4097 } as Awaited<ReturnType<typeof stat>>);
  await expect(pickRecoveryFile()).rejects.toThrow();
  expect(readTextFile).not.toHaveBeenCalled();
  expect(open).toHaveBeenCalled();
});
