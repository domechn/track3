import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckIcon, ChevronLeftIcon, Cross2Icon, ExternalLinkIcon, EyeOpenIcon, ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { ModalPage } from "@/mobile/components/mobile/overlays";
import { PublicIpInfo } from "@/components/configuration/public-ip-info";
import type { ExchangeRow, StockBrokerRow, WalletRow, SelectOption } from "@/components/configuration/types";

type Kind = "exchange" | "wallet" | "broker";
type Draft = ExchangeRow | WalletRow | StockBrokerRow;

const codes: Record<string, string> = {
  binance: "BN", okex: "OK", bitget: "BG", kraken: "KR", gate: "GT", coinbase: "CB",
  bybit: "BY", htx: "HT", mexc: "MX", backpack: "BP",
};
const walletOptions = [
  { type: "btc", code: "BTC", title: "BTC", detail: "Bitcoin", pro: false },
  { type: "erc20", code: "ETH", title: "ETH", detail: "Ethereum", pro: true },
  { type: "sol", code: "SOL", title: "SOL", detail: "Solana", pro: false },
  { type: "doge", code: "DOGE", title: "DOGE", detail: "Dogecoin", pro: false },
  { type: "trc20", code: "TRON", title: "TRON", detail: "TRON", pro: true },
  { type: "ton", code: "TON", title: "TON", detail: "TON", pro: false },
  { type: "sui", code: "SUI", title: "SUI", detail: "Sui", pro: false },
] as const;

function ShieldIcon() {
  return <svg aria-hidden="true" viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
    <path d="M9 1.5 15 4v4.1c0 4.1-2.4 6.6-6 8.4-3.6-1.8-6-4.3-6-8.4V4z" />
  </svg>;
}

function EditorField({ label, accessibleLabel, optional, id, value, placeholder, onChange, secret, mono, disabled, readOnly, invalid, valid, invalidIcon, message }: {
  label: string; accessibleLabel?: string; optional?: boolean; id: string; value: string; placeholder?: string; onChange: (next: string) => void;
  secret?: boolean; mono?: boolean; disabled?: boolean; readOnly?: boolean; invalid?: boolean; valid?: boolean; invalidIcon?: boolean; message?: string;
}) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return <div className="fidelity-editor-field">
    <label htmlFor={id}>{label}{optional && <span> {t("fidelity.settings.add.optional")}</span>}</label>
    <div className={`fidelity-editor-input${invalid ? " is-invalid" : ""}`}>
      <input id={id} type={secret && !show ? "password" : "text"} value={value} placeholder={placeholder}
        aria-label={accessibleLabel}
        disabled={disabled} readOnly={readOnly} onChange={(event) => onChange(event.target.value)} aria-invalid={invalid || undefined}
        aria-describedby={message ? `${id}-message` : undefined} className={mono ? "is-mono" : ""}
        autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
      {valid && <CheckIcon className="fidelity-editor-valid-icon" aria-hidden="true" />}
      {invalid && invalidIcon && <Cross2Icon className="fidelity-editor-invalid-icon" aria-hidden="true" />}
      {secret && <button type="button" className="fidelity-editor-eye" aria-label={`${t("mobile.sources.holdReveal")} ${label}`}
        onPointerDown={() => setShow(true)} onPointerUp={() => setShow(false)}
        onPointerCancel={() => setShow(false)} onPointerLeave={() => setShow(false)}
        onBlur={() => setShow(false)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setShow(true); }}
        onKeyUp={() => setShow(false)}><EyeOpenIcon aria-hidden="true" /></button>}
    </div>
    {message && <div id={`${id}-message`} className={`fidelity-editor-message${invalid ? " is-invalid" : valid ? " is-valid" : ""}`} role={invalid ? "alert" : undefined}>
      {invalid ? <ExclamationTriangleIcon aria-hidden="true" /> : valid ? <CheckIcon aria-hidden="true" /> : null}{message}
    </div>}
  </div>;
}

