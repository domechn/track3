import { copyFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Page } from "@playwright/test";
import { installTauriBridge, seedSettingsSnapshots } from "./fidelity-scenes";
import { FakeS3 } from "../../src/middlelayers/sync/object-store";

export type SettingsBPage = "pro" | "ai" | "backup" | "security" | "sync" | "about";

const captureRoot = "/tmp/fidelity-desktop";
const designHeights: Record<number, string[]> = {
  1111: ["about-downloading", "about-guide", "about-ready", "about-toast-ok", "about-update",
    "security-rotate", "sync-confirm-use", "sync-disable", "sync-forget", "sync-pop-error",
    "sync-pop-locked", "sync-pop-never", "sync-pop-ok", "sync-pop-stopped", "sync-pop-syncing",
    "sync-toast"],
  1222: ["backup-conflicts", "backup-restore", "backup-toast-err", "backup-toast-ok", "pro-deactivate"],
  1666: ["about", "about-check-error", "about-checking", "about-later", "ai", "ai-fail",
    "ai-json-error", "ai-reveal", "ai-saved", "ai-testing", "backup", "backup-exporting",
    "backup-no-folder", "pro", "pro-activating", "pro-exhausted", "pro-expired", "pro-free",
    "pro-invalid", "security", "security-lock-off", "security-recovery-missing",
    "security-rotated", "security-rotating"],
  2055: ["sync", "sync-loading", "sync-locked", "sync-rename", "sync-setup", "sync-test-fail",
    "sync-testing"],
};
export const fidelitySyncSettings = {
  enabled: true,
  endpoint: "https://3f9a1c7e2b4d.r2.cloudflarestorage.com",
  region: "auto",
  bucket: "track3-sync",
  prefix: "dom/",
  accessKeyId: "a1b2c3d4e5f60718",
  secretAccessKey: "sample-secret-access-key-for-fidelity",
  pathStyle: true,
  categories: { history: true, settings: true, secrets: true, rebalance: true, chat: false },
  deviceNames: {},
};
export const fidelityRecoverySettings = {
  enabled: true, endpoint: "https://s3.example.test", region: "us-east-1", bucket: "track3-sync",
  prefix: "", accessKeyId: "sample-access", secretAccessKey: "sample-secret", pathStyle: true,
  categories: { history: false, settings: false, secrets: false, rebalance: false, chat: false }, deviceNames: {},
};

export async function settingsBSql(page: Page, query: string, values: unknown[] = []) {
  await page.evaluate(({ query, values }) =>
    (window as any).__e2eInvoke("plugin:sql|execute", { query, values }), { query, values });
}

