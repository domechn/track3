import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

export function currentGolden(name: string): unknown {
  return JSON.parse(execFileSync("node", ["scripts/update-ui-goldens.mjs", "--print", name], {
    cwd: root,
    encoding: "utf8",
  }));
}

export function frozenGolden(name: string): unknown {
  return JSON.parse(readFileSync(path.join(root, "tests/golden", `${name}.json`), "utf8"));
}
