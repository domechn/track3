import { expect, it, vi } from "vitest";
import { shareExport } from "./share-export";
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import { shareIOSFile } from "./ios-native";

vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  remove: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./ios-native", () => ({ shareIOSFile: vi.fn().mockResolvedValue(undefined) }));

it("shares a staged JSON export and removes the private staging file", async () => {
  let written = "";
  await shareExport(async (path) => { written = path; });
  expect(written).toMatch(/^\/cache\/[^/]+\/track3-export-data\.json$/);
  expect(mkdir).toHaveBeenCalledWith(written.replace(/\/track3-export-data\.json$/, ""));
  expect(shareIOSFile).toHaveBeenCalledWith(written);
  expect(remove).toHaveBeenCalledWith(written.replace(/\/track3-export-data\.json$/, ""), { recursive: true });
});