export async function seedSettingsB(page: Page, area: SettingsBPage, state: string, theme: "light" | "dark" = "dark", s3?: FakeS3) {
  await page.clock.setFixedTime(new Date("2026-10-31T09:52:00.000Z"));
  await page.addInitScript((theme) => {
    localStorage.setItem("track3-ui-theme", theme);
    localStorage.setItem("track3-ui-locale", "en");
  }, theme);
  const bridge = await installTauriBridge(page, {
    s3: s3 ?? (area === "security" && state !== "recovery-missing" ? new FakeS3() : undefined),
    fidelitySample: "full",
    appVersion: "0.9.4",
    licenseDevices: "present",
    proUsageFixture: true,
    quotaExhaustedFixture: area === "pro" && state === "exhausted",
    backupFolderFixture: area === "backup",
    configuredBackupFixture: area === "backup" && state !== "no-folder",
    seedLockedSync: area === "sync" && state !== "setup" || area === "security" && state !== "recovery-missing",
  });
  if (s3 || area === "security" && state !== "recovery-missing") {
    await page.addInitScript(() => {
      const original = (window as any).__e2eInvoke;
      (window as any).__e2eInvoke = (command: string, args: any, options: unknown) => {
        if (command !== "plugin:http|fetch") return original(command, args, options);
        const url = new URL(args.clientConfig.url);
        if (url.hostname !== "3f9a1c7e2b4d.r2.cloudflarestorage.com" && !url.pathname.startsWith("/track3-sync/")) {
          return original(command, args, options);
        }
        url.hostname = "s3.example.test";
        url.pathname = url.pathname.replace(/^\/track3-sync\//, "/track3/");
        return original(command, { ...args, clientConfig: { ...args.clientConfig, url: url.toString() } }, options);
      };
    });
  }
  await seedSettingsSnapshots(page);
  if (area === "backup") {
    const createdAt = "2026-09-01T00:00:00.000Z";
    const content = JSON.stringify({ historicalData: [{
      createdAt, total: 42,
      assets: [{ id: 3, uuid: "folder-snapshot", createdAt, assetType: "crypto", symbol: "ETH",
        amount: 1, value: 42, price: 42, wallet: "folder-wallet" }],
      transactions: [],
    }] });
    const sha256 = createHash("sha256").update(content).digest("hex");
    const part = { bytes: new TextEncoder().encode(content).length, file: `2026-09.${sha256.slice(0, 8)}.json`,
      month: "2026-09", records: 1, sha256 };
    const payload = { client: "device-a", clientVersion: "0.9.0", exportAt: "2026-10-01T03:00:00.000Z",
      formatVersion: 2, parts: [part] };
    const metadata = JSON.stringify({ ...payload, metaHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex") });
    await page.evaluate(async ({ content, metadata, filename }) => {
      const write = (path: string, value: string) => (window as any).__e2eInvoke("plugin:fs|write_text_file",
        [...new TextEncoder().encode(value)], { headers: { path: encodeURIComponent(path) } });
      await write("/e2e/cloud/track3-backup/device-a/metadata.json", metadata);
      await write(`/e2e/cloud/track3-backup/device-a/data/${filename}`, content);
    }, { content, metadata, filename: part.file });
  }
  if (area === "pro") await page.addInitScript(({ state }) => {
    const original = (window as any).__e2eInvoke;
    (window as any).__e2eInvoke = async (command: string, args: unknown, options: unknown) => {
      const bytes = await original(command, args, options);
      if (command !== "plugin:http|fetch_read_body" || !Array.isArray(bytes) || bytes.at(-1) !== 0) return bytes;
      let data: any;
      try { data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes.slice(0, -1)))); }
      catch { return bytes; }
      const usage = {
        erc20: { limit: 300, used: state === "exhausted" ? 300 : 143, remaining: state === "exhausted" ? 0 : 157,
          periodStart: state === "expired" ? "2025-10-14T00:00:00.000Z" : "2026-03-14T00:00:00.000Z",
          periodEnd: "2026-11-01T00:00:00.000Z" },
        tron: { limit: 300, used: 41, remaining: 259,
          periodStart: state === "expired" ? "2025-10-14T00:00:00.000Z" : "2026-03-14T00:00:00.000Z",
          periodEnd: "2026-11-01T00:00:00.000Z" },
      };
      if (Array.isArray(data.devices)) data = { limit: 3, devices: [
        { id: "0123456789abcdef", current: true, platform: "macos", appVersion: "0.9.4",
          activatedAt: state === "expired" ? "2024-10-14T09:41:00.000Z" : "2026-03-14T09:41:00.000Z",
          lastSeenAt: "2026-10-31T09:41:00.000Z" },
        { id: "abcdef0123456789", current: false, platform: "windows", appVersion: "0.9.4",
          activatedAt: "2026-04-02T09:41:00.000Z", lastSeenAt: "2026-10-28T21:14:00.000Z" },
      ] };
      else if ("currentPeriodEnd" in data) data = { ...data, usage,
        currentPeriodEnd: state === "expired" ? "2026-10-14T00:00:00.000Z" : "2027-03-14T00:00:00.000Z",
        status: state === "expired" ? "canceled" : "active" };
      else if (data.enforced === true && data.usage) data = { ...data, usage };
      else return bytes;
      return [...new TextEncoder().encode(JSON.stringify(data)), 0];
    };
  }, { state });
  const aiConfig = {
    endpoint: "https://openrouter.ai/api/v1",
    apiKey: "sk-or-v1-9d2f41c07ab35e68b1c4f7a02e93d51c",
    model: "anthropic/claude-sonnet-4.5",
    contextSize: 128000,
    inputPricePerMillionTokens: 3,
    outputPricePerMillionTokens: 15,
    allowActions: true,
    proactiveInsightsSummary: true,
    advanced: {
      temperature: 0.2,
      top_p: 0.9,
      headers: { "HTTP-Referer": "https://track3.dev", "X-Title": "Track3" },
      extraBody: { reasoning: { effort: "low" } },
      provider: "anthropic",
    },
  };
  const sourceConfig = `exchanges:
  - name: binance
    alias: Binance
    initParams: {apiKey: sample-binance-7Qf2, secret: sample-secret}
    active: true
  - name: okex
    alias: OKX
    initParams: {apiKey: sample-okx-c91e, secret: sample-secret, password: sample-passphrase}
    active: true
  - name: kraken
    alias: Kraken
    initParams: {apiKey: sample-kraken-3Ld0, secret: sample-secret}
    active: false
`;
  const walletConfig = `btc:
  addresses:
    - {address: bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwfx7k2, alias: Ledger cold wallet, active: true}
erc20:
  addresses:
    - {address: '0x4f2a8c1e9b07d3a5c6e41f8b2d90a7c3e5b1a91c', alias: '0x4f…a91c', active: true}
sol: {addresses: []}
doge: {addresses: []}
trc20: {addresses: []}
ton: {addresses: []}
sui: {addresses: []}
`;
  const customConfig = `configs:
  groupUSD: true
  hideInactive: false
others:
  - symbol: GOLD
    alias: Gold bars
    amount: 4
    price: {kind: manual, usd: 2650, setAt: '2026-10-31T09:41:00.000Z'}
  - symbol: NVDA-RSU
    alias: Unvested shares
    amount: 60
    price: {kind: follow, assetType: stock, symbol: NVDA, ratio: 1}
`;
  for (const [id, data] of [
    [10, `!ent:e2e:${sourceConfig}`],
    [11, walletConfig],
    [12, customConfig],
    [20, "!ent:e2e:brokers:\n  - name: ibkr\n    alias: Interactive Brokers\n    initParams: {queryId: '912406', token: sample-flex-token}\n    active: true\n"],
    [994, `!ent:e2e:${JSON.stringify(aiConfig)}`],
    [995, "ETHG,CLAIM-USDT,SHIBAI"],
    [997, area === "pro" && ["free", "activating", "invalid"].includes(state) ? "" : "!ent:e2e:T3P-8F2K-N4VD-6WXA-Q7M4"],
  ] as const) {
    await settingsBSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)", [id, data]);
  }
  if (area === "backup") {
    await settingsBSql(page, `WITH RECURSIVE seq(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM seq WHERE n < 1233)
      INSERT INTO assets_v2 (uuid, createdAt, wallet, asset_type, symbol, amount, value, price)
      SELECT 'backup-' || printf('%04d', n), strftime('%Y-%m-%dT%H:%M:%fZ', datetime('2025-01-01', '+' || (n * 13) || ' hours')),
      'backup-fixture', 'crypto', 'BTC', 1, 63842.11, 63842.11 FROM seq`);
    await settingsBSql(page, "INSERT OR IGNORE INTO history_snapshots (uuid, createdAt) SELECT uuid, MAX(createdAt) FROM assets_v2 WHERE uuid LIKE 'backup-%' GROUP BY uuid");
    await settingsBSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (4, '2026-10-01T03:00:00.000Z')");
  }
  if (area === "sync" && state !== "setup") {
    await settingsBSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)", [991, `!ent:e2e:${JSON.stringify(fidelitySyncSettings)}`]);
    await settingsBSql(page, "INSERT OR REPLACE INTO sync_state (id, data) VALUES (1, ?)",
      [JSON.stringify({ deviceId: "01234567-89ab-cdef-0123-456789abcdef", known: [] })]);
  }
  if (area === "security" && state !== "recovery-missing") {
    await settingsBSql(page, "INSERT OR REPLACE INTO configuration (id, data) VALUES (991, ?)", [`!ent:e2e:${JSON.stringify(fidelityRecoverySettings)}`]);
  }
  if (area === "ai") {
    const id = "fidelity-settings-ai-usage";
    const at = "2026-10-31T09:41:00.000Z";
    await settingsBSql(page,
      "INSERT INTO chat_sessions (id, title, createdAt, updatedAt, pinned, messageCount, preview) VALUES (?, ?, ?, ?, 0, 1, ?)",
      [id, "Monthly usage sample", at, at, "A model reply"]);
    const payload = `!ent:e2e:${JSON.stringify({ version: 1, messages: [{
      role: "assistant", blocks: [{ kind: "text", text: "A model reply" }],
      usage: { promptTokens: 1_284_300, completionTokens: 212_600, source: "reported" }, at,
    }] })}`;
    await page.evaluate(({ id, payload }) =>
      (window as any).__e2eInvoke("plugin:fs|write_text_file", [...new TextEncoder().encode(payload)],
        { headers: { path: encodeURIComponent(`/e2e/app/ai/sessions/${id}.json.ent`) } }), { id, payload });
  }
  return bridge;
}

