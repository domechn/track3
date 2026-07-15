import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

type ReleaseAsset = {
  id?: number;
  name: string;
  browser_download_url?: string;
};

type Release = {
  id: number;
  tag_name: string;
  draft: boolean;
  body?: string | null;
  assets: ReleaseAsset[];
};

type Manifest = {
  version: string;
  platforms: Record<string, { signature: string; url: string }>;
};

type MainDependencies = {
  appVersion: string;
  fetch: typeof fetch;
  now: () => Date;
  octokit: {
    rest: {
      repos: Record<string, ReturnType<typeof vi.fn>>;
    };
  };
  owner: string;
  repo: string;
};

type UpdateModule = {
  downloadManifest: (
    url: string,
    fetchImplementation: typeof fetch,
  ) => Promise<Manifest>;
  main: (dependencies: MainDependencies) => Promise<Manifest>;
  validateManifestForTag: (
    manifest: unknown,
    releaseTag: string,
  ) => Manifest;
};

const tauriConfigPath = resolve(process.cwd(), "src-tauri/tauri.conf.json");
const tauriReleaseConfigPath = resolve(
  process.cwd(),
  "src-tauri/tauri.release.conf.json",
);
const tauriConfig = JSON.parse(await readFile(tauriConfigPath, "utf8"));
const appVersion = tauriConfig.version as string;
const appReleaseTag = `app-v${appVersion}`;

const bootstrap = vi.hoisted(() => {
  const manifest = {
    version: "0.8.1",
    platforms: {
      "linux-x86_64": {
        signature: "signature",
        url: "https://example.com/track3.AppImage",
      },
    },
  };
  const getReleaseByTag = vi.fn(
    async ({ tag }: { tag: string }) => ({
      data:
        tag === "updater"
          ? { id: 99, tag_name: "updater", assets: [] }
          : {
              id: 7,
              tag_name: tag,
              body: null,
              assets: [
                {
                  name: "latest.json",
                  browser_download_url: "https://example.com/latest.json",
                },
              ],
            },
    }),
  );

  return {
    fetch: vi.fn().mockResolvedValue({
      ok: true,
      json: async () => manifest,
    }),
    getReleaseByTag,
    getLatestRelease: vi.fn(),
    deleteReleaseAsset: vi.fn(),
    uploadReleaseAsset: vi.fn(),
  };
});

vi.mock("@actions/github", () => ({
  context: { repo: { owner: "domechn", repo: "track3" } },
  getOctokit: () => ({
    rest: {
      repos: {
        getLatestRelease: bootstrap.getLatestRelease,
        getReleaseByTag: bootstrap.getReleaseByTag,
        deleteReleaseAsset: bootstrap.deleteReleaseAsset,
        uploadReleaseAsset: bootstrap.uploadReleaseAsset,
      },
    },
  }),
}));
vi.stubGlobal("fetch", bootstrap.fetch);

// @ts-expect-error The release finalizer is a runtime-only ESM module.
const updateModule = (await import("../../../scripts/update.mjs")) as UpdateModule;

function asset(name: string, id?: number): ReleaseAsset {
  return {
    id,
    name,
    browser_download_url: `https://example.com/${name}`,
  };
}

function completeAssets(): ReleaseAsset[] {
  const updaterAssets = [
    `track3_${appVersion}_amd64.AppImage`,
    "track3_x64.app.tar.gz",
    "track3_aarch64.app.tar.gz",
    `track3_${appVersion}_x64-setup.exe`,
  ];

  return updaterAssets.flatMap((name, index) => [
    asset(name, index * 2 + 1),
    asset(`${name}.sig`, index * 2 + 2),
  ]);
}

function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: 7,
    tag_name: appReleaseTag,
    draft: true,
    body: "Release notes",
    assets: completeAssets(),
    ...overrides,
  };
}

