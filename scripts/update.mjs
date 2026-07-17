// @ts-nocheck
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { getOctokit, context } from "@actions/github";

export const APP_RELEASE_TAG_PREFIX = "app-v";
export const UPDATE_TAG_NAME = "updater";
export const MANIFEST_FILE_NAME = "latest.json";
export const LEGACY_UPDATE_FILE_NAME = "update.json";

const DEFAULT_RELEASE_NOTES =
  "See the assets to download this version and install.";
const EXPECTED_TARGETS = [
  {
    platform: "linux-x86_64",
    assetPattern: /_(?:amd64|x86_64)\.AppImage$/i,
  },
  {
    platform: "darwin-x86_64",
    assetPattern: /_(?:x64|x86_64)\.app\.tar\.gz$/i,
  },
  {
    platform: "darwin-aarch64",
    assetPattern: /_(?:aarch64|arm64)\.app\.tar\.gz$/i,
  },
  {
    platform: "windows-x86_64",
    assetPattern: /_(?:x64|x86_64)-setup\.exe$/i,
  },
];

function visibleAssetNames(release) {
  return release.assets.map(({ name }) => name).join(", ") || "(none)";
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(
    version,
  );
  if (!match) {
    throw new Error(`Unsupported release version: ${version}`);
  }

  return {
    numbers: match.slice(1, 4).map(Number),
    prerelease: match[4],
  };
}

export function compareVersions(left, right) {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);

  for (let index = 0; index < leftVersion.numbers.length; index += 1) {
    const difference =
      leftVersion.numbers[index] - rightVersion.numbers[index];
    if (difference !== 0) {
      return Math.sign(difference);
    }
  }

  if (leftVersion.prerelease === rightVersion.prerelease) {
    return 0;
  }
  if (!leftVersion.prerelease) {
    return 1;
  }
  if (!rightVersion.prerelease) {
    return -1;
  }

  return Math.sign(
    leftVersion.prerelease.localeCompare(rightVersion.prerelease, "en", {
      numeric: true,
    }),
  );
}

export function validateManifestForTag(manifest, releaseTag) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    typeof manifest.version !== "string" ||
    !manifest.platforms ||
    typeof manifest.platforms !== "object" ||
    Array.isArray(manifest.platforms)
  ) {
    throw new Error("Updater manifest must contain version and platforms");
  }

  const manifestTag = `${APP_RELEASE_TAG_PREFIX}${manifest.version}`;
  if (manifestTag !== releaseTag) {
    throw new Error(
      `Manifest tag ${manifestTag} does not match release tag ${releaseTag}`,
    );
  }

  for (const { platform } of EXPECTED_TARGETS) {
    const target = manifest.platforms[platform];
    if (
      !target ||
      typeof target.url !== "string" ||
      target.url.length === 0 ||
      typeof target.signature !== "string" ||
      target.signature.length === 0
    ) {
      throw new Error(`Updater manifest is missing target ${platform}`);
    }
  }

  return manifest;
}

export async function downloadManifest(url, fetchImplementation = fetch) {
  const response = await fetchImplementation(url);
  if (!response.ok) {
    throw new Error(
      `Updater manifest download failed with status ${response.status}`,
    );
  }

  return response.json();
}

function findTargetAssets(release, target) {
  const updaterAsset = release.assets.find(({ name }) =>
    target.assetPattern.test(name),
  );
  const signatureAsset = updaterAsset
    ? release.assets.find(({ name }) => name === `${updaterAsset.name}.sig`)
    : undefined;

  if (
    !updaterAsset?.browser_download_url ||
    !signatureAsset?.browser_download_url
  ) {
    throw new Error(
      `Updater target ${target.platform} or its signature is missing. Assets: ${visibleAssetNames(release)}`,
    );
  }

  return { updaterAsset, signatureAsset };
}

function decodeSignatureData(data) {
  if (typeof data === "string") {
    return data;
  }
  // Octokit returns a TypedArray view (including Node.js Buffer, which is a
  // Uint8Array subclass) or a plain ArrayBuffer. Use toString-based detection
  // for the ArrayBuffer case to remain correct across JS realms (e.g. jsdom).
  if (
    ArrayBuffer.isView(data) ||
    Object.prototype.toString.call(data) === "[object ArrayBuffer]"
  ) {
    return new TextDecoder().decode(data);
  }
  throw new Error(
    `Unexpected signature data type: ${Object.prototype.toString.call(data)}`,
  );
}

async function downloadSignature(asset, repos, options) {
  const { data } = await repos.getReleaseAsset({
    ...options,
    asset_id: asset.id,
    headers: { accept: "application/octet-stream" },
  });

  const signature = decodeSignatureData(data);
  if (!signature) {
    throw new Error(`Updater signature ${asset.name} is empty`);
  }

  return signature;
}

