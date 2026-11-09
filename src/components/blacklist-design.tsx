import { useState } from "react";
import { ExclamationTriangleIcon, EyeNoneIcon, PlusIcon, ReloadIcon, ResetIcon } from "@radix-ui/react-icons";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { useTranslation } from "@/i18n";

type Props = {
  symbols: string[];
  onAdd: (symbol: string) => Promise<void>;
  onRemove: (symbol: string) => void;
};

export function BlacklistDesign({ symbols, onAdd, onRemove }: Props) {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useState("");
  const [error, setError] = useState<string>();
  async function add() {
    const upper = symbol.trim().toUpperCase();
    if (!upper) { setError(t("fidelity.blacklist.required")); return; }
    if (symbols.some((item) => item.toUpperCase() === upper)) {
      setError(t("fidelity.blacklist.duplicate").replace("{symbol}", upper));
      return;
    }
    await onAdd(upper);
    setError(undefined);
    setSymbol("");
  }
  return <div className="t3-fidelity-blacklist" data-testid="blacklist-table">
    <section className="list-card">
      <div className="adder">
        <input aria-label={t("fidelity.blacklist.symbol")} placeholder={t("fidelity.blacklist.placeholder")}
          className={error ? "error" : ""} value={symbol} onChange={(event) => { setSymbol(event.target.value); setError(undefined); }}
          onKeyDown={(event) => { if (event.key === "Enter") void add(); }} />
        <button type="button" className="primary" onClick={() => { void add(); }}><PlusIcon />{t("fidelity.blacklist.hideToken")}</button>
      </div>
      {error && <div className="error-message"><ExclamationTriangleIcon />{error}</div>}
      {symbols.length ? <>
        <div className="table-head"><span>{t("fidelity.blacklist.token")}</span><span>{t("fidelity.blacklist.seen")}</span><span>{t("fidelity.blacklist.since")}</span><span /></div>
        {symbols.map((item) => <div className="table-row" key={item}>
          <div className="identity"><div><b>{item}</b><small>{t("fidelity.blacklist.unknownContract")}</small></div></div>
          <span className="muted">—</span><span className="muted">—</span>
          <ConfirmDeleteDialog
            trigger={<button type="button" className="remove" aria-label={t("data.removeFromBlacklistAria").replace("{symbol}", item)}><ResetIcon />{t("fidelity.blacklist.remove")}</button>}
            title={t("data.removeBlacklistTitle")} description={t("data.removeBlacklistDesc")} cancelLabel={t("common.cancel")}
            actions={[{ label: t("fidelity.blacklist.remove"), onClick: () => onRemove(item) }]} />
        </div>)}
        <div className="foot">{t("fidelity.blacklist.hiddenTokens").replace("{count}", String(symbols.length))}</div>
      </> : <div className="empty-wrap"><div className="empty"><b>{t("fidelity.blacklist.empty")}</b><span>{t("fidelity.blacklist.emptyNote")}</span></div></div>}
    </section>
    <section className="info-card">
      <h3>{t("fidelity.blacklist.what")}</h3>
      <div><EyeNoneIcon /><span>{t("fidelity.blacklist.what1")}<small>{t("fidelity.blacklist.what1Note")}</small></span></div>
      <div><ReloadIcon /><span>{t("fidelity.blacklist.what2")}<small>{t("fidelity.blacklist.what2Note")}</small></span></div>
      <div><svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2.5l5.5 2v4.5c0 3-2.3 5-5.5 6.5C5.8 14 3.5 12 3.5 9V4.5z" /></svg><span>{t("fidelity.blacklist.what3")}<small>{t("fidelity.blacklist.what3Note")}</small></span></div>
    </section>
  </div>;
}
