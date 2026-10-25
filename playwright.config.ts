import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 1420);

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  projects: [
    { name: "desktop", testIgnore: /(?:^|\/)(?:mobile|ios-[^/]*)\.spec\.ts$/ },
    { name: "mobile", testMatch: /(?:^|\/)(?:mobile|ios-[^/]*)\.spec\.ts$/ },
  ],
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: {
    command: `corepack yarn dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    env: { VITE_TRACK3_IOS_READY_PROBE: "0" },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
