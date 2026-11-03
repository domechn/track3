import { useEffect, useState, type RefObject } from "react";
import { CheckIcon, ExclamationTriangleIcon, EyeClosedIcon, EyeOpenIcon, ReloadIcon } from "@radix-ui/react-icons";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/i18n";
import { parseAdvanced, serializeAdvanced } from "@/middlelayers/ui-state/config-form";
import { listSessions, loadSession } from "@/middlelayers/ai/sessions";

type Props = {
  endpoint: string;
  setEndpoint: (value: string) => void;
  apiKeyRef: RefObject<HTMLInputElement>;
  keyDisplay: string;
  setKeyDisplay: (value: string) => void;
  showKey: boolean;
  setShowKey: (value: boolean) => void;
  model: string;
  setModel: (value: string) => void;
  contextSize: number;
  setContextSize: (value: number) => void;
  inputPrice: string;
  setInputPrice: (value: string) => void;
  outputPrice: string;
  setOutputPrice: (value: string) => void;
  priceError: boolean;
  allowActions: boolean;
  setAllowActions: (value: boolean) => void;
  proactiveInsightsSummary: boolean;
  setProactiveInsightsSummary: (value: boolean) => void;
  advancedRef: RefObject<HTMLTextAreaElement>;
  advancedError?: string;
  advancedWarnings: string[];
  probeError?: string;
  probeSuccess: boolean;
  loaded: boolean;
  testing: boolean;
  saving: boolean;
  onTest: () => void;
  onSave: () => void;
  onResetAdvanced: () => void;
  onFormatAdvanced: () => void;
};

const inputClass = "t3-b-input";
function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div className="t3-b-field"><label htmlFor={htmlFor}>{label}</label>{children}{hint && <small>{hint}</small>}</div>;
}
function highlightedJson(text: string) {
  const result: React.ReactNode[] = [];
  const pattern = /"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g;
  let position = 0;
  for (const token of text.matchAll(pattern)) {
    const start = token.index ?? position;
    result.push(text.slice(position, start));
    const value = token[0];
    const kind = value.startsWith('"') ? /^\s*:/.test(text.slice(start + value.length)) ? "key" : "string"
      : /^(true|false|null)$/.test(value) ? "boolean" : "number";
    result.push(<span className={`t3-b-code-${kind}`} key={start}>{value}</span>);
    position = start + value.length;
  }
  result.push(text.slice(position));
  return result;
}
function editorJson(value: string) {
  const parsed = parseAdvanced(value);
  if (!parsed.value) return value;
  return serializeAdvanced(parsed.value).replace(/"extraBody": \{\n\s+([^\n]+)\n\s+\}/g, '"extraBody": { $1 }');
}

