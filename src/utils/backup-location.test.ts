import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ios: false,
  documentDir: vi.fn(),
  open: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));
vi.mock("@tauri-apps/api/path", () => ({ documentDir: mocks.documentDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));

import { chooseBackupLocation } from "./backup-location";

beforeEach(() => {
  mocks.ios = false;
  mocks.documentDir.mockReset().mockResolvedValue("/app/Documents");
  mocks.open.mockReset().mockResolvedValue("/desktop/backup");
  mocks.invoke.mockReset().mockResolvedValue("/cloud/Track3");
});

it("uses the native iOS folder picker", async () => {
  mocks.ios = true;
  expect(await chooseBackupLocation()).toBe("/cloud/Track3");
  expect(mocks.invoke).toHaveBeenCalledWith("ios_pick_backup_folder", { kind: "auto" });
});

it("continues to allow a chosen desktop directory", async () => {
  expect(await chooseBackupLocation()).toBe("/desktop/backup");
});

it("keeps a canceled iOS folder choice unset", async () => {
  mocks.ios = true;
  mocks.invoke.mockResolvedValue(null);
  expect(await chooseBackupLocation()).toBeNull();
});
