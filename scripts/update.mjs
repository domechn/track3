// @ts-nocheck
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import fetch from "node-fetch";
import { getOctokit, context } from "@actions/github";

const APP_RELEASE_TAG_PREFIX = "app-v";
const UPDATE_TAG_NAME = "updater";
const UPDATE_FILE_NAME = "update.json";
const UPDATE_MANIFEST_PATTERN = /(^|[-_.])latest\.json$/;
const DEFAULT_RELEASE_NOTES =
  "See the assets to download this version and install.";

const octokit = getOctokit(process.env.GITHUB_TOKEN);
const options = { owner: context.repo.owner, repo: context.repo.repo };

async function getCurrentAppReleaseTag() {
  const tauriConfig = JSON.parse(
    await readFile(resolve(process.cwd(), "src-tauri/tauri.conf.json"), "utf8"),
  );

  return `${APP_RELEASE_TAG_PREFIX}${tauriConfig.version}`;
}

async function getPublishedAppRelease() {
  const appReleaseTag = await getCurrentAppReleaseTag();

  try {
    const { data: release } = await octokit.rest.repos.getReleaseByTag({
      ...options,
      tag: appReleaseTag,
    });

    return release;
  } catch (error) {
    if (error?.status !== 404) {
      throw error;
    }

    const { data: release } =
      await octokit.rest.repos.getLatestRelease(options);

    return release;
  }
}

function getManifestAsset(release) {
  const manifestAsset = release.assets.find(({ name }) =>
    UPDATE_MANIFEST_PATTERN.test(name),
  );

  if (manifestAsset) {
    return manifestAsset;
  }

  const assetNames =
    release.assets.map(({ name }) => name).join(", ") || "(none)";
  throw new Error(
    `Updater manifest not found in release ${release.tag_name}. Assets: ${assetNames}`,
  );
}

const release = await getPublishedAppRelease();
const { browser_download_url: manifestUrl } = getManifestAsset(release);
const response = await fetch(manifestUrl);
const updateData = await response.json();

updateData.notes = release.body ?? DEFAULT_RELEASE_NOTES;

const { data: updater } = await octokit.rest.repos.getReleaseByTag({
  ...options,
  tag: UPDATE_TAG_NAME,
});

for (const { id, name } of updater.assets) {
  if (name === UPDATE_FILE_NAME) {
    // eslint-disable-next-line no-await-in-loop
    await octokit.rest.repos.deleteReleaseAsset({ ...options, asset_id: id });
    break;
  }
}

await octokit.rest.repos.uploadReleaseAsset({
  ...options,
  release_id: updater.id,
  name: UPDATE_FILE_NAME,
  data: JSON.stringify(updateData),
});
