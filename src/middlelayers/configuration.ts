import { invoke } from "@tauri-apps/api/core";
import { getDatabase } from "./database";
import { GlobalConfig, StockConfig } from "./datafetch/types";
import {
  AIAdvancedOptions,
  AIConfig,
  ConfigurationModel,
  CurrencyRateDetail,
} from "./types";
import yaml from "yaml";
import { CURRENCY_RATE_HANDLER } from "./entities/currency";
import { ASSET_HANDLER } from "./entities/assets";
import { DateRange } from "react-day-picker";
import { Theme } from "@/components/common/theme";

// todo: update to dedicated domain
export const PRO_API_ENDPOINT = "https://track3-pro-api.domc.me";

const prefix = "!ent:";
const generalFixId = "1";

const exchangesConfigId = "10";
const walletsConfigId = "11";
const generalConfigId = "12";
const stockConfigId = "20";

const walletKeys = [
  "btc",
  "erc20",
  "sol",
  "doge",
  "trc20",
  "ton",
  "sui",
] as const;

const autoBackupId = "3";
const lastAutoBackupAtId = "4";
const lastAutoImportAtId = "5";
const querySizeId = "6";
const preferCurrencyId = "7";
const quoteColorId = "8";
const clientInfoFixId = "998";
const licenseFixId = "997";
const stableCoinsId = "996";
const blacklistCoinsId = "995";
const aiConfigId = "994";
const preferCurrencyLocalStorageKey = "track3-prefer-currency";

export const themeLocalStorageKey = "track3-ui-theme";

// Thrown by loadAIConfig / saveAIConfig when no AI configuration is persisted
// yet. The chat page catches this and renders the "configure first" empty state.
export class AIConfigMissingError extends Error {
  constructor(message = "AI configuration is not set") {
    super(message);
    this.name = "AIConfigMissingError";
  }
}

export const DEFAULT_AI_CONTEXT_SIZE = 8192;

function validateAIConfig(cfg: AIConfig): void {
  if (!cfg || typeof cfg !== "object") {
    throw new AIConfigMissingError("AI configuration is not set");
  }
  if (!cfg.endpoint || !cfg.endpoint.trim()) {
    throw new AIConfigMissingError("AI configuration is missing endpoint");
  }
  if (typeof cfg.apiKey !== "string") {
    throw new AIConfigMissingError("AI configuration is missing apiKey");
  }
  if (!cfg.model || !cfg.model.trim()) {
    throw new AIConfigMissingError("AI configuration is missing model");
  }
  if (
    typeof cfg.contextSize !== "number" ||
    !Number.isFinite(cfg.contextSize) ||
    cfg.contextSize <= 0
  ) {
    throw new AIConfigMissingError("AI configuration is missing contextSize");
  }
}

// loadAIConfig returns the persisted AI configuration. Throws
// AIConfigMissingError when nothing has been saved yet so the UI can
// branch on the empty state.
export async function loadAIConfig(): Promise<AIConfig> {
  // Migration: legacy AI config was stored at id "999", which conflicted
  // with the Rust backend's VERSION_CONFIGURATION_ID (also 999).
  // If the new id (994) is empty, read from 999 and migrate it forward.
  // Only migrate if the data looks like valid AI config JSON (not the version string
  // that prepare_required_data may have written to id=999).
  const legacyModel = await getConfigurationById("999");
  if (legacyModel && legacyModel.data) {
    let isAIConfig = false;
    try {
      const parsed = JSON.parse(legacyModel.data);
      isAIConfig = parsed && typeof parsed === "object" && typeof parsed.endpoint === "string";
    } catch {
      // not valid JSON — probably the app version string, skip migration
    }
    if (isAIConfig) {
      await saveConfigurationById(aiConfigId, legacyModel.data, true);
      await deleteConfigurationById("999");
    }
  }

  const model = await getConfigurationById(aiConfigId);
  if (!model || !model.data) {
    throw new AIConfigMissingError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(model.data);
  } catch (e) {
    throw new AIConfigMissingError(
      `AI configuration is not valid JSON: ${(e as Error).message}`,
    );
  }
  const cfg = parsed as AIConfig;
  validateAIConfig(cfg);
  return cfg;
}