export function AssistantDesign(p: Props) {
  const { t, locale } = useTranslation();
  const [code, setCode] = useState("");
  const [lastValidOptions, setLastValidOptions] = useState<NonNullable<ReturnType<typeof parseAdvanced>["value"]>>({});
  const [focusedField, setFocusedField] = useState<string>();
  const [priceDraft, setPriceDraft] = useState("");
  useEffect(() => {
    if (!p.loaded) return;
    const text = editorJson(p.advancedRef.current?.value ?? "");
    if (p.advancedRef.current) p.advancedRef.current.value = text;
    setCode(text);
  }, [p.loaded, p.advancedRef]);
  useEffect(() => {
    const valid = parseAdvanced(code).value;
    if (valid) setLastValidOptions(valid);
  }, [code]);
  const [monthlyUsage, setMonthlyUsage] = useState<{ input: number; output: number }>();
  useEffect(() => {
    let active = true;
    const month = new Date().toISOString().slice(0, 7);
    void listSessions().then(async (metas) => {
      const sessions = await Promise.allSettled(metas.filter((meta) => meta.updatedAt >= `${month}-01`).map((meta) => loadSession(meta.id)));
      if (!active) return;
      const totals = { input: 0, output: 0 };
      for (const result of sessions) {
        if (result.status !== "fulfilled" || !result.value) continue;
        for (const message of result.value.messages) {
          if (message.role !== "assistant" || !message.at?.startsWith(month) || !message.usage) continue;
          totals.input += message.usage.promptTokens;
          totals.output += message.usage.completionTokens;
        }
      }
      setMonthlyUsage(totals);
    }).catch(() => { if (active) setMonthlyUsage({ input: 0, output: 0 }); });
    return () => { active = false; };
  }, []);
  const money = (value: number) => new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", { style: "currency", currency: "USD" }).format(value);
  const inputCost = monthlyUsage ? monthlyUsage.input * Number(p.inputPrice || 0) / 1_000_000 : 0;
  const outputCost = monthlyUsage ? monthlyUsage.output * Number(p.outputPrice || 0) / 1_000_000 : 0;
  const status = p.testing ? "testing" : p.probeError ? "failed" : p.probeSuccess ? "connected" : "untested";
  const maskedKey = p.keyDisplay.length > 12
    ? `${p.keyDisplay.slice(0, 9)}${"•".repeat(24)}${p.keyDisplay.slice(-5)}` : "";
  const optionValues: Record<string, unknown> = parseAdvanced(code).value ?? lastValidOptions;
  const validOptions = Object.keys(optionValues);
  const trailingCommaIndex = code.search(/,\s*[}\]]/);
  const trailingCommaPart = trailingCommaIndex >= 0 ? code.slice(0, trailingCommaIndex + 1).split("\n") : [];
  const trailingComma = trailingCommaPart.length > 0 ? {
    line: trailingCommaPart.length,
    column: trailingCommaPart[trailingCommaPart.length - 1].length,
  } : undefined;
  const invalidTrailingComma = !!p.advancedError && !!trailingComma;
  const optionLabel = (name: string) => {
    const key = name === "extra_body" ? "extraBody" : name;
    const value = optionValues[key];
    if (value === undefined) return "—";
    if (name === "headers") return `${Object.keys(value as object).length} headers`;
    if (name === "extra_body") return `${Object.keys(value as object).length} key`;
    return String(value);
  };

  return <div className="t3-b-ai t3-b-grid">
    <section className="t3-b-card t3-b-connection">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.ai.connection")}</h3><p>{t("fidelity.settingsB.ai.connectionDesc")}</p></div>
        <span className={`t3-b-pill ${status}`}>{t(`fidelity.settingsB.ai.${status}`)}</span></div>
      <div className="t3-b-stack">
        <Field label={t("settings.assistant.endpoint")} htmlFor="assistant-endpoint" hint={t("fidelity.settingsB.ai.endpointHint")}>
          <input className={`${inputClass} mono`} id="assistant-endpoint" data-testid="assistant-endpoint" value={p.endpoint}
            onChange={(event) => p.setEndpoint(event.target.value)} disabled={!p.loaded} spellCheck={false} autoComplete="off" />
        </Field>
        <Field label={t("settings.assistant.apiKey")} htmlFor="assistant-api-key" hint={t("fidelity.settingsB.ai.keyHint")}>
          <div className="t3-b-key">
            <input className={`${inputClass} mono ${p.showKey ? "" : "masked"}`} id="assistant-api-key" data-testid="assistant-api-key"
              ref={p.apiKeyRef} type={p.showKey ? "text" : "password"} onChange={(event) => p.setKeyDisplay(event.target.value)}
              disabled={!p.loaded} autoComplete="off" spellCheck={false} />
            {!p.showKey && <span aria-hidden="true" className="t3-b-key-mask mono">{maskedKey}</span>}
            <button type="button" data-testid="assistant-show-key" aria-label={t(p.showKey ? "settings.assistant.hideKey" : "settings.assistant.showKey")}
              onClick={() => p.setShowKey(!p.showKey)} disabled={!p.loaded}>
              {p.showKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
            </button>
          </div>
        </Field>
        <Field label={t("settings.assistant.model")} htmlFor="assistant-model">
          <input className={`${inputClass} mono`} id="assistant-model" data-testid="assistant-model" value={p.model}
            onChange={(event) => p.setModel(event.target.value)} disabled={!p.loaded} spellCheck={false} autoComplete="off" />
        </Field>
      </div>
      <div className="t3-b-connection-foot">
        <button className="t3-b-button" data-testid="assistant-test-connection" onClick={p.onTest} disabled={!p.loaded || p.testing || p.saving}>
          {p.testing && <ReloadIcon className="animate-spin" />}{p.testing ? t("fidelity.settingsB.ai.testingAction") : t("settings.assistant.testConnection")}
        </button>
        <div className={`t3-b-result ${p.probeError ? "negative" : p.probeSuccess ? "positive" : ""}`}>
          {p.testing ? <ReloadIcon className="animate-spin" /> : p.probeError ? <ExclamationTriangleIcon /> : p.probeSuccess ? <CheckIcon /> : null}
          <span>{p.testing ? t("fidelity.settingsB.ai.testingText") : p.probeError || (p.probeSuccess ? t("fidelity.settingsB.ai.testSuccess") : t("fidelity.settingsB.ai.notTested"))}</span>
        </div>
      </div>
    </section>
    <section className="t3-b-card t3-b-cost">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.ai.contextCost")}</h3><p>{t("fidelity.settingsB.ai.contextDesc")}</p></div></div>
      <div className="t3-b-stack">
        <Field label={t("settings.assistant.contextSize")} htmlFor="assistant-context-size" hint={t("fidelity.settingsB.ai.contextHint")}>
          <div className="t3-b-input-end t3-b-select-style"><input id="assistant-context-size" data-testid="assistant-context-size" type="text" inputMode="numeric"
            value={focusedField === "context" ? (p.contextSize || "") : p.contextSize > 0
              ? t("fidelity.settingsB.ai.contextFormatted").replace("{count}", p.contextSize.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")) : ""}
            onFocus={() => setFocusedField("context")} onBlur={() => setFocusedField(undefined)}
            onChange={(event) => p.setContextSize(Number(event.target.value.replace(/\D/g, "")))} disabled={!p.loaded} />
            <span aria-hidden="true" className="t3-b-chevron" /></div>
        </Field>
        <div className="t3-b-pair">
          <Field label={t("fidelity.settingsB.ai.inputPrice")} htmlFor="assistant-input-price">
            <div className="t3-b-input-end t3-b-price"><span>$</span><input id="assistant-input-price" type="number" min={0} step="any"
              value={focusedField === "inputPrice" ? priceDraft : p.inputPrice === "" ? "" : Number(p.inputPrice).toFixed(2)}
              onFocus={() => { setPriceDraft(p.inputPrice === "" ? "" : Number(p.inputPrice).toFixed(2)); setFocusedField("inputPrice"); }}
              onBlur={() => setFocusedField(undefined)}
              aria-invalid={p.priceError} onChange={(event) => { setPriceDraft(event.target.value); p.setInputPrice(event.target.value); }}
              disabled={!p.loaded} /><span>/ 1M</span></div>
          </Field>
          <Field label={t("fidelity.settingsB.ai.outputPrice")} htmlFor="assistant-output-price">
            <div className="t3-b-input-end t3-b-price"><span>$</span><input id="assistant-output-price" type="number" min={0} step="any"
              value={focusedField === "outputPrice" ? priceDraft : p.outputPrice === "" ? "" : Number(p.outputPrice).toFixed(2)}
              onFocus={() => { setPriceDraft(p.outputPrice === "" ? "" : Number(p.outputPrice).toFixed(2)); setFocusedField("outputPrice"); }}
              onBlur={() => setFocusedField(undefined)}
              aria-invalid={p.priceError} onChange={(event) => { setPriceDraft(event.target.value); p.setOutputPrice(event.target.value); }}
              disabled={!p.loaded} /><span>/ 1M</span></div>
          </Field>
        </div>
        {p.priceError && <p role="alert" className="t3-b-negative">{t("settings.assistant.invalidPrice")}</p>}
      </div>
      <div className="t3-b-cost-foot"><div className="t3-b-rule" /><small>{t("fidelity.settingsB.ai.monthlyUsage")}</small>
        <div><span>{t("fidelity.settingsB.ai.inputTokens")}</span><span>{monthlyUsage ? `${monthlyUsage.input.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} · ${money(inputCost)}` : "—"}</span></div>
        <div><span>{t("fidelity.settingsB.ai.outputTokens")}</span><span>{monthlyUsage ? `${monthlyUsage.output.toLocaleString(locale === "zh" ? "zh-CN" : "en-US")} · ${money(outputCost)}` : "—"}</span></div>
        <div><strong>{t("fidelity.settingsB.ai.estimatedCost")}</strong><strong>{monthlyUsage ? money(inputCost + outputCost) : "—"}</strong></div>
      </div>
    </section>
    <section className="t3-b-card t3-b-behaviour">
      <div className="t3-b-card-head"><h3>{t("fidelity.settingsB.ai.behaviour")}</h3></div>
      <div className="t3-b-pair">
        <div className="t3-b-switch-row"><div><label htmlFor="assistant-allow-actions">{t("fidelity.settingsB.ai.allowActions")}</label><small>{t("fidelity.settingsB.ai.allowActionsHint")}</small></div>
          <Switch id="assistant-allow-actions" checked={p.allowActions} onCheckedChange={p.setAllowActions} disabled={!p.loaded} /></div>
        <div className="t3-b-switch-row"><div><label htmlFor="assistant-insight-summary">{t("fidelity.settingsB.ai.insightSummary")}</label><small>{t("fidelity.settingsB.ai.insightSummaryHint")}</small></div>
          <Switch id="assistant-insight-summary" checked={p.proactiveInsightsSummary} onCheckedChange={p.setProactiveInsightsSummary} disabled={!p.loaded} /></div>
      </div>
    </section>
    <section className="t3-b-card t3-b-advanced">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.ai.advanced")}</h3><p>{t("fidelity.settingsB.ai.advancedDesc")}</p></div>
        <div className="t3-b-header-actions">
          <button className="t3-b-button small" onClick={() => { p.onResetAdvanced(); setCode(p.advancedRef.current?.value ?? ""); }} disabled={!p.loaded}>{t("fidelity.settingsB.ai.reset")}</button>
          <button className="t3-b-button small" onClick={() => { p.onFormatAdvanced(); setCode(p.advancedRef.current?.value ?? ""); }} disabled={!p.loaded || !!p.advancedError}>{t("fidelity.settingsB.ai.format")}</button>
          <button className="t3-b-button small primary" data-testid="assistant-save" onClick={p.onSave} disabled={!p.loaded || p.saving || p.testing}>{t("settings.assistant.save")}</button>
        </div></div>
      <div className="t3-b-advanced-grid">
        <div><div className={`t3-b-code-wrap ${p.advancedError ? "invalid" : ""}`}>
          {invalidTrailingComma && <div aria-hidden="true" className="t3-b-code-error-row"
            style={{ top: `${8 + (trailingComma.line - 1) * 20}px` }} />}
          <div aria-hidden="true" className="t3-b-code-lines">{code.split("\n").map((_, index) =>
            <span key={index} className={invalidTrailingComma && trailingComma.line === index + 1 ? "t3-b-invalid-line" : undefined}>{index + 1}</span>)}</div>
          <pre aria-hidden="true" className="t3-b-code-highlight">{highlightedJson(code)}</pre>
          <textarea id="assistant-advanced" ref={p.advancedRef} data-testid="assistant-advanced" className={`t3-b-code ${p.advancedError ? "invalid" : ""}`}
            aria-label={t("fidelity.settingsB.ai.advanced")} aria-invalid={!!p.advancedError} rows={10} disabled={!p.loaded} spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
            onScroll={(event) => {
              const pre = event.currentTarget.previousElementSibling;
              const lines = event.currentTarget.parentElement?.querySelector(".t3-b-code-lines");
              if (pre) pre.scrollTop = event.currentTarget.scrollTop;
              if (lines) lines.scrollTop = event.currentTarget.scrollTop;
            }} />
        </div>
          <div className={`t3-b-result ${p.advancedError ? "negative" : "positive"}`} role={p.advancedError ? "alert" : "status"}>
            {p.advancedError ? <ExclamationTriangleIcon /> : <CheckIcon />}
            <span data-testid={p.advancedError ? "assistant-advanced-error" : undefined}>{invalidTrailingComma
              ? t("fidelity.settingsB.ai.trailingCommaError").replace("{line}", String(trailingComma.line)).replace("{column}", String(trailingComma.column))
              : p.advancedError ? t(p.advancedError) : t("fidelity.settingsB.ai.validJson").replace("{count}", String(validOptions.length))}</span>
          </div>
          {p.advancedWarnings.length > 0 && <small className="t3-b-negative" data-testid="assistant-advanced-warnings">{p.advancedWarnings.join(", ")}</small>}
        </div>
        <div className="t3-b-option-list">{["temperature", "top_p", "headers", "extra_body", "provider"].map((name) =>
          <div key={name}>{invalidTrailingComma && name === "provider" ? <ExclamationTriangleIcon className="t3-b-negative" /> : <CheckIcon />}
            <div><b>{name}</b><small>{t(`fidelity.settingsB.ai.option.${name}`)}</small></div>
            <span className={invalidTrailingComma && name === "provider" ? "t3-b-negative" : undefined}>{invalidTrailingComma
              ? name === "provider" ? t("fidelity.settingsB.ai.errorLine").replace("{line}", String(trailingComma.line)) : t("fidelity.settingsB.ai.lastValid")
              : optionLabel(name)}</span></div>)}</div>
      </div>
    </section>
  </div>;
}