export async function buildManifest({
  appVersion,
  now,
  options,
  release,
  repos,
}) {
  const platforms = {};

  for (const target of EXPECTED_TARGETS) {
    const { updaterAsset, signatureAsset } = findTargetAssets(release, target);
    platforms[target.platform] = {
      signature: await downloadSignature(signatureAsset, repos, options),
      url: updaterAsset.browser_download_url,
    };
  }

  return {
    version: appVersion,
    notes: release.body ?? DEFAULT_RELEASE_NOTES,
    pub_date: now().toISOString(),
    platforms,
  };
}

function assertReleaseCanPublish(release, latestRelease, appVersion) {
  const releaseTag = `${APP_RELEASE_TAG_PREFIX}${appVersion}`;
  if (release.tag_name !== releaseTag) {
    throw new Error(
      `Draft tag ${release.tag_name} does not match expected tag ${releaseTag}`,
    );
  }
  if (!release.draft) {
    throw new Error(`Release tag ${releaseTag} is already public`);
  }

  if (!latestRelease?.tag_name?.startsWith(APP_RELEASE_TAG_PREFIX)) {
    return;
  }

  const latestVersion = latestRelease.tag_name.slice(
    APP_RELEASE_TAG_PREFIX.length,
  );
  if (compareVersions(appVersion, latestVersion) <= 0) {
    throw new Error(
      `Version ${appVersion} must be newer than the latest published release ${latestVersion}`,
    );
  }
}

async function getLatestPublishedRelease(repos, options) {
  try {
    const { data } = await repos.getLatestRelease(options);
    return data;
  } catch (error) {
    if (error?.status === 404) {
      return undefined;
    }
    throw error;
  }
}

async function findReleaseByTag(repos, options, releaseTag) {
  const MAX_PAGES = 10;
  let page = 1;
  while (page <= MAX_PAGES) {
    const { data: releases } = await repos.listReleases({
      ...options,
      per_page: 100,
      page,
    });

    const release = releases.find((r) => r.tag_name === releaseTag);
    if (release) {
      return release;
    }

    if (releases.length < 100) {
      throw new Error(`Release with tag ${releaseTag} not found`);
    }

    page += 1;
  }

  throw new Error(`Release with tag ${releaseTag} not found`);
}

async function replaceAsset({
  data,
  existingAsset,
  fileName,
  options,
  releaseId,
  repos,
}) {
  if (existingAsset) {
    await repos.deleteReleaseAsset({
      ...options,
      asset_id: existingAsset.id,
    });
  }

  return repos.uploadReleaseAsset({
    ...options,
    release_id: releaseId,
    name: fileName,
    data,
    headers: {
      "content-type": "application/json",
    },
  });
}

export async function main({
  appVersion,
  now,
  octokit,
  owner,
  repo,
}) {
  const repos = octokit.rest.repos;
  const options = { owner, repo };
  const releaseTag = `${APP_RELEASE_TAG_PREFIX}${appVersion}`;
  const [release, latestRelease] = await Promise.all([
    findReleaseByTag(repos, options, releaseTag),
    getLatestPublishedRelease(repos, options),
  ]);

  assertReleaseCanPublish(release, latestRelease, appVersion);

  const manifest = validateManifestForTag(
    await buildManifest({
      appVersion,
      now,
      options,
      release,
      repos,
    }),
    releaseTag,
  );
  const manifestData = JSON.stringify(manifest, null, 2);
  const existingManifest = release.assets.find(
    ({ name }) => name === MANIFEST_FILE_NAME,
  );

  await replaceAsset({
    data: manifestData,
    existingAsset: existingManifest,
    fileName: MANIFEST_FILE_NAME,
    options,
    releaseId: release.id,
    repos,
  });

  await repos.updateRelease({
    ...options,
    release_id: release.id,
    draft: false,
    prerelease: false,
    make_latest: "true",
  });

  const { data: updaterRelease } = await repos.getReleaseByTag({
    ...options,
    tag: UPDATE_TAG_NAME,
  });
  const legacyAsset = updaterRelease.assets.find(
    ({ name }) => name === LEGACY_UPDATE_FILE_NAME,
  );
  await replaceAsset({
    data: manifestData,
    existingAsset: legacyAsset,
    fileName: LEGACY_UPDATE_FILE_NAME,
    options,
    releaseId: updaterRelease.id,
    repos,
  });

  return manifest;
}

async function createDefaultDependencies() {
  const tauriConfig = JSON.parse(
    await readFile(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
  );

  return {
    appVersion: tauriConfig.version,
    now: () => new Date(),
    octokit: getOctokit(process.env.GITHUB_TOKEN),
    owner: context.repo.owner,
    repo: context.repo.repo,
  };
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  await main(await createDefaultDependencies());
}