// saveAIConfig validates the input and persists it encrypted under the
// aiConfigId slot. Throws AIConfigMissingError when a required field is
// missing so the UI can surface the error consistently.
export async function saveAIConfig(cfg: AIConfig): Promise<void> {
  validateAIConfig(cfg);
  const sanitized: AIConfig = {
    endpoint: cfg.endpoint.trim().replace(/\/+$/, ""),
    apiKey: cfg.apiKey,
    model: cfg.model.trim(),
    contextSize: Math.max(1, Math.floor(cfg.contextSize)),
    advanced: cfg.advanced ? sanitizeAIAdvanced(cfg.advanced) : undefined,
  };
  await saveConfigurationById(aiConfigId, JSON.stringify(sanitized), true);
}

// cleanAIConfig removes the AI configuration slot.
export async function cleanAIConfig(): Promise<void> {
  return deleteConfigurationById(aiConfigId);
}

const RESERVED_HEADERS = new Set([
  "authorization",
  "host",
  "cookie",
  "content-length",
  "transfer-encoding",
  "connection",
  "expect",
  "upgrade",
]);

function sanitizeAIAdvanced(advanced: AIAdvancedOptions): AIAdvancedOptions {
  const out: AIAdvancedOptions = {};
  if (typeof advanced.temperature === "number") {
    out.temperature = advanced.temperature;
  }
  if (typeof advanced.top_p === "number") {
    out.top_p = advanced.top_p;
  }
  if (advanced.headers && typeof advanced.headers === "object") {
    out.headers = Object.fromEntries(
      Object.entries(advanced.headers).filter(
        ([k, v]) => typeof v === "string" && !RESERVED_HEADERS.has(k.toLowerCase()),
      ),
    );
  }
  if (advanced.extraBody && typeof advanced.extraBody === "object") {
    out.extraBody = { ...advanced.extraBody };
  }
  if (
    advanced.provider === "openai" ||
    advanced.provider === "anthropic" ||
    advanced.provider === "custom"
  ) {
    out.provider = advanced.provider;
  }
  return out;
}

export async function getConfiguration(): Promise<GlobalConfig | undefined> {
  const [exchangesModel, walletsModel, generalModel, stockConfig] =
    await Promise.all([
      getConfigurationById(exchangesConfigId),
      getConfigurationById(walletsConfigId),
      getConfigurationModelById(generalConfigId),
      getStockConfig(),
    ]);

  // new-format exists: merge and return
  if (exchangesModel || walletsModel || generalModel) {
    const exchanges = exchangesModel
      ? yaml.parse(exchangesModel.data)
      : { exchanges: [] };
    const wallets = walletsModel ? yaml.parse(walletsModel.data) : {};
    const general = generalModel
      ? yaml.parse(generalModel.data)
      : { configs: { groupUSD: false }, others: [] };

    return {
      ...exchanges,
      ...wallets,
      ...general,
      stockConfig,
    } as GlobalConfig;
  }

  // fallback: legacy id=1
  const legacyModel = await getConfigurationById(generalFixId);
  if (!legacyModel) {
    return;
  }

  const cfg = yaml.parse(legacyModel.data) as GlobalConfig;
  cfg.stockConfig = stockConfig;
  await migrateConfigurationToSplit(cfg);
  return cfg;
}

export async function saveConfiguration(cfg: GlobalConfig) {
  const exchangesData = yaml.stringify({ exchanges: cfg.exchanges });
  const walletsData = yaml.stringify(Object.fromEntries(walletKeys.filter(k => k in cfg).map(k => [k, cfg[k]])));
  const generalData = yaml.stringify({
    configs: cfg.configs,
    others: cfg.others,
  });

  // Serialize writes to prevent transaction conflicts on the shared SQLite connection.
  await saveConfigurationById(exchangesConfigId, exchangesData);
  await saveConfigurationById(walletsConfigId, walletsData);
  await saveConfigurationById(generalConfigId, generalData, false);
  await saveStockConfig(cfg.stockConfig ?? { brokers: [] });
}

export async function getStockConfig(): Promise<StockConfig> {
  const model = await getConfigurationById(stockConfigId);
  if (!model?.data) {
    return { brokers: [] };
  }
  return yaml.parse(model.data) as StockConfig;
}

export async function saveStockConfig(cfg: StockConfig) {
  return saveConfigurationById(stockConfigId, yaml.stringify(cfg));
}

