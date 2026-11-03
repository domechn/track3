import { useState } from "react";
import { ExclamationTriangleIcon, UpdateIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";

export function FidelityBlacklist({
  symbols, onAdd, onRemove,
}: {
  symbols: string[];
  onAdd: (symbol: string) => Promise<void>;
  onRemove: (symbol: string) => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function add() {
    const symbol = input.trim().toUpperCase();
    if (!symbol) {
      setError(t("fidelity.settings.blacklist.required"));
      return;
    }
    if (symbols.some((value) => value.toUpperCase() === symbol)) {
      setError(t("fidelity.settings.blacklist.duplicate").replace("{symbol}", symbol));
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onAdd(symbol);
      setInput("");
    } catch {
      setError(t("fidelity.settings.blacklist.addFailed"));
    } finally {
      setSaving(false);
    }
  }
  return <div className="fidelity-blacklist">
    <p className="fidelity-blacklist-subtitle">{t("fidelity.settings.blacklist.subtitle")}{" "}
      <strong>{symbols.length ? t("fidelity.settings.blacklist.count").replace("{count}", String(symbols.length))
        : t("fidelity.settings.blacklist.none")}</strong></p>
    <section className="fidelity-blacklist-card is-list">
      <h2 className="sr-only">{t("data.blacklist")}</h2>
      <div className="fidelity-blacklist-add">
        <input aria-label={t("fidelity.settings.blacklist.tokenSymbol")} value={input}
          placeholder={t("fidelity.settings.blacklist.placeholder")}
          aria-invalid={Boolean(error)} onChange={(event) => { setInput(event.target.value); setError(""); }}
          onKeyDown={(event) => { if (event.key === "Enter") void add(); }} />
        <button type="button" disabled={saving} onClick={() => void add()}><span aria-hidden="true">＋</span>
          {t("fidelity.settings.blacklist.hideToken")}</button>
      </div>
      {error && <div className="fidelity-blacklist-error" role="alert"><ExclamationTriangleIcon aria-hidden="true" />{error}</div>}
      {symbols.length ? <div className="fidelity-blacklist-rows">
        {symbols.map((symbol) => <div key={symbol} className="fidelity-blacklist-row">
          <div className="fidelity-blacklist-identity">
            <span data-label={symbol.slice(0, 3)} aria-hidden="true" />
            <div><strong>{symbol}</strong><small>{t("fidelity.settings.blacklist.allSources")}</small></div>
          </div>
          <button type="button" aria-label={t("fidelity.settings.blacklist.removeSymbol").replace("{symbol}", symbol)}
            onClick={() => onRemove(symbol)}><span aria-hidden="true">↶</span>{t("fidelity.settings.blacklist.remove")}</button>
        </div>)}
      </div> : <div className="fidelity-blacklist-empty"><strong>{t("fidelity.settings.blacklist.emptyTitle")}</strong>
        <span>{t("fidelity.settings.blacklist.emptyHint")}</span></div>}
      {symbols.length > 0 && <p className="fidelity-blacklist-count">{t("fidelity.settings.blacklist.countTokens").replace("{count}", String(symbols.length))}</p>}
    </section>
    <section className="fidelity-blacklist-card is-info">
      <h2>{t("fidelity.settings.blacklist.what")}</h2>
      <div><span aria-hidden="true">▽</span><p><strong>{t("fidelity.settings.blacklist.excluded")}</strong>
        <small>{t("fidelity.settings.blacklist.balanceStays")}</small></p></div>
      <div><UpdateIcon aria-hidden="true" /><p><strong>{t("fidelity.settings.blacklist.refreshes")}</strong>
        <small>{t("fidelity.settings.blacklist.returns")}</small></p></div>
      <div><span aria-hidden="true">♢</span><p><strong>{t("fidelity.settings.blacklist.spam")}</strong>
        <small>{t("fidelity.settings.blacklist.spamHint")}</small></p></div>
    </section>
  </div>;
}
