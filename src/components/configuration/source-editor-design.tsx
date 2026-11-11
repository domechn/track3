import { useState } from "react";
import {
  CheckIcon, ChevronLeftIcon, Cross2Icon, ExclamationTriangleIcon, EyeNoneIcon,
  EyeOpenIcon, OpenInNewWindowIcon, PlusIcon, ReloadIcon,
} from "@radix-ui/react-icons";
import { CEX_OPTIONS } from "@/middlelayers/constants";
import type { OtherAttachment } from "@/middlelayers/datafetch/types";
import type { ProUsage } from "@/middlelayers/license";
import type { ExchangeDraft, OtherRow, StockBrokerDraft, WalletDraft } from "./types";
import { PublicIpInfo } from "./public-ip-info";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { externalLinks } from "@/lib/external-links";

type Tab = "exchanges" | "wallets" | "brokers" | "custom";
type Props = {
  tab: Tab;
  onClose: () => void;
  onSaveExchange: (draft: ExchangeDraft) => Promise<boolean>;
  onSaveWallet: (draft: WalletDraft) => Promise<boolean>;
  onSaveBroker: (draft: StockBrokerDraft) => Promise<boolean>;
  onSaveCustom: (row: OtherRow) => boolean;
  exchanges: { type: string; apiKey: string; alias?: string }[];
  wallets: { type: string; address: string; alias?: string }[];
  brokers: { alias?: string }[];
  usage?: ProUsage;
};

const exchanges = ["binance", "okex", "bitget", "kraken", "gate", "coinbase", "bybit", "htx", "mexc", "backpack"];
const exchangeName = (key: string) => CEX_OPTIONS.find((option) => option.value === key)?.label ?? key;
const exchangeMark: Record<string, string> = {
  binance: "BN", okex: "OK", bitget: "BG", kraken: "KR", gate: "GT",
  coinbase: "CB", bybit: "BY", htx: "HT", mexc: "MX", backpack: "BP",
};
const shield = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
</svg>;
const walletTypes = [
  { key: "btc", code: "BTC", name: "Bitcoin" },
  { key: "erc20", code: "ETH", name: "Ethereum", pro: true },
  { key: "sol", code: "SOL", name: "Solana" },
  { key: "doge", code: "DOGE", name: "Dogecoin" },
  { key: "trc20", code: "TRON", name: "TRON", pro: true },
  { key: "ton", code: "TON", name: "TON" },
  { key: "sui", code: "SUI", name: "Sui" },
];

function EditorField({ label, optional, children, hint, error, success }: {
  label: string; optional?: boolean; children: React.ReactNode; hint?: string; error?: string; success?: string;
}) {
  const { t } = useTranslation();
  return <div className="t3-fidelity-editor-field">
    <label>{label}{optional && <span> {t("fidelity.editor.optional")}</span>}</label>
    {children}
    {error ? <small className="error"><ExclamationTriangleIcon />{error}</small>
      : success ? <small className="success"><CheckIcon />{success}</small>
        : hint ? <small>{hint}</small> : null}
  </div>;
}

