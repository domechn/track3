export type SyncCategory = "settings" | "secrets" | "rebalance";
type ConfigCategory = SyncCategory | "local";
type ConfigurationKey = { category: ConfigCategory; encrypted: boolean };

const CONFIGURATION_KEYS: Record<string, ConfigurationKey> = {
  "1": { category: "local", encrypted: true },
  "3": { category: "local", encrypted: false },
  "4": { category: "local", encrypted: false },
  "5": { category: "local", encrypted: false },
  "6": { category: "settings", encrypted: false },
  "7": { category: "settings", encrypted: false },
  "8": { category: "settings", encrypted: false },
  "9": { category: "local", encrypted: false },
  "10": { category: "secrets", encrypted: true },
  "11": { category: "secrets", encrypted: true },
  "12": { category: "settings", encrypted: false },
  "20": { category: "secrets", encrypted: true },
  "991": { category: "local", encrypted: true },
  "992": { category: "local", encrypted: true },
  "993": { category: "settings", encrypted: false },
  "994": { category: "secrets", encrypted: true },
  "995": { category: "settings", encrypted: false },
  "996": { category: "local", encrypted: false },
  "997": { category: "local", encrypted: true },
  "998": { category: "local", encrypted: false },
  "999": { category: "local", encrypted: false },
  rebalance: { category: "rebalance", encrypted: false },
};

export function configurationKey(id: string): ConfigurationKey | undefined {
  return CONFIGURATION_KEYS[id];
}

export function syncCategory(id: string): SyncCategory | undefined {
  const category = configurationKey(id)?.category;
  return category === "local" ? undefined : category;
}
