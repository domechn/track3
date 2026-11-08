import { useEffect, useState } from "react";
import { TokensIcon } from "@radix-ui/react-icons";
import { appCacheDir } from "@tauri-apps/api/path";
import { WALLET_LOGS } from "@/middlelayers/constants";
import { getImageApiPath } from "@/utils/app";
import "./asset-icon.css";

const coinLogoLookups = new Map<string, Promise<string>>();

function coinLogoPath(symbol: string) {
  const key = symbol.toLowerCase();
  const existing = coinLogoLookups.get(key);
  if (existing) return existing;
  const lookup = Promise.resolve().then(() => appCacheDir()).then((dir) => getImageApiPath(dir, symbol))
    .then((path) => {
      if (!path) coinLogoLookups.delete(key);
      return path;
    }, () => {
      coinLogoLookups.delete(key);
      return "";
    });
  coinLogoLookups.set(key, lookup);
  return lookup;
}

export type AssetIconKind = "coin" | "exchange" | "wallet" | "broker" | "stock" | "custom";
export type AssetIconSize = 16 | 20 | 24 | 32;

type Props = {
  kind: AssetIconKind;
  symbol?: string;
  type?: string;
  src?: string | null;
  size: AssetIconSize;
  quiet?: boolean;
  decorative?: boolean;
  name?: string;
  className?: string;
};

export default function AssetIcon({ kind, symbol, type, src, size, quiet = false,
  decorative = false, name, className }: Props) {
  const identity = (symbol ?? name ?? type ?? "").trim();
  const coinKey = identity.toLowerCase() === "eth" ? "erc20" : identity.toLowerCase() === "trx" ? "trc20" : identity.toLowerCase();
  const brandName = (type ?? symbol ?? "").toLowerCase();
  const brandKey = brandName === "okx" ? "okex" :
    brandName === "gate.io" ? "gate" :
      brandName === "interactive brokers" ? "ibkr" : brandName;
  const [cachedLogo, setCachedLogo] = useState<{ symbol: string; path: string }>();
  useEffect(() => {
    if (kind !== "coin" || src || !symbol) return;
    let active = true;
    void coinLogoPath(symbol).then((path) => { if (active) setCachedLogo({ symbol, path }); });
    return () => { active = false; };
  }, [kind, src, symbol]);
  const logos = kind === "stock" || kind === "custom" ? [] :
    kind === "coin" ? [src, cachedLogo?.symbol === symbol ? cachedLogo?.path : "", WALLET_LOGS[coinKey]] :
      [src, WALLET_LOGS[brandKey]];
  const [failedLogos, setFailedLogos] = useState<string[]>([]);
  const logo = logos.find((path): path is string => !!path && !failedLogos.includes(path));
  const imageSize = size - 2 * (1 + Math.round(size * .14));
  const initials = identity.slice(0, size <= 20 ? 1 : 2).toUpperCase() || "?";
  return <span
    className={`t3-asset-icon${className ? ` ${className}` : ""}`}
    data-size={size}
    data-kind={kind}
    data-quiet={quiet && kind === "coin" ? "" : undefined}
    role={decorative ? undefined : "img"}
    aria-label={decorative ? undefined : name ?? identity}
    aria-hidden={decorative ? "true" : undefined}>
    {kind === "custom" ? <TokensIcon aria-hidden="true" width={imageSize} height={imageSize} /> :
      logo ? <img src={logo} width={imageSize} height={imageSize}
        loading="lazy" decoding="async" alt="" onError={() => setFailedLogos((failed) => [...failed, logo])} /> :
        <span className="t3-asset-icon-fallback" data-initials={initials} aria-hidden="true" />}
  </span>;
}
