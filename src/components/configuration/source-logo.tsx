import { getWalletLogo } from "@/lib/utils";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";

// In dark mode, light marks need a dark tile and dark marks need a light one.
const darkTileLogos = new Set([
  "backpack", "binance", "bitget", "btc", "coinbase", "doge",
  "erc20", "sol", "sui", "ton",
]);

export function SourceLogo({ type, fallback, className }: {
  type: string;
  fallback: string;
  className: string;
}) {
  const logo = getWalletLogo(type);
  const hasLogo = logo !== UnknownLogo;
  return <span className={`t3-source-logo-tile ${className}`} aria-hidden="true"
    data-logo-tile={hasLogo ? "" : undefined}
    data-logo-type={hasLogo ? type : undefined}
    data-logo-tone={hasLogo ? darkTileLogos.has(type) ? "dark" : "light" : undefined}>
    {hasLogo ? <img src={logo} alt="" width="22" height="22" /> : fallback}
  </span>;
}
