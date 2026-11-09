import { openUrl } from "@tauri-apps/plugin-opener";
import { isIOS } from "@/utils/platform";
import { localeLocalStorageKey } from "@/i18n";
import en from "@/i18n/locales/en.json";
import zh from "@/i18n/locales/zh.json";

export const externalLinks = {
  docs: "https://track3.dev/docs/",
  website: "https://track3.dev",
  pro: "https://track3.dev/#pro",
  privacy: "https://track3.dev/#privacy",
  github: "https://github.com/domechn/track3",
  issues: "https://github.com/domechn/track3/issues",
  releases: "https://github.com/domechn/track3/releases",
  changelog: "https://github.com/domechn/track3/releases",
  latestRelease: "https://github.com/domechn/track3/releases/latest",
  license: "https://github.com/domechn/track3/blob/master/LICENSE",
  dropsAddress: "https://drops.bot/address/",
  debankProfile: "https://debank.com/profile/",
  bitcoinAddress: "https://www.blockchain.com/explorer/addresses/btc/",
  jupiterPortfolio: "https://portfolio.jup.ag/portfolio/",
} as const satisfies Record<string, `https://${string}`>;

export type ExternalLinkKey = keyof typeof externalLinks;

export async function openExternal(key: ExternalLinkKey, onError?: () => void): Promise<void> {
  try {
    await openUrl(externalLinks[key]);
  } catch {
    onError?.();
    let locale = typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
    try {
      if (localStorage.getItem(localeLocalStorageKey) === "zh") locale = "zh";
      if (localStorage.getItem(localeLocalStorageKey) === "en") locale = "en";
    } catch {
      // The detected locale still works when storage is unavailable.
    }
    const description = locale === "zh" ? zh["externalLinks.openFailed"] : en["externalLinks.openFailed"];
    const { toast } = isIOS()
      ? await import("@/mobile/components/ui/use-toast")
      : await import("@/components/ui/use-toast");
    toast({ description, variant: "destructive" });
  }
}
