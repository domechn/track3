import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const directory = resolve(
  process.argv[2] ?? fileURLToPath(new URL("../.github/workflows/", import.meta.url)),
);
let failed = false;

for (const file of readdirSync(directory).filter((name) => /\.ya?ml$/.test(name))) {
  try {
    const workflow = parse(readFileSync(resolve(directory, file), "utf8"));
    const triggers = workflow?.on;
    const events = typeof triggers === "string"
      ? [triggers]
      : Array.isArray(triggers) ? triggers : Object.keys(triggers ?? {});
    if (!events.some((event) => event === "pull_request" || event === "pull_request_target")) {
      continue;
    }
    const secrets = [...JSON.stringify(workflow).matchAll(/\bsecrets\.(TAURI_[A-Z0-9_]+)/gi)];
    for (const [, secret] of secrets) {
      console.error(`${file}: pull request workflow references secrets.${secret}`);
      failed = true;
    }
  } catch (error) {
    console.error(`${file}: ${error.message}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
