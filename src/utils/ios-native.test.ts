import { beforeEach, expect, it, vi } from "vitest";
import { isIOS } from "./platform";
import { setAppLockEnabled, setAppBadge, shareIOSFile } from "./ios-native";
import { invoke, isTauri } from "@tauri-apps/api/core";

vi.mock("./platform", () => ({ isIOS: vi.fn(() => false) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), isTauri: vi.fn(() => false) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isIOS).mockReturnValue(false);
  vi.mocked(isTauri).mockReturnValue(false);
});

it("requires local authentication before enabling the native app lock", async () => {
  vi.mocked(isIOS).mockReturnValue(true);
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(invoke).mockResolvedValueOnce(false);
  await expect(setAppLockEnabled(true)).rejects.toThrow();
  expect(invoke).not.toHaveBeenCalledWith("ios_set_lock_enabled", expect.anything());
});

it("does not send an icon badge command outside the iOS app", async () => {
  await setAppBadge(4);
  expect(invoke).not.toHaveBeenCalled();
});

it("rejects a share request outside the iOS app", async () => {
  await expect(shareIOSFile("/tmp/export.json")).rejects.toThrow();
});
