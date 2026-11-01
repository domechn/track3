import type { GlobalConfig, StockConfig, TokenConfig } from "@/middlelayers/datafetch/types";
import { SUPPORT_CONS } from "@/middlelayers/constants";
import type { SyncCategoryName, SyncSettings } from "@/middlelayers/sync/settings";
import type { AIAdvancedOptions, AIConfig } from "@/middlelayers/types";
import { DEFAULT_AI_CONTEXT_SIZE } from "@/middlelayers/configuration";
import { configuredSecretValues } from "@/middlelayers/security/redact";

export type ConfigForm = {
  exchanges: Array<{ type: string; alias?: string; apiKey: string; secret: string; password?: string; passphrase?: string; active: boolean }>;
  stockBrokers: Array<{ type: string; alias?: string; token: string; queryId: string; active: boolean }>;
  wallets: Array<{ type: string; alias?: string; address: string; active: boolean }>;
  groupUSD: boolean;
  hideInactive: boolean;
  others: GlobalConfig["others"];
};

export function configurationFromForm({ exchanges, stockBrokers, wallets, groupUSD, hideInactive, others }: ConfigForm): GlobalConfig {
  const exchangesData = exchanges.map((ex) => ({
      name: ex.type,
      alias: ex.alias,
      initParams: {
        apiKey: ex.apiKey,
        secret: ex.secret,
        password: ex.type !== "okex" ? undefined : ex.password,
        passphrase: ex.type !== "bitget" ? undefined : ex.passphrase,
      },
      active: ex.active,
    }));

  const stockBrokerData: StockConfig = {
    brokers: stockBrokers.map((broker) => ({
        name: broker.type,
        alias: broker.alias,
        initParams: {
          token: broker.token,
          queryId: broker.queryId,
        },
        active: broker.active,
      })),
  };

  const walletData = wallets.reduce<Record<string, { addresses: Array<{ alias?: string; address: string; active?: boolean }> }>>((acc, w) => {
    if (!acc[w.type]) {
      acc[w.type] = { addresses: [] }
    }
    acc[w.type].addresses.push({
      alias: w.alias,
      address: w.address,
      active: w.active,
    })
    return acc
  }, {}) as any as TokenConfig;

  return {
    configs: { groupUSD, hideInactive },
    exchanges: exchangesData,
    stockConfig: stockBrokerData,
    ...Object.fromEntries(SUPPORT_CONS.map((c) => [c, { addresses: [] }])),
    ...walletData,
    others,
  };
}

export const syncCategories: SyncCategoryName[] = ["history", "settings", "secrets", "rebalance", "chat"];
export const syncFields = ["endpoint", "region", "bucket", "prefix", "accessKeyId", "secretAccessKey"] as const;
export type SyncField = typeof syncFields[number];
export const syncFormWithField = (current: SyncSettings, name: SyncField, value: string): SyncSettings => ({ ...current, [name]: value });
export const syncFormWithPathStyle = (current: SyncSettings, checked: boolean): SyncSettings => ({ ...current, pathStyle: checked });
export const syncFormWithCategory = (current: SyncSettings, category: SyncCategoryName, checked: boolean): SyncSettings => ({
  ...current, categories: { ...current.categories, [category]: checked },
});

export function invalidConfigurationFields(form: SyncSettings): Set<SyncField> {
  const invalid = new Set<SyncField>();
  let endpoint: URL | undefined;
  try { endpoint = new URL(form.endpoint.trim()); } catch { invalid.add("endpoint"); }
  if (endpoint && ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname))) ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    (!form.pathStyle && (endpoint.pathname !== "/" ||
      ["localhost", "127.0.0.1"].includes(endpoint.hostname))))) invalid.add("endpoint");
  if (!form.region.trim()) invalid.add("region");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(form.bucket.trim())) invalid.add("bucket");
  const prefix = form.prefix.trim().replace(/^\/+|\/+$/g, "");
  if (prefix && prefix.split("/").some((part) => !part || /^(?:\.|%2e){1,2}$/i.test(part))) invalid.add("prefix");
  if (!form.accessKeyId.trim()) invalid.add("accessKeyId");
  if (!form.secretAccessKey) invalid.add("secretAccessKey");
  return invalid;
}

const ALLOWED_ADVANCED_KEYS = [
  "temperature",
  "top_p",
  "headers",
  "extraBody",
  "provider",
] as const;

export function serializeAdvanced(advanced?: AIAdvancedOptions): string {
  if (!advanced) return "";
  // Stable JSON so the textarea does not reshuffle keys on every render.
  return JSON.stringify(advanced, null, 2);
}

