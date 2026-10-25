import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ios: false,
  appCacheDir: vi.fn(),
  documentDir: vi.fn(),
  save: vi.fn(),
  copyFile: vi.fn(),
  remove: vi.fn(),
  exists: vi.fn(),
}));

vi.mock("@/utils/platform", () => ({ isIOS: () => mocks.ios }));
vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: mocks.appCacheDir, documentDir: mocks.documentDir }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ save: mocks.save }));
vi.mock("@tauri-apps/plugin-fs", () => ({ copyFile: mocks.copyFile, remove: mocks.remove, exists: mocks.exists }));

import { exportFile } from "./export-file";

beforeEach(() => {
  mocks.ios = false;
  mocks.appCacheDir.mockReset().mockResolvedValue("/app/Cache/");
  mocks.documentDir.mockReset().mockResolvedValue("/app/Documents/");
  mocks.save.mockReset().mockResolvedValue("/chosen/report.csv");
  mocks.copyFile.mockReset().mockResolvedValue(undefined);
  mocks.remove.mockReset().mockResolvedValue(undefined);
  mocks.exists.mockReset().mockResolvedValue(true);
});

describe("exportFile", () => {
  it("stages iOS data outside Documents and copies it only after selection", async () => {
    mocks.ios = true;
    let contents = "";
    mocks.save.mockImplementation(async () => {
      expect(contents).toBe("balances");
      expect(mocks.copyFile).not.toHaveBeenCalled();
      return "/chosen/report.csv";
    });
    const result = await exportFile("report.csv", ["csv"], async (path) => {
      expect(path).toMatch(/^\/app\/Cache\/report-[0-9a-f-]+\.csv$/);
      contents = "balances";
    });
    expect(result).toBe(true);
    expect(mocks.copyFile).toHaveBeenCalledWith(
      expect.stringMatching(/^\/app\/Cache\/report-[0-9a-f-]+\.csv$/),
      "/chosen/report.csv",
    );
    expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: expect.stringMatching(/^report-[0-9a-f-]+\.csv$/),
    }));
    expect(mocks.remove).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/Documents\/report-[0-9a-f-]+\.csv$/));
  });

  it("removes only its unique temporary files when export is canceled", async () => {
    mocks.ios = true;
    mocks.save.mockResolvedValue(null);
    expect(await exportFile("report.csv", ["csv"], async () => {})).toBe(false);
    expect(mocks.remove).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/Cache\/report-[0-9a-f-]+\.csv$/));
    expect(mocks.remove).toHaveBeenCalledWith(expect.stringMatching(/^\/app\/Documents\/report-[0-9a-f-]+\.csv$/));
    expect(mocks.remove).not.toHaveBeenCalledWith("/app/Documents/report.csv");
  });

  it("preserves the selected Documents export when iOS returns an aliased URL", async () => {
    mocks.ios = true;
    mocks.save.mockImplementation(async ({ defaultPath }: { defaultPath: string }) =>
      `file:///private/app/Documents/${defaultPath}`);

    expect(await exportFile("report.csv", ["csv"], async () => {})).toBe(true);
    expect(mocks.copyFile).toHaveBeenCalledOnce();
    expect(mocks.remove).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/app\/Documents\/report-[0-9a-f-]+\.csv$/),
    );
  });

  it("preserves the selected Documents export when the picker returns its path", async () => {
    mocks.ios = true;
    mocks.save.mockImplementation(async ({ defaultPath }: { defaultPath: string }) =>
      `/app/Documents/${defaultPath}`);

    expect(await exportFile("report.csv", ["csv"], async () => {})).toBe(true);
    expect(mocks.remove).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/app\/Documents\/report-[0-9a-f-]+\.csv$/),
    );
  });

  it("reports a failed iOS cleanup instead of leaving a canceled export behind", async () => {
    mocks.ios = true;
    mocks.save.mockResolvedValue(null);
    mocks.remove.mockRejectedValue(new Error("cleanup failed"));
    await expect(exportFile("report.csv", ["csv"], async () => {}))
      .rejects.toThrow("cleanup failed");
  });

  it("uses the chosen path on desktop", async () => {
    let writtenPath = "";
    expect(await exportFile("report.csv", ["csv"], async (path) => { writtenPath = path; })).toBe(true);
    expect(writtenPath).toBe("/chosen/report.csv");
    expect(mocks.documentDir).not.toHaveBeenCalled();
  });

  it("preserves a desktop export dialog's existing filter label", async () => {
    await exportFile("track3-realized-gains.csv", ["csv"], async () => {}, "cost-basis-csv");
    expect(mocks.save).toHaveBeenCalledWith({
      defaultPath: "track3-realized-gains.csv",
      filters: [{ name: "cost-basis-csv", extensions: ["csv"] }],
    });
  });
});
