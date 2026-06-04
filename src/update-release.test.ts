import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type ReleaseAsset = {
  id?: number;
  name: string;
  browser_download_url?: string;
};

type Release = {
  id?: number;
  tag_name: string;
  body?: string | null;
  assets: ReleaseAsset[];
};

const tauriConfigPath = resolve(process.cwd(), "src-tauri/tauri.conf.json");

function makeRelease(overrides: Partial<Release>): Release {
  return {
    id: 1,
    tag_name: "app-v0.7.1",
    body: null,
    assets: [],
    ...overrides,
  };
}

async function runUpdateScript({
  appRelease,
  latestRelease = makeRelease({ tag_name: "legacy-release" }),
  updaterRelease = makeRelease({ id: 99, tag_name: "updater" }),
  fetchedManifest = { version: "0.7.1", platforms: {} },
}: {
  appRelease: Release;
  latestRelease?: Release;
  updaterRelease?: Release;
  fetchedManifest?: Record<string, unknown>;
}) {
  vi.resetModules();
  process.env.GITHUB_TOKEN = "test-token";

  const getLatestRelease = vi.fn().mockResolvedValue({ data: latestRelease });
  const getReleaseByTag = vi.fn(async ({ tag }: { tag: string }) => {
    if (tag === "app-v0.7.1") {
      return { data: appRelease };
    }

    if (tag === "updater") {
      return { data: updaterRelease };
    }

    throw new Error(`Unexpected release tag: ${tag}`);
  });
  const deleteReleaseAsset = vi.fn().mockResolvedValue(undefined);
  const uploadReleaseAsset = vi.fn().mockResolvedValue(undefined);
  const fetchMock = vi.fn().mockResolvedValue({
    json: async () => fetchedManifest,
  });

  vi.doMock("@actions/github", () => ({
    context: { repo: { owner: "domechn", repo: "track3" } },
    getOctokit: () => ({
      rest: {
        repos: {
          getLatestRelease,
          getReleaseByTag,
          deleteReleaseAsset,
          uploadReleaseAsset,
        },
      },
    }),
  }));
  vi.doMock("node-fetch", () => ({ default: fetchMock }));

  // @ts-expect-error The script under test is a runtime-only ESM entrypoint.
  await import("../scripts/update.mjs");

  return {
    getLatestRelease,
    getReleaseByTag,
    deleteReleaseAsset,
    uploadReleaseAsset,
    fetchMock,
  };
}

afterEach(() => {
  vi.clearAllMocks();
  vi.doUnmock("@actions/github");
  vi.doUnmock("node-fetch");
  delete process.env.GITHUB_TOKEN;
});

describe("update-release script", () => {
  it("uses the current app tag release and accepts target-specific latest manifests", async () => {
    const appRelease = makeRelease({
      body: "Release notes",
      assets: [
        {
          name: "track3-aarch64-apple-darwin-latest.json",
          browser_download_url:
            "https://example.com/track3-aarch64-apple-darwin-latest.json",
        },
      ],
    });

    const result = await runUpdateScript({
      appRelease,
      latestRelease: makeRelease({ tag_name: "app-v0.7.0" }),
    });

    expect(result.getReleaseByTag).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "app-v0.7.1" }),
    );
    expect(result.getLatestRelease).not.toHaveBeenCalled();
    expect(result.fetchMock).toHaveBeenCalledWith(
      "https://example.com/track3-aarch64-apple-darwin-latest.json",
    );
    expect(result.uploadReleaseAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        release_id: 99,
        name: "update.json",
        data: JSON.stringify({
          version: "0.7.1",
          platforms: {},
          notes: "Release notes",
        }),
      }),
    );
  });

  it("includes visible asset names when no updater manifest is present", async () => {
    const appRelease = makeRelease({
      assets: [
        { name: "track3-x86_64.app.tar.gz" },
        { name: "track3-x86_64.app.tar.gz.sig" },
      ],
    });

    await expect(runUpdateScript({ appRelease })).rejects.toThrow(
      /track3-x86_64\.app\.tar\.gz/,
    );
  });

  it("keeps updater artifacts enabled in tauri config", async () => {
    const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));

    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
  });
});