// used for import data
export async function importRawConfiguration(data: string) {
  let raw = data;
  if (raw.startsWith(prefix)) {
    try {
      raw = await invoke<string>("decrypt", { data: raw });
    } catch {
      // The data was encrypted with a different key — ask the user for
      // the original export key so we can still import it.
      const customKey = window.prompt?.(
        "The imported configuration was encrypted with a different key.\n" +
        "Please enter the encryption key that was used when exporting:",
      );
      if (!customKey) throw new Error("Import cancelled: no decryption key provided");
      raw = await invoke<string>("decrypt_with_key", { data: raw, key: customKey });
    }
  }
  const cfg = yaml.parse(raw) as GlobalConfig;
  await saveConfiguration(cfg);
  await deleteConfigurationById(generalFixId);
}

async function migrateConfigurationToSplit(cfg: GlobalConfig) {
  await saveConfiguration(cfg);
  await deleteConfigurationById(generalFixId);
}

async function saveConfigurationById(id: string, cfg: string, encrypt = true) {
  const db = await getDatabase();
  // encrypt data
  const saveStr = encrypt
    ? await invoke<string>("encrypt", { data: cfg })
    : cfg;

  await db.execute(
    `INSERT OR REPLACE INTO configuration (id, data) VALUES (?, ?)`,
    [id, saveStr],
  );
}

async function deleteConfigurationById(id: string) {
  const db = await getDatabase();
  await db.execute(`DELETE FROM configuration WHERE id = ?`, [id]);
}

export async function exportConfigurationString(): Promise<string | undefined> {
  const cfg = await getConfiguration();
  if (!cfg) {
    return;
  }
  const data = yaml.stringify(cfg);
  return invoke<string>("encrypt", { data });
}

async function getConfigurationById(
  id: string,
): Promise<ConfigurationModel | undefined> {
  const model = await getConfigurationModelById(id);
  if (!model) {
    return;
  }

  const cfg = model.data;

  // legacy logic
  if (!cfg.startsWith(prefix)) {
    return model;
  }

  // decrypt data
  return invoke<string>("decrypt", { data: cfg })
    .then((res) => {
      return {
        ...model,
        data: res,
      };
    })
    .catch((err) => {
      if ((typeof err === "string" && err.includes("not ent")) || (err instanceof Error && err.message.includes("not ent"))) {
        return model;
      }
      throw err;
    });
}

export async function getInitialQueryDateRange(): Promise<{
  size: number;
  dr: DateRange;
}> {
  const size = await queryQuerySize();

  const days = await ASSET_HANDLER.getHasDataCreatedAtDates(size);
  const from = new Date(Math.min(...days.map((d) => d.getTime())));
  const to = new Date(Math.max(...days.map((d) => d.getTime())));

  return {
    size,
    dr: {
      from,
      to,
    },
  };
}

export async function queryQuerySize(): Promise<number> {
  const model = await getConfigurationById(querySizeId);
  return model?.data ? parseInt(model.data) : 10;
}

export async function saveQuerySize(size: number) {
  await saveConfigurationById(querySizeId, size.toString(), false);
}

export async function updateAllCurrencyRates() {
  return CURRENCY_RATE_HANDLER.updateAllCurrencyRates();
}

export async function listAllCurrencyRates() {
  return CURRENCY_RATE_HANDLER.listCurrencyRates();
}

export function getDefaultCurrencyRate() {
  return CURRENCY_RATE_HANDLER.getDefaultCurrencyRate();
}

export async function queryPreferCurrency(): Promise<CurrencyRateDetail> {
  const model = await getConfigurationById(preferCurrencyId);
  const pc = model?.data;

  if (!pc) {
    const defaultRate = CURRENCY_RATE_HANDLER.getDefaultCurrencyRate();
    cachePreferCurrency(defaultRate.currency);
    return defaultRate;
  }

  const rate = await CURRENCY_RATE_HANDLER.getCurrencyRateByCurrency(pc);
  cachePreferCurrency(rate.currency);
  return rate;
}

export async function savePreferCurrency(currency: string) {
  cachePreferCurrency(currency);
  await saveConfigurationById(preferCurrencyId, currency, false);
}

export function getCachedPreferCurrency(): string | undefined {
  try {
    const cached = localStorage.getItem(preferCurrencyLocalStorageKey)?.trim();
    return cached ? cached.toUpperCase() : undefined;
  } catch {
    return undefined;
  }
}

function cachePreferCurrency(currency: string) {
  if (!currency) {
    return;
  }

  try {
    localStorage.setItem(preferCurrencyLocalStorageKey, currency.toUpperCase());
  } catch {
    // Ignore cache write failures, persisted configuration remains source of truth.
  }
}

