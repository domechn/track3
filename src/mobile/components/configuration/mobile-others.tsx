import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/mobile/i18n";
import { ConfirmSheet, ModalPage } from "@/mobile/components/mobile/overlays";
import { ActionSheet } from "@/mobile/components/mobile";
import { DotsHorizontalIcon } from "@radix-ui/react-icons";
import { getWalletLogo } from "@/lib/utils";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import type { OtherRow } from "@/components/configuration/types";

export function MobileOthers(props: {
  others: OtherRow[];
  onSave: (index: number | null, value: OtherRow) => void;
  onRemove: (index: number) => void;
  onAttach: (index: number) => void;
  hideEmpty?: boolean;
  addRequest?: number;
  onAddRequestHandled?: () => void;
}) {
  const { t } = useTranslation();
  const [editor, setEditor] = useState<{ index: number | null; value: OtherRow; amount: string }>();
  const [removal, setRemoval] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [error, setError] = useState("");
  const open = (index: number | null) => {
    const value = index === null ? { symbol: "", amount: 0, alias: "" } : props.others[index];
    setEditor({ index, value: { ...value, alias: value.alias ?? "" }, amount: String(value.amount) });
    setError("");
  };
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
    props.onSave(editor.index, { ...editor.value, symbol: editor.value.symbol.trim().toUpperCase(), amount });
    setEditor(undefined);
  };
  return <section className={`ios-d3-others space-y-2${props.hideEmpty ? " ios-d3-others-empty" : ""}`}>
    {!props.hideEmpty && <div className="flex items-center justify-between gap-2">
      {!props.hideEmpty && <h2 className="ios-d3-section-heading">{t("config.others")}</h2>}
      <Button variant="ghost" className="ios-d3-text-action min-h-11" onClick={() => open(null)}>{t("config.addSymbol")}</Button>
    </div>}
    {!props.hideEmpty && <div className="ios-d3-others-group overflow-hidden rounded-2xl bg-card">
      {props.others.length === 0 && !props.hideEmpty && <p className="px-4 py-5 text-sm text-muted-foreground">{t("mobile.others.empty")}</p>}
      {props.others.map((other, index) => <div key={`${other.symbol}-${index}`} className="ios-d3-others-row flex min-w-0 items-center gap-2 px-4 py-2">
        <span className="ios-d3-source-avatar" aria-hidden="true">
          {getWalletLogo(other.symbol) === UnknownLogo ? other.symbol.slice(0, 2).toUpperCase() : <img src={getWalletLogo(other.symbol)} alt="" />}
        </span>
        <button className="min-h-11 min-w-0 flex-1 text-left" aria-label={`${t("goals.edit")} ${other.symbol}`} onClick={() => open(index)}>
          <span className="block truncate font-medium">{other.alias || other.symbol}</span>
          <span className="block truncate text-xs text-muted-foreground">{other.amount.toLocaleString()} {other.symbol}</span>
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