export function parseAdvanced(
  raw: string,
): { value?: AIAdvancedOptions; error?: string; warnings: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined, warnings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return {
      error: "settings.assistant.invalidJson",
      warnings: [],
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "settings.assistant.invalidAdvancedObject", warnings: [] };
  }
  const warnings: string[] = [];
  const value: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if ((ALLOWED_ADVANCED_KEYS as readonly string[]).includes(k)) {
      if (
        ((k === "temperature" || k === "top_p") && (typeof v !== "number" || !Number.isFinite(v))) ||
        (k === "provider" && !["openai", "anthropic", "custom"].includes(String(v))) ||
        (k === "headers" && (v === null || typeof v !== "object" || Array.isArray(v) || Object.values(v).some((header) => typeof header !== "string"))) ||
        (k === "extraBody" && (v === null || typeof v !== "object" || Array.isArray(v)))
      ) {
        return { error: "settings.assistant.invalidAdvancedValue", warnings: [] };
      }
      value[k] = v as never;
    } else {
      warnings.push(k);
    }
  }
  return { value: value as AIAdvancedOptions, warnings };
}


export function assistantConfigFromForm(form: {
  endpoint: string; apiKey: string; model: string; contextSize: number; allowActions: boolean;
  inputPrice: string; outputPrice: string; advanced?: AIAdvancedOptions; proactiveInsightsSummary: boolean;
}): AIConfig {
  const inputTokenPrice = form.inputPrice.trim() === "" ? undefined : Number(form.inputPrice);
  const outputTokenPrice = form.outputPrice.trim() === "" ? undefined : Number(form.outputPrice);
  return {
    endpoint: form.endpoint.trim(),
    apiKey: form.apiKey,
    model: form.model.trim(),
    contextSize: Number.isFinite(form.contextSize)
      ? Math.max(1, Math.floor(form.contextSize))
      : DEFAULT_AI_CONTEXT_SIZE,
    allowActions: form.allowActions,
    inputPricePerMillionTokens: inputTokenPrice,
    outputPricePerMillionTokens: outputTokenPrice,
    advanced: form.advanced,
    proactiveInsightsSummary: form.proactiveInsightsSummary,
  };
}

export function assistantPriceInvalid(inputPrice: string, outputPrice: string): boolean {
  const inputTokenPrice = inputPrice.trim() === "" ? undefined : Number(inputPrice);
  const outputTokenPrice = outputPrice.trim() === "" ? undefined : Number(outputPrice);
  return [inputTokenPrice, outputTokenPrice].some((price) => price !== undefined && (!Number.isFinite(price) || price < 0));
}

export function assistantSettingsSecrets(raw: string): string[] {
  try {
    const value = JSON.parse(raw) as { headers?: Record<string, unknown> };
    return [...configuredSecretValues(value), ...Object.values(value.headers ?? {}).filter((item): item is string => typeof item === "string")];
  } catch {
    return [];
  }
}

export const initialConfiguration: GlobalConfig = {
  configs: {
    groupUSD: true,
    hideInactive: false,
  },
  exchanges: [],
  stockConfig: {
    brokers: [],
  },
  erc20: { addresses: [] },
  btc: { addresses: [] },
  sol: { addresses: [] },
  doge: { addresses: [] },
  trc20: { addresses: [] },
  ton: { addresses: [] },
  sui: { addresses: [] },
  others: [],
};


export function configurationToForm(globalConfig: GlobalConfig): ConfigForm {
  return {
    groupUSD: !!globalConfig.configs.groupUSD,
    hideInactive: !!globalConfig.configs.hideInactive,
    exchanges: (globalConfig.exchanges || []).map((ex) => ({
      type: ex.name,
      alias: ex.alias,
      apiKey: ex.initParams.apiKey,
      secret: ex.initParams.secret,
      password: ex.initParams.password,
      passphrase: ex.initParams.passphrase,
      active: ex.active ?? true,
    })),
    stockBrokers: ((globalConfig.stockConfig?.brokers ?? [])).map((broker) => ({
      type: broker.name,
      alias: broker.alias,
      token: broker.initParams.token,
      queryId: broker.initParams.queryId,
      active: broker.active ?? true,
    })),
    wallets: Object.keys(globalConfig)
      .filter(k => SUPPORT_CONS.includes(k))
      .flatMap((k: string) => {
        const v = (globalConfig as any)[k];
        const addresses = v?.addresses || [];
        return addresses.map((a: any) => {
          if (typeof a === "string") {
            return { type: k, address: a, active: true };
          }
          const na = a as {
            address: string;
            alias?: string;
            active?: boolean;
          };
          return {
            type: k,
            address: na.address,
            alias: na.alias,
            active: na.active ?? true,
          };
        });
      }),
    others: globalConfig.others,
  };
}