export async function settingsBShot(page: Page, area: SettingsBPage, state: string) {
  const stem = state === "default" ? area : `${area}-${state}`;
  const height = Object.entries(designHeights).find(([, names]) => names.includes(stem))?.[0];
  if (!height) throw new Error(`Design size unknown: ${stem}`);
  const syncDialog = area === "sync" && ["disable", "forget", "confirm-use"].includes(state);
  const dialog = syncDialog || area === "backup" && state === "restore";
  const viewportShot = dialog || area === "sync" && (state.startsWith("pop-") || state === "toast")
    || area === "backup" && ["conflicts", "toast-ok", "toast-err"].includes(state);
  await page.setViewportSize({ width: 1600, height: Number(height) });
  if (dialog) await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  const output = `${captureRoot}/${area}`;
  mkdirSync(output, { recursive: true });
  const path = `${output}/${stem}-desktop.png`;
  await page.screenshot({ path, fullPage: !viewportShot, animations: "disabled" });
  mkdirSync(`${captureRoot}/settings-b`, { recursive: true });
  copyFileSync(path, `${captureRoot}/settings-b/${stem}-desktop.png`);
}

export const settingsBRoute: Record<SettingsBPage, string> = {
  pro: "/#/settings/systemInfo?section=pro",
  ai: "/#/settings/assistant",
  backup: "/#/settings/data?section=backup",
  security: "/#/settings/data?section=security",
  sync: "/#/settings/sync",
  about: "/#/settings/systemInfo?section=about",
};
