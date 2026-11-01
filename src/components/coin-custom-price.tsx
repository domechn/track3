import { useEffect, useState } from "react";
import { getConfiguration } from "@/middlelayers/configuration";
import type { OtherPrice } from "@/middlelayers/datafetch/types";
import { validateCustomPrice } from "@/middlelayers/custom-price";

export default function CoinCustomPrice({
  symbol, assetType, locale, t,
}: {
  symbol: string;
  assetType: "crypto" | "stock";
  locale: string;
  t: (key: string) => string;
}) {
  const [price, setPrice] = useState<OtherPrice>();
  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => getConfiguration()).then((config) => {
      if (!active) return;
      const row = assetType === "crypto" ? config?.others.find((item) =>
        !item.attachTo && item.symbol.trim().toUpperCase() === symbol.trim().toUpperCase()
      ) : undefined;
      setPrice(row?.price && validateCustomPrice(row.price, config!.others.map((item) => item.symbol), row.symbol)
        ? row.price : undefined);
    }).catch(() => { if (active) setPrice(undefined); });
    return () => { active = false; };
  }, [symbol, assetType]);
  if (!price) return null;
  const text = price.kind === "manual"
    ? t("coin.customPrice.manual").replace("{date}", new Date(price.setAt).toLocaleDateString(locale))
    : t("coin.customPrice.follow").replace("{symbol}", price.symbol);
  return <p className="text-xs text-muted-foreground">{text}{price.kind === "manual" && price.note ? ` · ${price.note}` : ""}</p>;
}