export function SourceEditorDesign({ tab, onClose, onSaveExchange, onSaveWallet, onSaveBroker, onSaveCustom, exchanges: configuredExchanges, wallets: configuredWallets, brokers: configuredBrokers, usage }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<"pick" | "form">("pick");
  const [selectedExchange, setSelectedExchange] = useState("bitget");
  const [exchange, setExchange] = useState<ExchangeDraft>({ type: "bitget", apiKey: "", secret: "", passphrase: "", active: true });
  const [wallet, setWallet] = useState<WalletDraft>({ type: "btc", address: "", alias: "", active: true });
  const [broker, setBroker] = useState<StockBrokerDraft>({ type: "ibkr", queryId: "", token: "", alias: "", active: true });
  const [custom, setCustom] = useState({ symbol: "", alias: "", amount: "", price: "", follow: false, followSymbol: "" });
  const [attachmentIndex, setAttachmentIndex] = useState(0);
  const [showSecret, setShowSecret] = useState(false);
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string>();
  const attachmentOptions: { name: string; detail: string; attachment?: OtherAttachment; disabled?: boolean }[] = [
    { name: t("fidelity.source.standalone"), detail: t("fidelity.source.notAttached") },
    ...configuredExchanges.map((item) => ({ name: item.alias || exchangeName(item.type), detail: t("fidelity.source.exchange"), attachment: { kind: "cex" as const, type: item.type, identity: item.apiKey } })),
    ...configuredWallets.map((item) => ({ name: item.alias || item.address, detail: t("fidelity.source.wallet"), attachment: { kind: "wallet" as const, type: item.type, identity: item.address } })),
    ...configuredBrokers.map((item) => ({ name: item.alias || "Interactive Brokers", detail: t("fidelity.source.broker"), disabled: true })),
  ];

  const addressValid = wallet.type === "erc20" ? /^0x[0-9a-fA-F]{40}$/.test(wallet.address)
    : wallet.type === "btc" ? /^(bc1[023456789acdefghjklmnpqrstuvwxyz]{25,}|[13][a-km-zA-HJ-NP-Z1-9]{25,})$/.test(wallet.address)
      : wallet.address.trim().length >= 20;
  const brokerIdValid = /^\d+$/.test(broker.queryId);
  const exchangeKeyError = submitted && !exchange.apiKey.trim();
  const exchangeSecretError = submitted && exchange.secret.trim().length < 32;
  const exchangePassphraseError = submitted && (exchange.type === "okex" || exchange.type === "bitget") && !(exchange.type === "okex" ? exchange.password : exchange.passphrase)?.trim();

  async function submit() {
    setSubmitted(true);
    setSaveError(undefined);
    if (tab === "exchanges") {
      if (!exchange.apiKey.trim() || exchange.secret.trim().length < 32 ||
        ((exchange.type === "okex" || exchange.type === "bitget") && !(exchange.type === "okex" ? exchange.password : exchange.passphrase)?.trim())) return;
      setSaving(true);
      const okay = await onSaveExchange(exchange);
      setSaving(false);
      if (okay) onClose(); else setSaveError(t("fidelity.editor.exchangeRejected"));
    } else if (tab === "wallets") {
      if (!addressValid) return;
      setSaving(true);
      const okay = await onSaveWallet(wallet);
      setSaving(false);
      if (okay) onClose(); else setSaveError(t("fidelity.editor.walletRejected"));
    } else if (tab === "brokers") {
      if (!brokerIdValid || !broker.token.trim()) return;
      setSaving(true);
      const okay = await onSaveBroker(broker);
      setSaving(false);
      if (okay) onClose(); else setSaveError(t("fidelity.editor.brokerRejected"));
    } else {
      const price = Number(custom.price.replace(/,/g, ""));
      const qty = Number(custom.amount);
      if (!custom.symbol.trim() || !Number.isFinite(qty) || qty < 0 ||
        (!custom.follow && (!Number.isFinite(price) || price <= 0)) ||
        (custom.follow && !custom.followSymbol.trim())) return;
      const row: OtherRow = {
        symbol: custom.symbol.trim().toUpperCase(), alias: custom.alias.trim() || undefined, amount: qty,
        attachTo: attachmentOptions[attachmentIndex]?.attachment,
        price: custom.follow
          ? { kind: "follow", assetType: "stock", symbol: custom.followSymbol.trim().toUpperCase(), ratio: 1 }
          : { kind: "manual", usd: price, setAt: new Date().toISOString() },
      };
      if (onSaveCustom(row)) onClose(); else setSaveError(t("fidelity.editor.customRejected"));
    }
  }
  const title = tab === "exchanges" ? step === "pick" ? t("fidelity.source.addExchange") : t("fidelity.editor.addNamedExchange").replace("{name}", exchangeName(exchange.type))
    : tab === "wallets" ? t("fidelity.source.addWallet") : tab === "brokers" ? t("fidelity.source.addBroker") : t("fidelity.source.addCustom");
  const subtitle = tab === "exchanges" ? step === "pick" ? t("fidelity.editor.stepPick") : t("fidelity.editor.stepCredentials")
    : tab === "wallets" ? t("fidelity.editor.walletSubtitle") : tab === "brokers" ? t("fidelity.editor.brokerSubtitle") : t("fidelity.editor.customSubtitle");
  const info = <div className="t3-fidelity-editor-banner">{shield}<div><b>{t(tab === "wallets" ? "fidelity.editor.publicAddress" : "fidelity.editor.readOnly")}</b><span>{t(tab === "wallets" ? "fidelity.editor.publicAddressDetail" : "fidelity.editor.readOnlyDetail")}</span></div></div>;

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="t3-fidelity-editor" onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}>
      <div className="t3-fidelity-editor-head">
        {tab === "exchanges" && step === "form" && <button type="button" className="t3-fidelity-editor-back" onClick={() => setStep("pick")}><ChevronLeftIcon />{t("fidelity.editor.chooseExchange")}</button>}
        <div className="t3-fidelity-editor-heading">
          {tab === "exchanges" && step === "form" && <span className="t3-fidelity-source-logo">{exchangeMark[exchange.type]}</span>}
          <div><DialogTitle>{title}</DialogTitle><DialogDescription>{subtitle}</DialogDescription></div>
        </div>
      </div>
      <div className="t3-fidelity-editor-body">
        {tab === "exchanges" && step === "pick" && <>
          <div className="t3-fidelity-editor-picks">
            {exchanges.map((key) => <button key={key} type="button" aria-label={exchangeName(key)} className={selectedExchange === key ? "selected" : ""}
              onClick={() => setSelectedExchange(key)}><span className="t3-fidelity-source-logo">{exchangeMark[key]}</span><span><b>{exchangeName(key)}</b><small>{key === "bitget" || key === "okex" ? t("fidelity.editor.keySecretPassphrase") : t("fidelity.editor.keySecret")}</small></span></button>)}
          </div>
          {info}
          <p>{t("fidelity.editor.notListed")}<br /><a href={externalLinks.docs} target="_blank" rel="noreferrer">{t("fidelity.editor.apiHelp")} <OpenInNewWindowIcon aria-hidden="true" /></a></p>
        </>}
        {tab === "exchanges" && step === "form" && <>
          <EditorField label={t("fidelity.editor.label")} optional hint={t("fidelity.editor.labelHint")}>
            <input aria-label={t("fidelity.editor.label")} placeholder={exchangeName(exchange.type)} value={exchange.alias ?? ""} onChange={(event) => setExchange({ ...exchange, alias: event.target.value })} disabled={saving} />
          </EditorField>
          <EditorField label={t("fidelity.editor.apiKey")} error={exchangeKeyError ? t("fidelity.editor.keyRequired") : undefined}>
            <input aria-label={t("fidelity.editor.apiKey")} className={exchangeKeyError ? "error" : ""} placeholder={t("fidelity.editor.keyPlaceholder")} value={exchange.apiKey} onChange={(event) => setExchange({ ...exchange, apiKey: event.target.value })} disabled={saving} autoComplete="off" />
          </EditorField>
          <EditorField label={t("fidelity.editor.apiSecret")} error={exchangeSecretError ? t("fidelity.editor.secretShort") : undefined}>
            <div className={`t3-fidelity-editor-secret ${exchangeSecretError ? "error" : ""}`}><input aria-label={t("fidelity.editor.apiSecret")} type={showSecret ? "text" : "password"} placeholder={t("fidelity.editor.secretPlaceholder")} value={exchange.secret} onChange={(event) => setExchange({ ...exchange, secret: event.target.value })} disabled={saving} autoComplete="off" /><button type="button" aria-label={t(showSecret ? "fidelity.editor.hide" : "fidelity.editor.show")} onClick={() => setShowSecret(!showSecret)}>{showSecret ? <EyeNoneIcon /> : <EyeOpenIcon />}</button></div>
          </EditorField>
          {(exchange.type === "okex" || exchange.type === "bitget") && <EditorField label={t("fidelity.editor.passphrase")} error={exchangePassphraseError ? t("fidelity.editor.passphraseRequired").replace("{name}", exchangeName(exchange.type)) : undefined}>
            <div className={`t3-fidelity-editor-secret ${exchangePassphraseError ? "error" : ""}`}><input aria-label={t("fidelity.editor.passphrase")} type={showPassphrase ? "text" : "password"} placeholder={t("fidelity.editor.passphrase")} value={exchange.type === "okex" ? exchange.password ?? "" : exchange.passphrase ?? ""} onChange={(event) => setExchange({ ...exchange, [exchange.type === "okex" ? "password" : "passphrase"]: event.target.value })} disabled={saving} autoComplete="off" /><button type="button" aria-label={t(showPassphrase ? "fidelity.editor.hide" : "fidelity.editor.show")} onClick={() => setShowPassphrase(!showPassphrase)}>{showPassphrase ? <EyeNoneIcon /> : <EyeOpenIcon />}</button></div>
          </EditorField>}
          <div className="t3-fidelity-editor-ip"><PublicIpInfo t={t} design /></div>
          {info}
        </>}
        {tab === "wallets" && <>
          <EditorField label={t("fidelity.editor.walletType")}><div className="t3-fidelity-editor-picks c3">
            {walletTypes.map((option) => <button key={option.key} type="button" className={wallet.type === option.key ? "selected" : ""} onClick={() => setWallet({ ...wallet, type: option.key, address: "" })}><b>{option.code}{option.pro && <span className="t3-fidelity-source-pro">Pro</span>}</b><small>{option.name}</small></button>)}
          </div></EditorField>
          <EditorField label={t("fidelity.editor.address")} hint={!wallet.address ? t("fidelity.editor.addressHint") : undefined}
            error={wallet.address && !addressValid ? wallet.type === "erc20" ? t("fidelity.editor.ethereumInvalid") : t("fidelity.editor.addressInvalid").replace("{chain}", wallet.type.toUpperCase()) : undefined}
            success={addressValid ? t("fidelity.editor.addressValid").replace("{chain}", wallet.type === "erc20" ? "Ethereum" : wallet.type.toUpperCase()) : undefined}>
            <div className="t3-fidelity-editor-address-wrap"><input aria-label={t("fidelity.editor.address")} autoFocus className={!wallet.address || addressValid ? "" : "error"} placeholder={wallet.type === "erc20" ? "0x…" : wallet.type === "btc" ? "bc1q… or 1… / 3…" : t("fidelity.editor.addressPlaceholder")} value={wallet.address} onChange={(event) => setWallet({ ...wallet, address: event.target.value })} />
              {wallet.address && (addressValid ? <CheckIcon className="valid" /> : <Cross2Icon className="invalid" />)}</div>
          </EditorField>
          <EditorField label={t("fidelity.editor.label")} optional><input aria-label={t("fidelity.editor.label")} placeholder={t("fidelity.editor.walletLabelPlaceholder")} value={wallet.alias ?? ""} onChange={(event) => setWallet({ ...wallet, alias: event.target.value })} /></EditorField>
          {(wallet.type === "erc20" || wallet.type === "trc20") && <div className="t3-fidelity-editor-banner warning"><span>✧</span><div><b>{t("fidelity.editor.tokensNeedPro").replace("{tokens}", wallet.type === "erc20" ? "ERC20" : "TRC20")}</b><span>{usage
            ? t("fidelity.editor.proUsageDetail")
              .replace("{coin}", wallet.type === "erc20" ? "ETH" : "TRX")
              .replace("{tokens}", wallet.type === "erc20" ? "ERC20" : "TRON")
              .replace("{used}", String(wallet.type === "erc20" ? usage.usage.erc20.used : usage.usage.tron.used))
              .replace("{limit}", String(wallet.type === "erc20" ? usage.usage.erc20.limit : usage.usage.tron.limit))
            : t("fidelity.editor.proDetail").replace("{coin}", wallet.type === "erc20" ? "ETH" : "TRX")}</span><a href="#/settings/systemInfo?section=pro">{t("fidelity.editor.seePlans")}</a></div></div>}
          {info}
        </>}
        {tab === "brokers" && <>
          <div className="t3-fidelity-editor-banner neutral"><span className="t3-fidelity-source-logo">IB</span><div><b>Interactive Brokers</b><span>{t("fidelity.source.brokerNote")}</span></div></div>
          <EditorField label={t("fidelity.editor.flexId")} error={broker.queryId && !brokerIdValid ? t("fidelity.editor.flexIdInvalid") : undefined}><input aria-label={t("fidelity.editor.flexId")} className={broker.queryId && !brokerIdValid ? "error" : ""} value={broker.queryId} onChange={(event) => setBroker({ ...broker, queryId: event.target.value })} /></EditorField>
          <EditorField label={t("fidelity.editor.flexToken")} error={saveError}><div className={`t3-fidelity-editor-secret ${saveError ? "error" : ""}`}><input aria-label={t("fidelity.editor.flexToken")} type={showToken ? "text" : "password"} value={broker.token} onChange={(event) => setBroker({ ...broker, token: event.target.value })} autoComplete="off" /><button type="button" aria-label={t(showToken ? "fidelity.editor.hide" : "fidelity.editor.show")} onClick={() => setShowToken(!showToken)}>{showToken ? <EyeNoneIcon /> : <EyeOpenIcon />}</button></div></EditorField>
          <EditorField label={t("fidelity.editor.label")} optional><input aria-label={t("fidelity.editor.label")} placeholder="Interactive Brokers" value={broker.alias ?? ""} onChange={(event) => setBroker({ ...broker, alias: event.target.value })} /></EditorField>
          <p>{t("fidelity.editor.brokerHelp")} <a href={externalLinks.docs} target="_blank" rel="noreferrer">{t("fidelity.editor.flexHelp")}</a></p>
          <p>{t("fidelity.editor.brokerTokenExpiry")}</p>
          <div className="t3-fidelity-editor-banner">{shield}<div><b>{t("fidelity.editor.localOnly")}</b><span>{t("fidelity.editor.localOnlyDetail")}</span></div></div>
        </>}
        {tab === "custom" && <>
          <EditorField label={t("fidelity.editor.symbol")} hint={t("fidelity.editor.symbolHint")}><input aria-label={t("fidelity.editor.symbol")} value={custom.symbol} onChange={(event) => setCustom({ ...custom, symbol: event.target.value })} /></EditorField>
          <EditorField label={t("fidelity.editor.name")} optional><input aria-label={t("fidelity.editor.name")} value={custom.alias} onChange={(event) => setCustom({ ...custom, alias: event.target.value })} /></EditorField>
          <EditorField label={t("fidelity.editor.amount")} hint={t("fidelity.editor.amountHint")}><input aria-label={t("fidelity.editor.amount")} value={custom.amount} onChange={(event) => setCustom({ ...custom, amount: event.target.value })} inputMode="decimal" /></EditorField>
          <EditorField label={t("fidelity.editor.price")}><div className="t3-fidelity-editor-segment"><button type="button" aria-pressed={!custom.follow} onClick={() => setCustom({ ...custom, follow: false })}>{t("fidelity.source.manual")}</button><button type="button" aria-pressed={custom.follow} onClick={() => setCustom({ ...custom, follow: true })}>{t("fidelity.editor.followAsset")}</button></div></EditorField>
          {custom.follow ? <EditorField label={t("fidelity.editor.followSymbol")}><input aria-label={t("fidelity.editor.followSymbol")} value={custom.followSymbol} onChange={(event) => setCustom({ ...custom, followSymbol: event.target.value })} /></EditorField>
            : <EditorField label={t("fidelity.editor.priceUsd")} hint={t("fidelity.editor.customValue").replace("{value}", Number(custom.amount) * Number(custom.price.replace(/,/g, "")) > 0 ? `$${(Number(custom.amount) * Number(custom.price.replace(/,/g, ""))).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—")}><div className="t3-fidelity-editor-price-wrap"><input aria-label={t("fidelity.editor.priceUsd")} value={custom.price} onChange={(event) => setCustom({ ...custom, price: event.target.value })} inputMode="decimal" /><span>USD</span></div></EditorField>}
          <EditorField label={t("fidelity.editor.attachSource")} hint={t("fidelity.editor.attachHint")}>
            <select aria-label={t("fidelity.editor.attachSource")} value={attachmentIndex} onChange={(event) => setAttachmentIndex(Number(event.target.value))}>
              {attachmentOptions.map((option, index) => <option key={`${option.name}:${index}`} value={index} disabled={option.disabled}>
                {option.name}{option.disabled ? ` · ${t("fidelity.source.unavailable")}` : ""}
              </option>)}
            </select>
          </EditorField>
        </>}
      </div>
      <div className="t3-fidelity-editor-footer">
        {saving && <span className="t3-fidelity-editor-saving"><ReloadIcon />{tab === "exchanges"
          ? t("fidelity.editor.checkingName").replace("{name}", exchangeName(exchange.type))
          : t(tab === "wallets" ? "fidelity.editor.reading" : "fidelity.editor.saving")}</span>}
        <button type="button" onClick={onClose} disabled={saving}>{t("common.cancel")}</button>
        {tab === "exchanges" && step === "pick"
          ? <button className="primary" type="button" onClick={() => { setExchange({ type: selectedExchange, apiKey: "", secret: "", password: "", passphrase: "", active: true }); setStep("form"); }}>{t("fidelity.editor.continue").replace("{name}", exchangeName(selectedExchange))}</button>
          : <button className="primary" type="button" disabled={saving || (tab === "wallets" && !addressValid) || (tab === "brokers" && !brokerIdValid)}
            onClick={() => void submit()}>{saving ? t("fidelity.editor.savingShort") : t(tab === "wallets" ? "fidelity.source.addWallet" : tab === "custom" ? "fidelity.editor.addAsset" : "fidelity.editor.saveTest")}</button>}
      </div>
    </DialogContent>
  </Dialog>;
}