export async function getClientIDConfiguration(): Promise<string | undefined> {
  const model = await getConfigurationById(clientInfoFixId);
  return model?.data;
}

async function getConfigurationModelById(
  id: string,
): Promise<ConfigurationModel | undefined> {
  const db = await getDatabase();
    const configurations = await db.select<ConfigurationModel[]>(
      `SELECT * FROM configuration where id = ?`,
      [id],
    );
  if (configurations.length === 0) {
    return undefined;
  }

  return configurations[0];
}

export async function getStableCoins(): Promise<string[]> {
  const model = await getConfigurationById(stableCoinsId);
  return model?.data ? model.data.split(",") : [];
}

export async function saveStableCoins(stableCoins: string[]) {
  return saveConfigurationById(stableCoinsId, stableCoins.join(","), false);
}

// blacklist
function normalizeBlacklistSymbols(symbols: string[]): string[] {
  return Array.from(
    new Set(
      symbols.map((s) => s.trim().toUpperCase()).filter((s) => s.length > 0),
    ),
  );
}

export async function getBlacklistCoins(): Promise<string[]> {
  const model = await getConfigurationById(blacklistCoinsId);
  return model?.data ? normalizeBlacklistSymbols(model.data.split(",")) : [];
}

export async function saveBlacklistCoins(symbols: string[]) {
  return saveConfigurationById(
    blacklistCoinsId,
    normalizeBlacklistSymbols(symbols).join(","),
    false,
  );
}

export async function addToBlacklist(symbol: string) {
  const current = await getBlacklistCoins();
  await saveBlacklistCoins([...current, symbol]);
}

export async function removeFromBlacklist(symbol: string) {
  const upper = symbol.trim().toUpperCase();
  const current = await getBlacklistCoins();
  await saveBlacklistCoins(current.filter((s) => s.toUpperCase() !== upper));
}

// license
export async function saveLicense(license: string) {
  return saveConfigurationById(licenseFixId, license);
}

// license
export async function cleanLicense() {
  return deleteConfigurationById(licenseFixId);
}

// auto backup
export async function getAutoBackupDirectory(): Promise<string | undefined> {
  return getConfigurationModelById(autoBackupId).then((m) => m?.data);
}

// auto backup
export async function saveAutoBackupDirectory(d: string) {
  return saveConfigurationById(autoBackupId, d, false);
}

// auto backup
export async function cleanAutoBackupDirectory() {
  return deleteConfigurationById(autoBackupId);
}

// if user has pro license, return license string
export async function getLicenseIfIsPro(): Promise<string | undefined> {
  const model = await getConfigurationById(licenseFixId);
  return model?.data;
}

// get last auto backup time, if never backup, return 1970-01-01
export async function getLastAutoBackupAt(): Promise<Date> {
  const model = await getConfigurationById(lastAutoBackupAtId);
  return model?.data
    ? new Date(model.data)
    : new Date("1970-01-01T00:00:00.000Z");
}

// if d is undefined, use latest time
export async function saveLastAutoBackupAt(d?: Date) {
  return saveConfigurationById(
    lastAutoBackupAtId,
    d ? d.toISOString() : new Date().toISOString(),
    false,
  );
}

// get last auto import time, if never backup, return 1970-01-01
export async function getLastAutoImportAt(): Promise<Date> {
  const model = await getConfigurationById(lastAutoImportAtId);
  return model?.data
    ? new Date(model.data)
    : new Date("1970-01-01T00:00:00.000Z");
}

// if d is undefined, use latest time
export async function saveLastAutoImportAt(d?: Date) {
  return saveConfigurationById(
    lastAutoImportAtId,
    d ? d.toISOString() : new Date().toISOString(),
    false,
  );
}

export async function saveQuoteColor(
  qc: "green-up-red-down" | "red-up-green-down",
) {
  const val = qc === "green-up-red-down" ? 0 : 1;

  return saveConfigurationById(quoteColorId, val.toString(), false);
}

export async function getQuoteColor(): Promise<
  "green-up-red-down" | "red-up-green-down"
> {
  const model = await getConfigurationById(quoteColorId);
  const val = model?.data ? parseInt(model.data) : 0;

  return val === 0 ? "green-up-red-down" : "red-up-green-down";
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(themeLocalStorageKey, theme);
}
