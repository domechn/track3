import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { validateCustomPrice } from "@/middlelayers/custom-price";
import type { AssetType, OtherPrice } from "@/middlelayers/datafetch/types";

export type PriceDraft = {
  kind: "market" | "manual" | "follow";
  amount: string;
  note: string;
  assetType: AssetType;
  symbol: string;
  ratio: string;
};

const displayManualAmount = (usd: number, rate: number) =>
  String(Number((usd * rate).toPrecision(12)));

export function priceDraft(price?: OtherPrice, rate = 1): PriceDraft {
  return {
    kind: price?.kind ?? "market",
    amount: price?.kind === "manual" && Number.isFinite(rate) && rate > 0 ? displayManualAmount(price.usd, rate) : "",
    note: price?.kind === "manual" ? price.note ?? "" : "",
    assetType: price?.kind === "follow" ? price.assetType : "crypto",
    symbol: price?.kind === "follow" ? price.symbol : "",
    ratio: price?.kind === "follow" ? String(price.ratio) : "1",
  };
}

export function parsePriceDraft(
  draft: PriceDraft,
  others: readonly { symbol: string }[],
  ownSymbol: string,
  previous?: OtherPrice,
  rate = 1,
): { price?: OtherPrice; valid: boolean } {
  if (draft.kind === "market") return { valid: true };
  let price: OtherPrice;
  if (draft.kind === "manual") {
    if (!draft.amount.trim() || !Number.isFinite(rate) || rate <= 0) return { valid: false };
    const usd = previous?.kind === "manual" && draft.amount.trim() === displayManualAmount(previous.usd, rate)
      ? previous.usd : Number(draft.amount) / rate;
    const note = draft.note.trim();
    const same = previous?.kind === "manual" && previous.usd === usd &&
      (previous.note ?? "") === note;
    price = {
      kind: "manual", usd,
      setAt: same ? previous.setAt : new Date().toISOString(),
      ...(note ? { note } : {}),
    };
  } else {
    if (!draft.ratio.trim()) return { valid: false };
    price = {
      kind: "follow",
      assetType: draft.assetType,
      symbol: draft.symbol.trim().toUpperCase(),
      ratio: Number(draft.ratio),
    };
  }
  return { price, valid: validateCustomPrice(price, others.map((row) => row.symbol), ownSymbol) };
}

export function CustomPriceFields({
  draft, onChange, t, currency = "USD", rate = 1,
}: {
  draft: PriceDraft;
  onChange: (draft: PriceDraft) => void;
  t: (key: string) => string;
  currency?: string;
  rate?: number;
}) {
  return <div className="space-y-4">
    <div className="space-y-2">
      <Label>{t("config.customPrice.mode")}</Label>
      <RadioGroup aria-label={t("config.customPrice.mode")} value={draft.kind} onValueChange={(kind) => onChange({ ...draft, kind: kind as PriceDraft["kind"] })} className="grid gap-2">
        {(["market", "manual", "follow"] as const).map((kind) => <label key={kind} className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 text-sm text-foreground">
          <RadioGroupItem value={kind} aria-label={t(`config.customPrice.${kind}`)} />
          <span>{t(`config.customPrice.${kind}`)}</span>
        </label>)}
      </RadioGroup>
    </div>
    {draft.kind === "manual" && <>
      <div className="space-y-2">
        <Label htmlFor="custom-price-amount">{t("config.customPrice.perUnit").replace("{currency}", currency)}</Label>
        <Input id="custom-price-amount" type="number" inputMode="decimal" min="0" step="any" value={draft.amount}
          onChange={(event) => onChange({ ...draft, amount: event.target.value })} />
      </div>
      {(!Number.isFinite(rate) || rate <= 0) && <p role="status" className="text-xs text-muted-foreground">{t("config.customPrice.rateUnavailable")}</p>}
      <div className="space-y-2">
        <Label htmlFor="custom-price-note">{t("config.customPrice.note")}</Label>
        <Input id="custom-price-note" maxLength={140} value={draft.note}
          onChange={(event) => onChange({ ...draft, note: event.target.value })} />
      </div>
    </>}
    {draft.kind === "follow" && <>
      <div className="space-y-2">
        <Label htmlFor="custom-price-type">{t("config.customPrice.assetType")}</Label>
        <select id="custom-price-type" className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={draft.assetType} onChange={(event) => onChange({ ...draft, assetType: event.target.value as AssetType })}>
          <option value="crypto">{t("coin.assetType.crypto")}</option>
          <option value="stock">{t("coin.assetType.stock")}</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom-price-symbol">{t("config.customPrice.symbol")}</Label>
        <Input id="custom-price-symbol" autoCapitalize="characters" value={draft.symbol}
          onChange={(event) => onChange({ ...draft, symbol: event.target.value })} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom-price-ratio">{t("config.customPrice.ratio")}</Label>
        <Input id="custom-price-ratio" type="number" inputMode="decimal" min="0" step="any" value={draft.ratio}
          onChange={(event) => onChange({ ...draft, ratio: event.target.value })} />
      </div>
    </>}
    <p className="text-xs text-muted-foreground">{t("config.customPrice.fallbackHint")}</p>
  </div>;
}
