import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const worktree = resolve(root, ".compat/v094");
const forward = resolve(root, "tests/compat/forward");
const env = { ...process.env, TRACK3_COMPAT_FORWARD: forward };

function run(command, args, cwd, extraEnv = {}) {
  const result = spawnSync("timeout", ["600", command, ...args], {
    cwd, env: { ...env, ...extraEnv }, stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} exited ${result.status}`);
}

rmSync(forward, { recursive: true, force: true });
mkdirSync(forward, { recursive: true });
mkdirSync(resolve(root, ".compat"), { recursive: true });
let added = false;
try {
  run("corepack", ["yarn", "vitest", "run", "src/test/compat"], root, { TRACK3_COMPAT_MODE: "produce" });
  run("cargo", ["test", "--locked", "-p", "track3-pure-tests", "--lib", "write_forward_database_fixture"], resolve(root, "src-tauri"));
  if (existsSync(worktree)) throw new Error(`Existing 0.9.4 worktree at ${worktree}`);
  run("git", ["worktree", "add", "--detach", worktree, "app-v0.9.4"], root);
  added = true;
  run("corepack", ["yarn", "install", "--immutable"], worktree);
  const oldTests = resolve(worktree, "src/test/compat");
  mkdirSync(oldTests, { recursive: true });
  for (const name of ["files.test.ts", "sync.test.ts"]) {
    copyFileSync(resolve(root, "src/test/compat", name), resolve(oldTests, name));
  }
  const oldForward = resolve(worktree, "tests/compat/forward");
  mkdirSync(oldForward, { recursive: true });
  cpSync(forward, oldForward, { recursive: true });
  run("corepack", ["yarn", "vitest", "run", "src/test/compat"], worktree, { TRACK3_COMPAT_MODE: "consume" });
  copyFileSync(resolve(oldForward, "sync-after-094.json"), resolve(forward, "sync-after-094.json"));
  const oldRust = resolve(worktree, "src-tauri/pure-tests/src");
  copyFileSync(resolve(root, "tests/compat/old-db.rs"), resolve(oldRust, "compat_old.rs"));
  const { appendFileSync } = await import("node:fs");
  appendFileSync(resolve(oldRust, "lib.rs"), "\n#[cfg(test)] mod compat_old;\n");
  run("cargo", ["test", "--locked", "-p", "track3-pure-tests", "--lib", "released_094_opens_new_database_after_version_reset"], resolve(worktree, "src-tauri"), {
    CARGO_TARGET_DIR: resolve(root, "src-tauri/target"),
  });
  run("corepack", ["yarn", "vitest", "run", "src/test/compat"], root, { TRACK3_COMPAT_MODE: "verify" });
} finally {
  if (added) run("git", ["worktree", "remove", "--force", worktree], root);
  rmSync(forward, { recursive: true, force: true });
}
