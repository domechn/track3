import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 4173);

export default defineConfig({
  testDir: "./tests/production",
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${port}`, headless: true },
  webServer: {
    command: `corepack yarn preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
