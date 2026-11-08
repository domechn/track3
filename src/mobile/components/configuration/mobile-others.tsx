import AssetLabel from "@/components/common/asset-label";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/mobile/i18n";
import { ConfirmSheet, ModalPage } from "@/mobile/components/mobile/overlays";
import { ActionSheet } from "@/mobile/components/mobile";
import { BackpackIcon, Cross2Icon, DotsHorizontalIcon, Link2Icon, LockClosedIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import type { OtherRow } from "@/components/configuration/types";
import { CustomPriceFields, parsePriceDraft, priceDraft } from "@/components/configuration/custom-price-fields";
import type { PriceDraft } from "@/components/configuration/custom-price-fields";
import { validateCustomPrice } from "@/middlelayers/custom-price";
import { ASSET_HANDLER } from "@/middlelayers/entities/assets";
import { encodedAttachTo, parseAttachTo } from "@/utils/attach-to";
import type { SelectOption } from "@/components/configuration/types";

function displayPriceAmount(value: string) {
  if (!/^\d+(?:\.\d*)?$/.test(value)) return value;
  const [integer, fraction = ""] = value.split(".");
  return `${integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0")}`;
}

export function MobileOthers(props: {
  others: OtherRow[];
  baseCurrency?: { currency: string; rate: number };
  onSave: (index: number | null, value: OtherRow) => void;
  onRemove: (index: number) => void;
  onAttach: (index: number, fromMenu?: boolean) => void;
  hideEmpty?: boolean;
  addRequest?: number;
  onAddRequestHandled?: () => void;
  editSymbol?: string;
  fidelityLayout?: boolean;
  attachOptions?: SelectOption[];
  attachLabel?: (attachment: NonNullable<OtherRow["attachTo"]>) => string;
}) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<{ index: number | null; value: OtherRow; amount: string; priceDraft: PriceDraft }>();
  const [removal, setRemoval] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [priceFocused, setPriceFocused] = useState(false);
  const openedSymbol = useRef<string | null>(null);
  const [referencePrices, setReferencePrices] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!props.fidelityLayout) return;
    let live = true;
    void ASSET_HANDLER.listAssets(1).then((groups) => {
      if (!live) return;
      const prices: Record<string, number> = {};
      for (const row of groups.flat()) prices[`${row.assetType}:${row.symbol}`] = row.price;
      setReferencePrices(prices);
    }).catch(() => {});
    return () => { live = false; };
  }, [props.fidelityLayout]);
  const customSymbols = props.others.map((row) => row.symbol);
  const open = (index: number | null) => {
    const value = index === null ? { symbol: "", amount: 0, alias: "" } : props.others[index];
    const draft = priceDraft(value.price, props.baseCurrency?.rate);
    setEditor({ index, value: { ...value, alias: value.alias ?? "" }, amount: String(value.amount), priceDraft: draft });
    setError("");
    setPriceFocused(false);
  };
  useEffect(() => {
    if (!props.editSymbol || openedSymbol.current === props.editSymbol) return;
    const index = props.others.findIndex((row) => row.symbol.toUpperCase() === props.editSymbol?.toUpperCase());
    if (index < 0) return;
    openedSymbol.current = props.editSymbol;
    open(index);
  }, [props.editSymbol, props.others]);
  useEffect(() => {
    if (props.addRequest) {
      open(null);
      props.onAddRequestHandled?.();
    }
  }, [props.addRequest]);
  const save = () => {
    if (!editor) return;
    const amount = Number(editor.amount);
    if (!editor.value.symbol.trim() || !editor.amount.trim() || !Number.isFinite(amount)) {
      setError(t("mobile.others.invalid"));
      return;
    }
    const parsed = parsePriceDraft(editor.priceDraft, props.others, editor.value.symbol, editor.value.price, props.baseCurrency?.rate);
    if (!parsed.valid) { setError(t("config.customPrice.invalid")); return; }
    const value = { ...editor.value, symbol: editor.value.symbol.trim().toUpperCase(), amount };
    if (parsed.price) value.price = parsed.price;
    else delete value.price;
    props.onSave(editor.index, value);
    setEditor(undefined);
  };
  const unitPrice = (other: OtherRow) => other.price?.kind === "manual" ? other.price.usd
    : other.price?.kind === "follow" ? (referencePrices[`${other.price.assetType}:${other.price.symbol}`] ?? 0) * other.price.ratio
    : 0;
  const assetValue = (other: OtherRow) => other.amount * unitPrice(other);
  const money = (value: number, inBaseCurrency = false) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: props.baseCurrency?.currency ?? "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(inBaseCurrency ? value : value * (props.baseCurrency?.rate ?? 1));
  if (props.fidelityLayout) return <section className="fidelity-custom">
    <div className="fidelity-custom-group">
      {props.others.length === 0 && <EmptyState icon={BackpackIcon} className="fidelity-custom-empty"
        title={t("mobile.others.empty")} hint={t("fidelity.settings.sources.emptyHint")} />}
      {props.others.map((other, index) => <div key={`${other.symbol}-${index}`} className="fidelity-custom-row">
        <div className="fidelity-custom-identity"><button type="button" className="fidelity-custom-avatar"
          aria-labelledby={`fidelity-custom-more-${index}`} onClick={() => setMenu(index)}>
          <span className="sr-only" id={`fidelity-custom-more-${index}`}>{t("mobile.sources.moreActions").replace("{source}", other.symbol)}</span>
          <AssetLabel kind="custom" symbol={other.symbol} size={24}
            secondary={`${other.alias || other.symbol} · ${other.amount.toLocaleString("en-US")}`} /></button></div>
        <div className="fidelity-custom-details">
          <div><span>{other.price?.kind === "manual" ? t("fidelity.settings.custom.manual") : other.price?.kind === "follow"
            ? t("fidelity.settings.custom.follows").replace("{symbol}", other.price.symbol)
            : t("fidelity.settings.custom.market")} · {unitPrice(other) ? money(unitPrice(other)) : "—"}</span>
            <small>{t("fidelity.settings.custom.attached").replace("{source}", other.attachTo
              ? props.attachLabel?.(other.attachTo) ?? `${other.attachTo.kind}:${other.attachTo.type}`
              : t("fidelity.settings.custom.standalone"))}</small></div>
          <strong>{unitPrice(other) ? money(assetValue(other)) : "—"}</strong>
        </div>
        <div className="fidelity-custom-actions">
          <button type="button" aria-label={`${t("fidelity.settings.custom.attach")} ${other.symbol}`}
            onClick={() => props.onAttach(index)}><Link2Icon aria-hidden="true" />
            <span id={`fidelity-custom-attach-${index}`}>{t("fidelity.settings.custom.attach")}</span></button>
          <button type="button" aria-label={`${t("goals.edit")} ${other.symbol}`} onClick={() => open(index)}><Pencil1Icon aria-hidden="true" /></button>
          <button type="button" className="is-danger" aria-label={`${t("common.delete")} ${other.symbol}`} onClick={() => setRemoval(index)}><TrashIcon aria-hidden="true" /></button>
        </div>
      </div>)}
      {props.others.length > 0 && <div className="fidelity-custom-foot"><span>{t("fidelity.settings.custom.count").replace("{count}", String(props.others.length))}</span>
        <strong>{money(props.others.reduce((sum, other) => sum + assetValue(other), 0))}</strong></div>}
    </div>
    <div className="fidelity-custom-info"><LockClosedIcon aria-hidden="true" /><div><strong>{t("fidelity.settings.custom.noteTitle")}</strong>
      <span>{t("fidelity.settings.custom.note")}</span></div></div>
    {menu !== null && <ActionSheet open onOpenChange={(open) => { if (!open) setMenu(null); }} title={props.others[menu]?.symbol ?? ""} actions={[
      { label: t("config.others.attachTo"), onClick: () => props.onAttach(menu, true) },
      { label: t("common.delete"), destructive: true, onClick: () => setRemoval(menu) },
    ]} />}
    {editor && <ModalPage title={t(editor.index === null ? "fidelity.settings.custom.add" : "fidelity.settings.custom.edit")}
      onDismiss={() => setEditor(undefined)} className="fidelity-editor-overlay">
      <div className="fidelity-editor-drawer fidelity-custom-editor">
        <div className="fidelity-editor-handle" aria-hidden="true" />
        <header className="fidelity-editor-head"><div className="fidelity-editor-heading">
          <div><h2>{t(editor.index === null ? "fidelity.settings.custom.add" : "fidelity.settings.custom.edit")}</h2>
            <p>{t("fidelity.settings.custom.subtitle")}</p></div>
          <button type="button" className="fidelity-editor-close" aria-label={t("common.close")} onClick={() => setEditor(undefined)}><Cross2Icon aria-hidden="true" /></button>
        </div></header>
        <div className="fidelity-editor-body">
          <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-symbol">{t("fidelity.settings.custom.symbol")}</label>
            <div className="fidelity-editor-input"><input id="fidelity-custom-symbol" autoCapitalize="characters"
              value={editor.value.symbol} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, symbol: event.target.value } })} /></div>
            <small>{t("fidelity.settings.custom.symbolHintUnlimited")}</small></div>
          <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-name">{t("fidelity.settings.custom.name")} <span>{t("fidelity.settings.add.optional")}</span></label>
            <div className="fidelity-editor-input"><input id="fidelity-custom-name" value={editor.value.alias ?? ""}
              onChange={(event) => setEditor({ ...editor, value: { ...editor.value, alias: event.target.value } })} /></div></div>
          <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-amount">{t("fidelity.settings.custom.amount")}</label>
            <div className="fidelity-editor-input"><input id="fidelity-custom-amount" inputMode="decimal" value={editor.amount}
              onChange={(event) => setEditor({ ...editor, amount: event.target.value })} /></div>
            <small>{t("fidelity.settings.custom.amountHint")}</small></div>
          <div className="fidelity-editor-field"><label>{t("fidelity.settings.custom.price")}</label>
            <div className="fidelity-custom-segment" role="radiogroup" aria-label={t("fidelity.settings.custom.price")}>
              {(["market", "manual", "follow"] as const).map((kind, kindIndex, kinds) => <button key={kind} type="button"
                role="radio" aria-checked={editor.priceDraft.kind === kind}
                tabIndex={editor.priceDraft.kind === kind ? 0 : -1}
                aria-label={t(`config.customPrice.${kind}`)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                  event.preventDefault();
                  const nextIndex = (kindIndex + (event.key === "ArrowRight" ? 1 : kinds.length - 1)) % kinds.length;
                  const next = kinds[nextIndex];
                  setEditor({ ...editor, priceDraft: { ...editor.priceDraft, kind: next } });
                  event.currentTarget.parentElement?.querySelectorAll("button")[nextIndex]?.focus();
                }}
                onClick={() => setEditor({ ...editor, priceDraft: { ...editor.priceDraft, kind } })}>
                {t(kind === "market" ? "config.customPrice.market" : kind === "manual"
                  ? "fidelity.settings.custom.manual" : "fidelity.settings.custom.followMode")}</button>)}
            </div></div>
          {editor.priceDraft.kind === "manual" && <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-price">{t("fidelity.settings.custom.priceIn").replace("{currency}", props.baseCurrency?.currency ?? "USD")}</label>
            <div className="fidelity-editor-input"><input id="fidelity-custom-price" inputMode="decimal"
              value={priceFocused ? editor.priceDraft.amount : displayPriceAmount(editor.priceDraft.amount)}
              onFocus={() => setPriceFocused(true)} onBlur={() => setPriceFocused(false)}
              onChange={(event) => setEditor({ ...editor, priceDraft: { ...editor.priceDraft, amount: event.target.value } })} />
              <span>{props.baseCurrency?.currency ?? "USD"}</span></div>
            <small>{t("fidelity.settings.custom.manualHint").replace("{value}", money(Number(editor.amount) * Number(editor.priceDraft.amount || 0), true))}</small></div>}
          {editor.priceDraft.kind === "follow" && <><div className="fidelity-editor-field">
            <label htmlFor="fidelity-custom-type">{t("config.customPrice.assetType")}</label>
            <select id="fidelity-custom-type" value={editor.priceDraft.assetType}
              onChange={(event) => setEditor({ ...editor, priceDraft: { ...editor.priceDraft, assetType: event.target.value as PriceDraft["assetType"] } })}>
              <option value="crypto">{t("coin.assetType.crypto")}</option>
              <option value="stock">{t("coin.assetType.stock")}</option>
            </select></div>
            <div className="fidelity-editor-field"><label htmlFor="custom-price-symbol">{t("fidelity.settings.custom.followSymbol")}</label>
            <div className="fidelity-editor-input"><input id="custom-price-symbol" value={editor.priceDraft.symbol}
              onChange={(event) => setEditor({ ...editor, priceDraft: { ...editor.priceDraft, symbol: event.target.value } })} /></div></div>
            <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-ratio">{t("fidelity.settings.custom.ratio")}</label>
              <div className="fidelity-editor-input"><input id="fidelity-custom-ratio" inputMode="decimal" value={editor.priceDraft.ratio}
                onChange={(event) => setEditor({ ...editor, priceDraft: { ...editor.priceDraft, ratio: event.target.value } })} /></div></div></>}
          <div className="fidelity-editor-field"><label htmlFor="fidelity-custom-attach">{t("fidelity.settings.custom.attachSource")}</label>
            <select id="fidelity-custom-attach" value={editor.value.attachTo ? encodedAttachTo(editor.value.attachTo) : ""}
              onChange={(event) => setEditor({ ...editor, value: { ...editor.value, attachTo: parseAttachTo(event.target.value) } })}>
              <option value="">{t("fidelity.settings.custom.standalone")}</option>
              {props.attachOptions?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select><small>{t("fidelity.settings.custom.attachHint")}</small></div>
          {error && <p role="alert" className="fidelity-editor-error">{error}</p>}
        </div>
        <footer className="fidelity-editor-foot"><button type="button" onClick={() => setEditor(undefined)}>{t("common.cancel")}</button>
          <button type="button" className="is-primary" onClick={save}>{t(editor.index === null ? "fidelity.settings.custom.addAsset" : "common.save")}</button></footer>
      </div>
    </ModalPage>}
    {removal !== null && <ConfirmSheet title={t("config.removeDialogTitle")} onDismiss={() => setRemoval(null)}>
      <p className="py-2 text-center">{t("config.removeDialogDesc")}</p>
      <Button variant="destructive" className="min-h-12 w-full" onClick={() => { props.onRemove(removal); setRemoval(null); }}>{t("common.delete")}</Button>
      <Button variant="outline" className="min-h-12 w-full" onClick={() => setRemoval(null)}>{t("common.cancel")}</Button>
    </ConfirmSheet>}
  </section>;
  return <section className={`ios-d3-others space-y-2${props.hideEmpty ? " ios-d3-others-empty" : ""}`}>
    {!props.hideEmpty && <div className="flex items-center justify-between gap-2">
      {!props.hideEmpty && <h2 className="ios-d3-section-heading">{t("config.others")}</h2>}
      <Button variant="ghost" className="ios-d3-text-action min-h-11" onClick={() => open(null)}>{t("config.addSymbol")}</Button>
    </div>}
    {!props.hideEmpty && <div className="ios-d3-others-group overflow-hidden rounded-2xl bg-card">
      {props.others.length === 0 && !props.hideEmpty && <EmptyState icon={BackpackIcon}
        title={t("mobile.others.empty")} hint={t("fidelity.settings.sources.emptyHint")} />}
      {props.others.map((other, index) => <div key={`${other.symbol}-${index}`} className="ios-d3-others-row flex min-w-0 items-center gap-2 px-4 py-2">
        <button className="min-h-11 min-w-0 flex-1 text-left" aria-label={`${t("goals.edit")} ${other.symbol}`} onClick={() => open(index)}>
          <AssetLabel kind="custom" symbol={other.symbol} name={other.alias || other.symbol} size={24}
            secondary={<>{other.amount.toLocaleString()} {other.symbol}
            {!other.attachTo && other.price ? ` · ${t(validateCustomPrice(other.price, customSymbols, other.symbol)
              ? `config.customPrice.${other.price.kind}` : "config.customPrice.invalidRule")}` : ""}
          </>} />
        </button>
        <button className="ios-d3-source-more" aria-label={t("mobile.sources.moreActions").replace("{source}", other.symbol)} onClick={() => setMenu(index)}><DotsHorizontalIcon aria-hidden="true" /></button>
      </div>)}
    </div>}
    {menu !== null && <ActionSheet open onOpenChange={(open) => { if (!open) setMenu(null); }} title={props.others[menu]?.symbol ?? ""} actions={[
      { label: t("config.others.attachTo"), onClick: () => props.onAttach(menu) },
      { label: t("common.delete"), destructive: true, onClick: () => setRemoval(menu) },
    ]} />}
    {editor && <ModalPage title={t(editor.index === null ? "mobile.others.add" : "mobile.others.edit")} onDismiss={() => setEditor(undefined)}>
      <div className="ios-d3-other-editor mx-auto max-w-xl space-y-5">
        <div className="ios-d3-editor-nav">
          <Button variant="ghost" className="min-h-11" onClick={() => setEditor(undefined)}>{t("common.cancel")}</Button>
          <h2>{t(editor.index === null ? "mobile.others.add" : "mobile.others.edit")}</h2>
          <Button variant="ghost" className="min-h-11" onClick={save}>{t("common.save")}</Button>
        </div>
        <div className="space-y-2"><Label htmlFor="other-alias">{t("config.formAlias")}</Label><Input id="other-alias" className="min-h-12 text-base" autoComplete="off" value={editor.value.alias ?? ""} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, alias: event.target.value } })} /></div>
        <div className="space-y-2"><Label htmlFor="other-symbol">{t("config.formSymbol")}</Label><Input id="other-symbol" className="min-h-12 text-base" autoComplete="off" autoCapitalize="characters" value={editor.value.symbol} onChange={(event) => setEditor({ ...editor, value: { ...editor.value, symbol: event.target.value } })} /></div>
        <div className="space-y-2"><Label htmlFor="other-amount">{t("config.formAmount")}</Label><Input id="other-amount" className="min-h-12 text-base" inputMode="decimal" value={editor.amount} onChange={(event) => setEditor({ ...editor, amount: event.target.value })} /></div>
        {!editor.value.attachTo && <CustomPriceFields draft={editor.priceDraft}
          onChange={(next) => setEditor({ ...editor, priceDraft: next })} t={t}
          currency={props.baseCurrency?.currency} rate={props.baseCurrency?.rate} />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </ModalPage>}
    {removal !== null && <ConfirmSheet title={t("config.removeDialogTitle")} onDismiss={() => setRemoval(null)}>
        <p className="py-2 text-center">{t("config.removeDialogDesc")}</p>
        <Button variant="destructive" className="min-h-12 w-full" onClick={() => { props.onRemove(removal); setRemoval(null); }}>{t("common.delete")}</Button>
        <Button variant="outline" className="min-h-12 w-full" onClick={() => setRemoval(null)}>{t("common.cancel")}</Button>
    </ConfirmSheet>}
  </section>;
}