function makeHarness({
  release = makeRelease(),
  latestTag = "app-v0.8.0",
}: {
  release?: Release;
  latestTag?: string;
} = {}) {
  const calls: string[] = [];
  const legacyRelease = {
    id: 99,
    tag_name: "updater",
    draft: false,
    assets: [asset("update.json", 100)],
  };
  const getReleaseByTag = vi.fn(
    async ({ tag }: { tag: string }) => ({
      data: tag === "updater" ? legacyRelease : release,
    }),
  );
  const getLatestRelease = vi.fn().mockResolvedValue({
    data: makeRelease({
      id: 6,
      tag_name: latestTag,
      draft: false,
      assets: [],
    }),
  });
  const uploadReleaseAsset = vi.fn(
    async ({
      release_id,
      name,
    }: {
      release_id: number;
      name: string;
      data: string;
    }) => {
      calls.push(`upload:${release_id}:${name}`);
      return {
        data: asset(name, release_id === release.id ? 200 : 201),
      };
    },
  );
  const updateRelease = vi.fn(async () => {
    calls.push("publish");
  });
  const deleteReleaseAsset = vi.fn(async () => {
    calls.push("delete-legacy");
  });
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (!url.endsWith(".sig")) {
      throw new Error(`Unexpected download: ${url}`);
    }

    return {
      ok: true,
      status: 200,
      text: async () => `signature:${url.split("/").at(-1)}`,
    } as Response;
  });
  const dependencies: MainDependencies = {
    appVersion,
    fetch: fetchMock as typeof fetch,
    now: () => new Date("2026-07-15T00:00:00.000Z"),
    octokit: {
      rest: {
        repos: {
          deleteReleaseAsset,
          getLatestRelease,
          getReleaseByTag,
          updateRelease,
          uploadReleaseAsset,
        },
      },
    },
    owner: "domechn",
    repo: "track3",
  };

  return {
    calls,
    deleteReleaseAsset,
    dependencies,
    fetchMock,
    getLatestRelease,
    getReleaseByTag,
    updateRelease,
    uploadReleaseAsset,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("release finalizer", () => {
  it("rejects publication when any expected target or signature is missing", async () => {
    for (const missingName of [
      `track3_${appVersion}_amd64.AppImage`,
      "track3_aarch64.app.tar.gz.sig",
    ]) {
      const release = makeRelease({
        assets: completeAssets().filter(({ name }) => name !== missingName),
      });
      const harness = makeHarness({ release });

      await expect(updateModule.main(harness.dependencies)).rejects.toThrow(
        /Assets:.*track3_/,
      );
      expect(harness.uploadReleaseAsset).not.toHaveBeenCalled();
      expect(harness.updateRelease).not.toHaveBeenCalled();
    }
  });

  it("rejects non-2xx manifest downloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    await expect(
      updateModule.downloadManifest(
        "https://example.com/latest.json",
        fetchMock as typeof fetch,
      ),
    ).rejects.toThrow(/503/);
  });

  it("rejects manifest versions that do not match the app tag", () => {
    expect(() =>
      updateModule.validateManifestForTag(
        {
          version: "0.8.0",
          platforms: {
            "linux-x86_64": {
              signature: "signature",
              url: "https://example.com/track3.AppImage",
            },
          },
        },
        appReleaseTag,
      ),
    ).toThrow(/app-v0\.8\.0.*app-v0\.8\.1/);
  });

  it("rejects an existing public tag and older or equal publication", async () => {
    const publicTag = makeHarness({
      release: makeRelease({ draft: false }),
    });
    await expect(updateModule.main(publicTag.dependencies)).rejects.toThrow(
      /already public/,
    );

    for (const latestTag of [appReleaseTag, "app-v0.9.0"]) {
      const harness = makeHarness({ latestTag });
      await expect(updateModule.main(harness.dependencies)).rejects.toThrow(
        /newer than the latest published release/,
      );
      expect(harness.uploadReleaseAsset).not.toHaveBeenCalled();
    }
  });

  it("publishes only after one complete manifest upload", async () => {
    const harness = makeHarness();

    const manifest = await updateModule.main(harness.dependencies);

    expect(Object.keys(manifest.platforms).sort()).toEqual([
      "darwin-aarch64",
      "darwin-x86_64",
      "linux-x86_64",
      "windows-x86_64",
    ]);
    const manifestUploads = harness.uploadReleaseAsset.mock.calls.filter(
      ([request]) =>
        request.release_id === 7 && request.name === "latest.json",
    );
    expect(manifestUploads).toHaveLength(1);
    expect(
      JSON.parse(manifestUploads[0][0].data as string),
    ).toEqual(manifest);
    expect(harness.calls.indexOf("upload:7:latest.json")).toBeLessThan(
      harness.calls.indexOf("publish"),
    );
    expect(harness.updateRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        release_id: 7,
        draft: false,
        make_latest: "true",
      }),
    );
  });

  it("updates the legacy bridge only after publication", async () => {
    const harness = makeHarness();

    await updateModule.main(harness.dependencies);

    const manifestUpload = harness.calls.indexOf("upload:7:latest.json");
    const publication = harness.calls.indexOf("publish");
    const legacyDeletion = harness.calls.indexOf("delete-legacy");
    const legacyUpload = harness.calls.indexOf("upload:99:update.json");
    expect(manifestUpload).toBeLessThan(publication);
    expect(publication).toBeLessThan(legacyDeletion);
    expect(legacyDeletion).toBeLessThan(legacyUpload);
  });
});

describe("release configuration", () => {
  it("keeps updater artifacts enabled in the merged release config", async () => {
    const tauriReleaseConfig = JSON.parse(
      await readFile(tauriReleaseConfigPath, "utf8"),
    );
    const mergedTauriConfig = {
      ...tauriConfig,
      ...tauriReleaseConfig,
      bundle: {
        ...tauriConfig.bundle,
        ...tauriReleaseConfig.bundle,
      },
    };

    expect(mergedTauriConfig.bundle.createUpdaterArtifacts).toBe(true);
  });
});
