import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ios: false,
  documentDir: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));
vi.mock("@tauri-apps/api/path", () => ({ documentDir: mocks.documentDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: mocks.open }));

import { chooseBackupLocation } from "./backup-location";

beforeEach(() => {
  mocks.ios = false;
  mocks.documentDir.mockReset().mockResolvedValue("/app/Documents");
  mocks.open.mockReset().mockResolvedValue("/desktop/backup");
});

it("uses sandbox Documents for a persistent iOS backup location", async () => {
  mocks.ios = true;
  expect(await chooseBackupLocation()).toBe("/app/Documents");
  expect(mocks.open).not.toHaveBeenCalled();
});

it("continues to allow a chosen desktop directory", async () => {
  expect(await chooseBackupLocation()).toBe("/desktop/backup");
});