export function FidelitySourceEditor({
  kind, step, draft, original, exchangeOptions, saving, error, errorField, onChoose, onContinue, onBack, onUpdate, onSave, onClose,
}: {
  kind: Kind; step: 1 | 2; draft: Draft; original?: Draft; exchangeOptions: SelectOption[];
  saving: boolean; error: string; errorField?: string; fromPicker?: boolean;
  onChoose: (type: string) => void; onContinue: () => void; onBack: () => void;
  onUpdate: (patch: Record<string, string>) => void; onSave: () => void; onClose: () => void;
}) {
  const { t } = useTranslation();
  const exchange = draft as ExchangeRow, wallet = draft as WalletRow, broker = draft as StockBrokerRow;
  const checkedOkx = draft.type === "okex" && ["apiKey", "secret", "password"].includes(errorField ?? "");
  const secretIssue = checkedOkx && exchange.secret.length < 32
    ? exchange.secret ? t("fidelity.settings.add.shortSecret") : t("mobile.sources.required").replace("{field}", t("config.formApiSecret")) : undefined;
  const passIssue = checkedOkx && !exchange.password?.trim() ? t("fidelity.settings.add.okxPassphraseRequired") : undefined;
  const provider = exchangeOptions.find((option) => option.value === draft.type)?.label ?? draft.type;
  const title = kind === "exchange" ? step === 1 ? t("fidelity.settings.sources.addExchange")
    : `${original ? t("fidelity.settings.add.edit") : t("fidelity.settings.add.add")} ${provider}`
    : kind === "wallet" ? t(original ? "fidelity.settings.sources.editWallet" : "fidelity.settings.sources.addWallet")
    : t(original ? "fidelity.settings.sources.editBroker" : "fidelity.settings.sources.addBroker");
  const subtitle = kind === "exchange" ? step === 1 ? t("fidelity.settings.add.exchangeStep1") : t("fidelity.settings.add.exchangeStep2")
    : kind === "wallet" ? t("fidelity.settings.add.walletSubtitle") : t("fidelity.settings.add.brokerSubtitle");
  const header = <header className="fidelity-editor-head">
    {kind === "exchange" && step === 2 && !original && <button type="button" className="fidelity-editor-back" onClick={onBack}>
      <ChevronLeftIcon aria-hidden="true" />{t("fidelity.settings.add.chooseExchange")}</button>}
    <div className="fidelity-editor-heading ios-d3-editor-intro">
      {kind === "exchange" && step === 2 && <span className="fidelity-editor-code">{codes[draft.type] ?? draft.type.slice(0, 2).toUpperCase()}</span>}
      <div><h2>{title}</h2><p>{subtitle}</p></div>
      <button type="button" className="fidelity-editor-close" onClick={onClose} aria-label={t("common.close")}><Cross2Icon aria-hidden="true" /></button>
    </div>
  </header>;
  return <ModalPage title={t("mobile.sources.edit")} onDismiss={onClose} className="fidelity-editor-overlay">
    <div className="fidelity-editor-drawer">
      <div className="fidelity-editor-handle ios-d3-editor-nav" aria-hidden="true" />
      {header}
      <div className="fidelity-editor-body">
        {kind === "exchange" && step === 1 && <>
          <div className="fidelity-editor-picks">
            {[...exchangeOptions].sort((a, b) =>
              ["binance", "okex", "bitget", "kraken", "gate", "coinbase", "bybit", "htx", "mexc", "backpack"].indexOf(a.value)
              - ["binance", "okex", "bitget", "kraken", "gate", "coinbase", "bybit", "htx", "mexc", "backpack"].indexOf(b.value)
            ).map((option) => <button key={option.value} type="button"
              className={`fidelity-editor-pick${draft.type === option.value ? " is-selected" : ""}`}
              aria-pressed={draft.type === option.value} onClick={() => onChoose(option.value)}>
              <span className="fidelity-editor-code">{codes[option.value] ?? option.value.slice(0, 2).toUpperCase()}</span>
              <span><strong>{option.label}</strong><small>{["okex", "bitget"].includes(option.value)
                ? t("fidelity.settings.add.keySecretPass") : t("fidelity.settings.add.keySecret")}</small></span>
              {draft.type === option.value && <i className="fidelity-editor-selected-dot" />}
            </button>)}
          </div>
          <div className="fidelity-editor-banner is-info"><ShieldIcon /><div><strong>{t("fidelity.settings.add.readOnlyKeys")}</strong>
            <span>{t("fidelity.settings.add.readOnlyKeysHint")}</span></div></div>
          <p className="fidelity-editor-help">{t("fidelity.settings.add.notListedIntro")}{" "}
            <button type="button" onClick={() => { void openUrl("https://track3.dev/docs/").catch(() => {}); }}>
              {t("fidelity.settings.add.ipDocs")} <ExternalLinkIcon aria-hidden="true" />
            </button>
          </p>
        </>}
        {kind === "exchange" && step === 2 && <>
          <EditorField id="fidelity-ex-alias" label={t("fidelity.settings.add.label")}
            accessibleLabel={`${t("fidelity.settings.add.label")} ${t("fidelity.settings.add.optional")} ${t("config.formAlias")}`} optional value={draft.alias ?? ""}
            placeholder={provider} disabled={saving} onChange={(alias) => onUpdate({ alias })}
            message={t("fidelity.settings.add.aliasHint")} />
          <EditorField id="fidelity-ex-key" label={t("config.formApiKey")} value={exchange.apiKey} mono disabled={saving} readOnly={!!original}
            placeholder={t("mobile.sources.fieldRequired")} onChange={(apiKey) => onUpdate({ apiKey })}
            invalid={errorField === "apiKey"} message={errorField === "apiKey" ? error : undefined} />
          <EditorField id="fidelity-ex-secret" label={t("config.formApiSecret")} value={exchange.secret} mono secret disabled={saving}
            placeholder={t("mobile.sources.fieldRequired")} onChange={(secret) => onUpdate({ secret })}
            invalid={errorField === "secret" || !!secretIssue} message={errorField === "secret" ? error : secretIssue} />
          {["okex", "bitget"].includes(draft.type) && <EditorField id="fidelity-ex-pass" label={t("fidelity.settings.add.passphrase")}
            value={draft.type === "okex" ? exchange.password ?? "" : exchange.passphrase ?? ""}
            mono secret disabled={saving} placeholder={t("fidelity.settings.add.passphrase")}
            onChange={(value) => onUpdate(draft.type === "okex" ? { password: value } : { passphrase: value })}
            invalid={errorField === (draft.type === "okex" ? "password" : "passphrase") || !!passIssue}
            message={["password", "passphrase"].includes(errorField ?? "") ? error : passIssue} />}
          <PublicIpInfo t={t} mobile fidelity />
          <div className="fidelity-editor-banner is-info"><ShieldIcon /><div><strong>{t("fidelity.settings.add.readOnlyKeys")}</strong>
            <span>{t("fidelity.settings.add.readOnlyKeysHint")}</span></div></div>
        </>}
        {kind === "wallet" && <>
          <div className="fidelity-editor-field"><label>{t("fidelity.settings.add.walletType")}</label>
            <div className="fidelity-editor-wallets">{walletOptions.map((option) =>
              <button key={option.type} type="button" aria-pressed={draft.type === option.type} disabled={!!original}
                className={`fidelity-editor-pick${draft.type === option.type ? " is-selected" : ""}`}
                onClick={() => onChoose(option.type)}>{draft.type === option.type && <i className="fidelity-editor-selected-dot" />}
                <span><strong>{option.title} {option.pro && <em className="t3-tag" data-tone="accent">Pro</em>}</strong>
                  <small>{option.detail}</small></span></button>)}</div>
          </div>
          <EditorField id="fidelity-wallet-address" label={t("config.formAddress")} value={wallet.address} mono
            placeholder={draft.type === "btc" ? "bc1q… or 1… / 3…" : draft.type === "erc20" ? "0x…" : t("fidelity.settings.add.walletAddress")}
            disabled={saving} readOnly={!!original} onChange={(address) => onUpdate({ address })}
            invalid={errorField === "address"}
            invalidIcon
            valid={draft.type === "erc20" && /^0x[0-9a-fA-F]{40}$/.test(wallet.address)}
            message={errorField === "address" ? error : draft.type === "erc20" && /^0x[0-9a-fA-F]{40}$/.test(wallet.address)
              ? t("fidelity.settings.add.validEth") : t("fidelity.settings.add.publicAddressHint")} />
          <EditorField id="fidelity-wallet-alias" label={t("fidelity.settings.add.label")}
            accessibleLabel={`${t("fidelity.settings.add.label")} ${t("fidelity.settings.add.optional")} ${t("config.formAlias")}`} optional
            value={draft.alias ?? ""} placeholder={t("fidelity.settings.add.walletLabel")}
            disabled={saving} onChange={(alias) => onUpdate({ alias })} />
          {["erc20", "trc20"].includes(draft.type) && <div className="fidelity-editor-banner is-warning"><span>✧</span><div>
            <strong>{t("fidelity.settings.add.tokensNeedPro")}</strong><span>{t("fidelity.settings.add.tokensNeedProHint")}</span></div></div>}
          <div className="fidelity-editor-banner is-info"><ShieldIcon /><div><strong>{t("fidelity.settings.add.publicOnly")}</strong>
            <span>{t("fidelity.settings.add.publicOnlyHint")}</span></div></div>
        </>}
        {kind === "broker" && <>
          <div className="fidelity-editor-banner"><span className="fidelity-editor-code">IB</span><div>
            <strong>{t("fidelity.settings.add.interactiveBrokers")}</strong><span>{t("fidelity.settings.add.flexIntro")}</span></div></div>
          <EditorField id="fidelity-broker-query" label={t("fidelity.settings.add.flexQueryId")} value={broker.queryId} mono
            disabled={saving} readOnly={!!original} onChange={(queryId) => onUpdate({ queryId })} invalid={errorField === "queryId"}
            message={errorField === "queryId" ? error : undefined} />
          <EditorField id="fidelity-broker-token" label={t("fidelity.settings.add.flexToken")} value={broker.token} mono secret
            disabled={saving} onChange={(token) => onUpdate({ token })} invalid={errorField === "token"}
            message={errorField === "token" ? error : undefined} />
          <EditorField id="fidelity-broker-alias" label={t("fidelity.settings.add.label")}
            accessibleLabel={`${t("fidelity.settings.add.label")} ${t("fidelity.settings.add.optional")} ${t("config.formAlias")}`} optional
            value={draft.alias ?? ""} placeholder={t("fidelity.settings.add.interactiveBrokers")}
            disabled={saving} onChange={(alias) => onUpdate({ alias })} />
          <p className="fidelity-editor-help">{t("fidelity.settings.add.flexGuide")}<br />
            <button type="button" onClick={() => { void openUrl("https://track3.dev/docs/").catch(() => {}); }}>
              {t("fidelity.settings.add.flexGuideLink")} ↗
            </button></p>
          <div className="fidelity-editor-banner is-info"><ShieldIcon /><div><strong>{t("fidelity.settings.add.staysOnDevice")}</strong>
            <span>{t("fidelity.settings.add.staysOnDeviceHint")}</span></div></div>
        </>}
        {error && !errorField && <div role="alert" className="fidelity-editor-error"><ExclamationTriangleIcon aria-hidden="true" />{error}</div>}
      </div>
      <footer className="fidelity-editor-foot">
        <button type="button" onClick={onClose} disabled={saving}>{t("common.cancel")}</button>
        {kind === "exchange" && step === 1
          ? <button type="button" className="is-primary" onClick={onContinue}>{t("fidelity.settings.add.continueWith").replace("{provider}", provider)}</button>
          : <button type="button" className="is-primary ios-d3-editor-primary" onClick={onSave}
            aria-label={!saving && kind !== "wallet" ? `${t("fidelity.settings.add.saveTest")} · ${t("mobile.sources.add")}` : undefined}
            disabled={saving || (kind === "wallet" && (!wallet.address.trim() || errorField === "address")) || (kind === "broker" && errorField === "queryId")}>
            {saving ? t("fidelity.settings.add.saving") : kind === "wallet"
              ? t(original ? "common.save" : "fidelity.settings.sources.addWallet") : t("fidelity.settings.add.saveTest")}
          </button>}
      </footer>
    </div>
  </ModalPage>;
}
