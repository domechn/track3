import { useEffect, useState } from "react";
import {
  EyeClosedIcon,
  EyeOpenIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  AIConfigMissingError,
  DEFAULT_AI_CONTEXT_SIZE,
  loadAIConfig,
  saveAIConfig,
} from "@/middlelayers/configuration";
import { probeConnection } from "@/middlelayers/ai";
import type { AIAdvancedOptions, AIConfig } from "@/middlelayers/types";
import { useTranslation } from "@/i18n";

const ALLOWED_ADVANCED_KEYS = [
  "temperature",
  "top_p",
  "headers",
  "extraBody",
  "provider",
] as const;

type AllowedKey = (typeof ALLOWED_ADVANCED_KEYS)[number];

function serializeAdvanced(advanced?: AIAdvancedOptions): string {
  if (!advanced) return "";
  // Stable JSON so the textarea does not reshuffle keys on every render.
  return JSON.stringify(advanced, null, 2);
}

function parseAdvanced(
  raw: string,
): { value?: AIAdvancedOptions; error?: string; warnings: string[] } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: undefined, warnings: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return {
      error: (err as Error).message ?? String(err),
      warnings: [],
    };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { error: "Advanced options must be a JSON object.", warnings: [] };
  }
  const warnings: string[] = [];
  const value: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if ((ALLOWED_ADVANCED_KEYS as readonly string[]).includes(k)) {
      value[k] = v as never;
    } else {
      warnings.push(k);
    }
  }
  return { value: value as AIAdvancedOptions, warnings };
}

const App = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [endpoint, setEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [contextSize, setContextSize] = useState<number>(DEFAULT_AI_CONTEXT_SIZE);
  const [advancedJson, setAdvancedJson] = useState("");
  const [advancedWarnings, setAdvancedWarnings] = useState<string[]>([]);
  const [advancedError, setAdvancedError] = useState<string | undefined>();
  const [showKey, setShowKey] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [probeError, setProbeError] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const cfg = await loadAIConfig();
        if (!active) return;
        setEndpoint(cfg.endpoint);
        setApiKey(cfg.apiKey);
        setModel(cfg.model);
        setContextSize(cfg.contextSize);
        setAdvancedJson(serializeAdvanced(cfg.advanced));
      } catch (err) {
        if (!(err instanceof AIConfigMissingError) && active) {
          toast({
            description: (err as Error).message,
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
    const parsed = parseAdvanced(advancedJson);
    if (parsed.error) {
      setAdvancedError(parsed.error);
      return;
    }
    setAdvancedError(undefined);
    setAdvancedWarnings(parsed.warnings);

    const cfg: AIConfig = {
      endpoint: endpoint.trim(),
      apiKey,
      model: model.trim(),
      contextSize: Number.isFinite(contextSize)
        ? Math.max(1, Math.floor(contextSize))
        : DEFAULT_AI_CONTEXT_SIZE,
      advanced: parsed.value,
    };

    setSaving(true);
    try {
      await saveAIConfig(cfg);
      toast({ description: t("settings.assistant.saved") });
    } catch (err) {
      toast({
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    if (testing) return;
    setProbeError(undefined);
    setTesting(true);
    try {
      const err = await probeConnection({
        endpoint: endpoint.trim(),
        apiKey,
        model: model.trim(),
        messages: [{ role: "user", content: "ping" }],
      });
      if (err) {
        setProbeError(err);
        toast({
          description: t("settings.assistant.testFailed"),
          variant: "destructive",
        });
      } else {
        toast({ description: t("settings.assistant.testSuccess") });
      }
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      setProbeError(message);
      toast({
        description: message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium tracking-tight">
          {t("settings.assistant.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("settings.assistant.description")}
        </p>
      </div>

      <Card>
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

      <Card>
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
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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

      <Card>
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

      <Card>
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
            {t("settings.assistant.advancedJson")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="assistant-advanced">{t("settings.assistant.advancedJson")}</Label>
          <textarea
            id="assistant-advanced"
            value={advancedJson}
            onChange={(e) => setAdvancedJson(e.target.value)}
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
              className="text-xs text-destructive"
              data-testid="assistant-advanced-error"
            >
              {t("settings.assistant.invalidJson")} {advancedError}
            </p>
          )}
          {advancedWarnings.length > 0 && (
            <p
              className="text-xs text-amber-600 dark:text-amber-400"
              data-testid="assistant-advanced-warnings"
            >
              Unknown keys ignored: {advancedWarnings.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
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
