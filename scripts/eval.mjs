import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
if (args.some((arg) => arg !== "--update-baseline")) {
  console.error("Usage: corepack yarn eval [--update-baseline]");
  process.exit(2);
}
for (const name of ["EVAL_ENDPOINT", "EVAL_API_KEY", "EVAL_MODEL"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. Set the live evaluation endpoint, key, and model.`);
    process.exit(2);
  }
}

const result = spawnSync(
  "corepack",
  ["yarn", "vitest", "run", "src/test/eval/golden.test.ts"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      EVAL_LIVE: "1",
      EVAL_UPDATE_BASELINE: args.includes("--update-baseline") ? "1" : "0",
    },
  },
);
process.exit(result.status ?? 1);
