// @ts-nocheck
import fetch from "node-fetch";
import { getOctokit, context } from "@actions/github";

const UPDATE_TAG_NAME = "updater";
const UPDATE_FILE_NAME = "update.json";

let updateData = undefined;

const octokit = getOctokit(process.env.GITHUB_TOKEN);
const options = { owner: context.repo.owner, repo: context.repo.repo };

const { data: release } = await octokit.rest.repos.getLatestRelease(options);
let found = false;
// eslint-disable-next-line camelcase
for (const { name, browser_download_url } of release.assets) {
  if (name === "latest.json") {
    // download latest.json and read its content
    const response = await fetch(browser_download_url);
    const latest = await response.json();
    updateData = latest;
    found = true;
    break;
  }
}

if (!found) {
  throw new Error("latest.json not found");
}

updateData.notes = release.body ?? "See the assets to download this version and install."

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
