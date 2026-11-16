import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 1420);
const ci = !!process.env.CI;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  // Shared CI runners are slow: wait longer for each expectation and retry a failed test once.
  // A test that passes on its retry is reported as flaky, and its trace is kept.
  expect: { timeout: ci ? 10_000 : 5_000 },
  retries: ci ? 1 : 0,
  projects: [
    { name: "desktop", testIgnore: /(?:^|\/)(?:mobile|ios-[^/]*)\.spec\.ts$/ },
    { name: "mobile", testMatch: /(?:^|\/)(?:mobile|ios-[^/]*|source-logo-contrast|page-bottom-blank)\.spec\.ts$/ },
  ],
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true, trace: ci ? "on-first-retry" : "off" },
  webServer: {
    command: `corepack yarn dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { VITE_TRACK3_IOS_READY_PROBE: "0" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
