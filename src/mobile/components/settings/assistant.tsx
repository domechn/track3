import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  EyeClosedIcon,
  EyeOpenIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/mobile/components/ui/switch";
import { useToast } from "@/mobile/components/ui/use-toast";
import {
  AIConfigMissingError,
  DEFAULT_AI_CONTEXT_SIZE,
  loadAIConfig,
  saveAIConfig,
} from "@/middlelayers/configuration";
import { probeConnection } from "@/middlelayers/ai";
import { useTranslation } from "@/mobile/i18n";
import { redactSecrets } from "@/middlelayers/security/redact";
import { serializeAdvanced, parseAdvanced, assistantConfigFromForm, assistantPriceInvalid, assistantSettingsSecrets } from "@/middlelayers/ui-state/config-form";
import { isIOS } from "@/utils/platform";

const App = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState("");
  const apiKeyRef = useRef<HTMLInputElement>(null);
  const currentKey = () => apiKeyRef.current?.value ?? "";
  const [model, setModel] = useState("");
  const [contextSize, setContextSize] = useState<number>(DEFAULT_AI_CONTEXT_SIZE);
  const [allowActions, setAllowActions] = useState(true);
  const [inputPrice, setInputPrice] = useState("");
  const [outputPrice, setOutputPrice] = useState("");
  const [priceError, setPriceError] = useState(false);
  const advancedRef = useRef<HTMLTextAreaElement>(null);
  const currentAdvanced = () => advancedRef.current?.value ?? "";
  const settingsSecrets = () => assistantSettingsSecrets(currentAdvanced());
  const [advancedWarnings, setAdvancedWarnings] = useState<string[]>([]);
  const [advancedError, setAdvancedError] = useState<string | undefined>();
  const [showKey, setShowKey] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probeError, setProbeError] = useState<string | undefined>();
  const [probeSuccess, setProbeSuccess] = useState(false);
  const [probeStats, setProbeStats] = useState<{ ms: number; time: string }>();
  const [advancedText, setAdvancedText] = useState("");
  const [proactiveInsightsSummary, setProactiveInsightsSummary] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await loadAIConfig();
        if (!active) return;
        setEndpoint(cfg.endpoint);
        if (apiKeyRef.current) apiKeyRef.current.value = cfg.apiKey;
        setModel(cfg.model);
        setContextSize(cfg.contextSize);
        setAllowActions(cfg.allowActions !== false);
        setProactiveInsightsSummary(cfg.proactiveInsightsSummary === true);
        const input = cfg.inputPricePerMillionTokens ?? cfg.pricePerMillionTokens;
        const output = cfg.outputPricePerMillionTokens ?? cfg.pricePerMillionTokens;
        setInputPrice(input === undefined ? "" : String(input));
        setOutputPrice(output === undefined ? "" : String(output));
        if (advancedRef.current) advancedRef.current.value = serializeAdvanced(cfg.advanced);
        setAdvancedText(serializeAdvanced(cfg.advanced));
      } catch (err) {
        if (!(err instanceof AIConfigMissingError) && active) {
          toast({
            description: redactSecrets((err as Error).message ?? String(err), [currentKey()]),
            variant: "destructive",
          });
        }
      } finally {
        if (active) {
          setLoaded(true);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  async function onSave() {
    if (saving) return;
    const invalidPrice = assistantPriceInvalid(inputPrice, outputPrice);
    setPriceError(invalidPrice);
    const parsed = parseAdvanced(currentAdvanced());
    if (parsed.error) {
      setAdvancedError(parsed.error);
      return;
    }
    setAdvancedError(undefined);
    if (invalidPrice) return;
    setAdvancedWarnings(parsed.warnings.map((warning) => redactSecrets(warning, [currentKey(), ...settingsSecrets()])));

    const cfg = assistantConfigFromForm({ endpoint, apiKey: currentKey(), model, contextSize, allowActions,
      inputPrice, outputPrice, advanced: parsed.value, proactiveInsightsSummary });

    setSaving(true);
    try {
      await saveAIConfig(cfg);
      toast({ description: t("settings.assistant.saved") });
    } catch (err) {
      toast({
        description: redactSecrets((err as Error).message ?? String(err), [currentKey(), ...settingsSecrets()]),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    if (testing) return;
    setProbeError(undefined);
    setProbeSuccess(false);
    setProbeStats(undefined);
    setTesting(true);
    const started = performance.now();
    try {
      const err = await probeConnection({
        endpoint: endpoint.trim(),
        apiKey: currentKey(),
        model: model.trim(),
        messages: [{ role: "user", content: "ping" }],
      });
      if (err) {
        setProbeError(redactSecrets(t(err, err), [currentKey()]));
        toast({
          description: t("settings.assistant.testFailed"),
          variant: "destructive",
        });
      } else {
        setProbeSuccess(true);
        setProbeStats({ ms: Math.round(performance.now() - started),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) });
        toast({ description: t("settings.assistant.testSuccess") });
      }
    } catch (err) {
      const message = redactSecrets((err as Error).message ?? String(err), [currentKey()]);
      setProbeError(message);
      toast({
        description: message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  if (isIOS()) {
    const configured = !!(endpoint && currentKey() && model);
    const parsedOptions = parseAdvanced(advancedText);
    const options = parsedOptions.value && typeof parsedOptions.value === "object"
      ? Object.entries(parsedOptions.value) : [];
    return <div className="fidelity-b fidelity-b-ai">
      <p className="fidelity-b-subtitle">{t("fidelity.b.ai.subtitle")}</p>
      <section className="fidelity-b-card fidelity-b-ai-connection">
        <div className="fidelity-b-card-head">
          <div><h2>{t("fidelity.b.ai.connection")}</h2>
            <p>{t("fidelity.b.ai.connectionHint")}</p></div>
          <span className={`fidelity-b-pill ${probeError ? "is-error" : probeSuccess ? "is-positive" : ""}`}>
            {probeError ? t("fidelity.b.ai.failed") : probeSuccess
              ? t("fidelity.b.ai.connected") : configured ? t("fidelity.b.ai.configured") : t("fidelity.b.ai.notConfigured")}
          </span>
        </div>
        <div className="fidelity-b-fields">
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-endpoint">{t("settings.assistant.endpoint")}</Label>
            <Input id="assistant-endpoint" value={endpoint} onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1" data-testid="assistant-endpoint"
              autoComplete="off" spellCheck={false} disabled={!loaded} />
            <p>{t("fidelity.b.ai.endpointHint")}</p>
          </div>
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-api-key">{t("settings.assistant.apiKey")}</Label>
            <div className="fidelity-b-input-end">
              <Input id="assistant-api-key" ref={apiKeyRef} type={showKey ? "text" : "password"}
                data-testid="assistant-api-key" autoComplete="off" spellCheck={false} disabled={!loaded} />
              <button type="button" onClick={() => setShowKey((value) => !value)}
                aria-label={t(showKey ? "settings.assistant.hideKey" : "settings.assistant.showKey")}
                data-testid="assistant-show-key" disabled={!loaded}>
                {showKey ? <EyeClosedIcon /> : <EyeOpenIcon />}
              </button>
            </div>
            <p>{t("fidelity.b.ai.keyHint")}</p>
          </div>
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-model">{t("settings.assistant.model")}</Label>
            <div className="fidelity-b-model-input">
              <Input id="assistant-model" value={model} onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini" data-testid="assistant-model" list="fidelity-b-ai-models"
                autoComplete="off" spellCheck={false} disabled={!loaded} />
              <ChevronDownIcon aria-hidden="true" />
            </div>
            <datalist id="fidelity-b-ai-models">
              <option value="anthropic/claude-sonnet-4.5" />
              <option value="gpt-4o-mini" />
            </datalist>
          </div>
        </div>
        <div className="fidelity-b-card-foot fidelity-b-ai-test">
          <Button variant="outline" onClick={onTest} disabled={testing || saving || !loaded}
            data-testid="assistant-test-connection">
            {testing ? t("settings.assistant.testingStatus") : t("settings.assistant.testConnection")}
          </Button>
          {probeError && <p className="fidelity-b-result is-error" data-testid="assistant-probe-error" role="alert">
            <ExclamationTriangleIcon aria-hidden="true" /><span>{probeError}</span></p>}
          {probeSuccess && <p className="fidelity-b-result is-positive"><CheckIcon aria-hidden="true" />
            <span>{probeStats ? t("fidelity.b.ai.testMeasured")
              .replace("{ms}", String(probeStats.ms)).replace("{model}", model.trim())
              .replace("{time}", probeStats.time) : t("fidelity.b.ai.testSuccess")}</span></p>}
          {!probeError && !probeSuccess && !testing && <p className="fidelity-b-result">{t("fidelity.b.ai.testPrompt")}</p>}
        </div>
      </section>

      <section className="fidelity-b-card fidelity-b-ai-context">
        <div className="fidelity-b-card-head"><div><h2>{t("fidelity.b.ai.context")}</h2>
          <p>{t("fidelity.b.ai.contextHint")}</p></div></div>
        <div className="fidelity-b-fields">
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-context-size">{t("settings.assistant.contextSize")}</Label>
            <Input id="assistant-context-size" type="number" min={1} value={Number.isFinite(contextSize) ? contextSize : ""}
              onChange={(e) => setContextSize(Number(e.target.value) || 0)}
              data-testid="assistant-context-size" disabled={!loaded} />
            <p>{t("fidelity.b.ai.contextSizeHint")}</p>
          </div>
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-input-price">{t("fidelity.b.ai.inputPrice")}</Label>
            <div className="fidelity-b-input-end"><Input id="assistant-input-price" type="number" min={0} step="any"
              aria-invalid={priceError} aria-describedby={priceError ? "assistant-price-error" : undefined}
              value={inputPrice} onChange={(e) => { setInputPrice(e.target.value); setPriceError(false); }} disabled={!loaded} />
              <span>/ 1M</span></div>
          </div>
          <div className="fidelity-b-field">
            <Label htmlFor="assistant-output-price">{t("fidelity.b.ai.outputPrice")}</Label>
            <div className="fidelity-b-input-end"><Input id="assistant-output-price" type="number" min={0} step="any"
              aria-invalid={priceError} aria-describedby={priceError ? "assistant-price-error" : undefined}
              value={outputPrice} onChange={(e) => { setOutputPrice(e.target.value); setPriceError(false); }} disabled={!loaded} />
              <span>/ 1M</span></div>
            {priceError && <p id="assistant-price-error" role="alert" className="is-error">{t("settings.assistant.invalidPrice")}</p>}
          </div>
        </div>
        <div className="fidelity-b-card-foot">
          <h3>{t("fidelity.b.ai.usage")}</h3>
          <p>{t("fidelity.b.ai.usageUnavailable")}</p>
        </div>
      </section>

      <section className="fidelity-b-card fidelity-b-ai-behaviour">
        <div className="fidelity-b-card-head"><h2>{t("fidelity.b.ai.behaviour")}</h2></div>
        <div className="fidelity-b-switch-row">
          <div><Label htmlFor="assistant-allow-actions">{t("fidelity.b.ai.allowActions")}</Label>
            <p>{t("fidelity.b.ai.allowActionsHint")}</p></div>
          <Switch id="assistant-allow-actions" checked={allowActions} onCheckedChange={setAllowActions} disabled={!loaded} />
        </div>
        <div className="fidelity-b-switch-row">
          <div><Label htmlFor="assistant-insight-summary">{t("fidelity.b.ai.proactive")}</Label>
            <p>{t("fidelity.b.ai.proactiveHint")}</p></div>
          <Switch id="assistant-insight-summary" checked={proactiveInsightsSummary}
            onCheckedChange={setProactiveInsightsSummary} disabled={!loaded} />
        </div>
      </section>

      <section className="fidelity-b-card fidelity-b-ai-advanced">
        <div className="fidelity-b-card-head">
          <div><h2>{t("fidelity.b.ai.advanced")}</h2><p>{t("fidelity.b.ai.advancedHint")}</p></div>
          <div className="fidelity-b-head-actions">
            <button type="button" onClick={() => {
              if (advancedRef.current) advancedRef.current.value = "";
              setAdvancedText("");
              setAdvancedError(undefined);
            }}>{t("fidelity.b.ai.reset")}</button>
            <button type="button" onClick={() => {
              const parsed = parseAdvanced(currentAdvanced());
              if (parsed.error) { setAdvancedError(parsed.error); return; }
              const formatted = serializeAdvanced(parsed.value ?? {});
              if (advancedRef.current) advancedRef.current.value = formatted;
              setAdvancedText(formatted);
              setAdvancedError(undefined);
            }}>{t("fidelity.b.ai.format")}</button>
          </div>
        </div>
        <textarea id="assistant-advanced" ref={advancedRef} data-testid="assistant-advanced"
          value={advancedText} onChange={(e) => { setAdvancedText(e.target.value); setAdvancedError(undefined); }}
          aria-invalid={!!advancedError} aria-describedby={advancedError ? "assistant-advanced-error" : undefined}
          rows={10} disabled={!loaded} spellCheck={false} />
        {advancedError
          ? <p id="assistant-advanced-error" role="alert" data-testid="assistant-advanced-error"
              className="fidelity-b-result is-error">{t(advancedError)}</p>
          : <p className="fidelity-b-result is-positive">{t("fidelity.b.ai.validJson")
            .replace("{count}", String(options.length))}</p>}
        {advancedWarnings.length > 0 && <p data-testid="assistant-advanced-warnings">
          {t("settings.assistant.unknownKeysIgnored").replace("{keys}", advancedWarnings.join(", "))}
        </p>}
        <div className="fidelity-b-option-list">
          {options.map(([name, value]) => <div key={name}>
            <span aria-hidden="true">✓</span><strong>{name}</strong>
            <span>{typeof value === "object" ? Array.isArray(value) ? `${value.length} items`
              : `${Object.keys(value ?? {}).length} keys` : String(value)}</span>
          </div>)}
        </div>
      </section>
      <div className="fidelity-b-ai-save">
        <span role="status" className="sr-only">{saving ? t("settings.assistant.savingStatus") : ""}</span>
        <Button onClick={onSave} disabled={saving || testing || !loaded} data-testid="assistant-save">
          {saving ? t("settings.assistant.savingStatus") : t("settings.assistant.save")}
        </Button>
      </div>
    </div>;
  }

  return (
    <div className="ios-d3-settings-content ios-d3-assistant-settings t3-assistant-settings">
      <div>
        <h3 className="text-lg font-medium tracking-tight">
          {t("settings.assistant.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.phase6.assistantDescription")}
        </p>
      </div>

      <Card className="ios-d3-assistant-field">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.endpoint")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-endpoint">{t("settings.assistant.endpoint")}</Label>
          <Input
            id="assistant-endpoint"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="https://api.openai.com/v1"
            data-testid="assistant-endpoint"
            autoComplete="off"
            spellCheck={false}
            disabled={!loaded}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.endpointHint")}
          </p>
        </CardContent>
      </Card>

      <Card className="ios-d3-assistant-field">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.apiKey")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-api-key">{t("settings.assistant.apiKey")}</Label>
          <div className="flex gap-2">
            <Input
              id="assistant-api-key"
              ref={apiKeyRef}
              type={showKey ? "text" : "password"}
              data-testid="assistant-api-key"
              autoComplete="off"
              spellCheck={false}
              disabled={!loaded}
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((s) => !s)}
              aria-label={
                showKey ? t("settings.assistant.hideKey") : t("settings.assistant.showKey")
              }
              data-testid="assistant-show-key"
              disabled={!loaded}
            >
              {showKey ? (
                <EyeClosedIcon className="h-4 w-4" />
              ) : (
                <EyeOpenIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="ios-d3-assistant-field">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.model")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-model">{t("settings.assistant.model")}</Label>
          <Input
            id="assistant-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="gpt-4o-mini"
            data-testid="assistant-model"
            autoComplete="off"
            spellCheck={false}
            disabled={!loaded}
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.modelHint")}
          </p>
        </CardContent>
      </Card>

      <Card className="ios-d3-assistant-field">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.contextSize")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-context-size">{t("settings.assistant.contextSize")}</Label>
          <Input
            id="assistant-context-size"
            type="number"
            min={1}
            value={Number.isFinite(contextSize) ? contextSize : ""}
            onChange={(e) => {
              const next = Number(e.target.value);
              setContextSize(Number.isFinite(next) ? next : 0);
            }}
            data-testid="assistant-context-size"
            disabled={!loaded}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.contextSizeHint")}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.price")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-input-price">{t("settings.assistant.inputPrice")}</Label>
          <Input
            id="assistant-input-price"
            aria-invalid={priceError}
            aria-describedby={priceError ? "assistant-price-error" : undefined}
            type="number"
            min={0}
            step="any"
            value={inputPrice}
            onChange={(event) => { setInputPrice(event.target.value); setPriceError(false); }}
            disabled={!loaded}
            className="max-w-[200px]"
          />
          <Label htmlFor="assistant-output-price">{t("settings.assistant.outputPrice")}</Label>
          <Input
            id="assistant-output-price"
            aria-invalid={priceError}
            aria-describedby={priceError ? "assistant-price-error" : undefined}
            type="number"
            min={0}
            step="any"
            value={outputPrice}
            onChange={(event) => { setOutputPrice(event.target.value); setPriceError(false); }}
            disabled={!loaded}
            className="max-w-[200px]"
          />
          <p className="text-xs text-muted-foreground">{t("settings.assistant.priceHint")}</p>
          {priceError && (
            <p id="assistant-price-error" role="alert" className="text-xs text-destructive">{t("settings.assistant.invalidPrice")}</p>
          )}
        </CardContent>
      </Card>

      <Card className="ios-d3-assistant-field">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("settings.assistant.advancedJson")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-advanced">{t("settings.assistant.advancedJson")}</Label>
          <textarea
            id="assistant-advanced"
            aria-invalid={!!advancedError}
            aria-describedby={advancedError ? "assistant-advanced-error" : undefined}
            ref={advancedRef}
            placeholder='{"temperature": 0.7, "top_p": 0.9}'
            rows={5}
            disabled={!loaded}
            data-testid="assistant-advanced"
            className="min-h-[100px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.assistant.advancedJsonHint")}
          </p>
          {advancedError && (
            <p
              id="assistant-advanced-error"
              role="alert"
              className="text-xs text-destructive"
              data-testid="assistant-advanced-error"
            >
              {t(advancedError)}
            </p>
          )}
          {advancedWarnings.length > 0 && (
            <p
              className="text-xs text-amber-600 dark:text-amber-400"
              data-testid="assistant-advanced-warnings"
            >
              {t("settings.assistant.unknownKeysIgnored").replace("{keys}", advancedWarnings.join(", "))}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex items-center gap-3">
            <Switch id="assistant-allow-actions" checked={allowActions} onCheckedChange={setAllowActions} disabled={!loaded} />
            <Label htmlFor="assistant-allow-actions">{t("settings.assistant.allowActions")}</Label>
          </div>
          <p className="text-xs text-muted-foreground">{t("settings.assistant.allowActionsHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div className="space-y-1">
            <Label htmlFor="assistant-insight-summary">{t("settings.assistant.insightSummary")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.assistant.insightSummaryHint")}</p>
          </div>
          <Switch id="assistant-insight-summary" checked={proactiveInsightsSummary}
            onCheckedChange={setProactiveInsightsSummary} disabled={!loaded} />
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <span role="status" className="sr-only">{testing ? t("settings.assistant.testingStatus") : saving ? t("settings.assistant.savingStatus") : ""}</span>
        <Button
          variant="outline"
          onClick={onTest}
          disabled={testing || saving || !loaded}
          data-testid="assistant-test-connection"
        >
          {testing && <ReloadIcon className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {t("settings.assistant.testConnection")}
        </Button>
        <Button
          onClick={onSave}
          disabled={saving || testing || !loaded}
          data-testid="assistant-save"
        >
          {saving && <ReloadIcon className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {t("settings.assistant.save")}
        </Button>
      </div>

      {probeError && (
        <p
          className="text-xs text-destructive"
          data-testid="assistant-probe-error"
        >
          {probeError}
        </p>
      )}
    </div>
  );
};

export default App;
