import { useEffect, useRef, useState } from "react";
import { ArrowBottomRightIcon, ArrowTopRightIcon } from "@radix-ui/react-icons";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import {
  getQuoteColor,
  saveQuoteColor,
  saveTheme,
} from "@/middlelayers/configuration";
import { QuoteColor } from "@/middlelayers/types";
import { useTheme } from "@/mobile/components/common/theme";
import { type Theme, THEME_VALUES, QUOTE_COLOR_VALUES } from "@/middlelayers/ui-state/appearance";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  useTranslation,
  type Locale,
} from "@/mobile/i18n";
import { isIOS } from "@/utils/platform";
import { useSearchParams } from "react-router-dom";
import { InsetGroup, ListRow } from "@/mobile/components/mobile";

const App = ({
  onQuoteColorChange,
}: {
  onQuoteColorChange?: (val: QuoteColor) => void;
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");
  const [selectedTheme, setSelectedTheme] = useState<Theme>("light");
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const originalThemeRef = useRef<Theme>("light");
  const currentTheme = useTheme();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    loadGeneralSettings();
  }, []);

  async function loadGeneralSettings() {
    const color = await getQuoteColor();
    setQuoteColor(color);
    setSelectedTheme(currentTheme.theme);
    originalThemeRef.current = currentTheme.theme;
  }

  async function handleThemeValueChange(val: string) {
    const v = val as Theme;
    if (v === originalThemeRef.current) return;
    await saveTheme(v);
    setSelectedTheme(v);
    originalThemeRef.current = v;
    currentTheme.setTheme(v);
  }

  async function handleQuoteColorValueChange(val: string) {
    const v = val as QuoteColor;
    await saveQuoteColor(v);
    setQuoteColor(v);
    if (onQuoteColorChange) {
      onQuoteColorChange(v);
    }
  }

  function handleLanguageValueChange(val: string) {
    const next = val as Locale;
    if (!SUPPORTED_LOCALES.includes(next)) {
      return;
    }
    setSelectedLocale(next);
    setLocale(next);
  }

  const section = isIOS() ? searchParams.get("section") : null;
  const showTheme = !section || section === "theme";
  const showLanguage = !section || section === "language";

  if (isIOS()) return <div className="ios-d3-mobile-appearance">
    {showTheme && <>
      <InsetGroup title={t("appearance.theme")}>
        {(["light", "dark", "system"] as const satisfies readonly Theme[]).map((value) => <button key={value} type="button"
          aria-label={t(`appearance.theme.${value}`)}
          aria-pressed={selectedTheme === value}
          className="t3-mobile-theme-choice" onClick={() => {
          setSelectedTheme(value);
          currentTheme.setTheme(value);
          void saveTheme(value);
        }}>
          <span data-testid="theme-preview" aria-hidden="true" className={`t3-theme-preview t3-theme-preview-${value}`}>
            <span className="t3-theme-preview-rail" />
            <span className="t3-theme-preview-content"><i /><b /><i /><em /></span>
          </span>
          <span className="t3-mobile-theme-choice-label">
            <span>{t(`appearance.theme.${value}`)}</span>
            <small>{t(`settings.phase6.themeHint.${value}`)}</small>
          </span>
          <span className="t3-mobile-theme-choice-radio" aria-hidden="true" />
        </button>)}
      </InsetGroup>
      <InsetGroup title={t("appearance.quoteColor")}>
        {QUOTE_COLOR_VALUES.map((value) => <ListRow key={value} className="ios-d3-choice-row" onClick={() => void handleQuoteColorValueChange(value)} trailing={<span className="ios-d3-choice-check" aria-hidden="true">{quoteColor === value ? "✓" : ""}</span>}>
          {t(value === "green-up-red-down" ? "appearance.quoteColorGreenUp" : "appearance.quoteColorRedUp")}
        </ListRow>)}
      </InsetGroup>
    </>}
    {showLanguage && <InsetGroup title={t("appearance.language")}>
      {SUPPORTED_LOCALES.map((value) => <ListRow key={value} className="ios-d3-choice-row" onClick={() => handleLanguageValueChange(value)} trailing={<span className="ios-d3-choice-check" aria-hidden="true">{selectedLocale === value ? "✓" : ""}</span>}>
        {LOCALE_LABELS[value]}
      </ListRow>)}
    </InsetGroup>}
  </div>;

  return (
    <div className="ios-d3-settings-content ios-d3-appearance space-y-6">
      {!section && <div>
        <h3 className="text-lg font-medium tracking-tight">{t("appearance.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appearance.subtitle")}
        </p>
      </div>}

      {!section && <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("appearance.currentTheme")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold capitalize">
              {selectedTheme}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("appearance.themeNote")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("appearance.quoteColor")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">
              {quoteColor === "green-up-red-down"
                ? t("appearance.quoteColorGreenUp")
                : t("appearance.quoteColorRedUp")}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("appearance.quoteColorNote")}
            </p>
          </CardContent>
        </Card>
      </div>}

      {showTheme && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("appearance.theme")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup
            onValueChange={(value) => setSelectedTheme(value as Theme)}
            value={selectedTheme}
            className="grid max-w-2xl grid-cols-1 md:grid-cols-2 gap-6"
          >
            {isIOS() && <Label htmlFor="system" className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3">
              <RadioGroupItem value="system" id="system" />
              {t("appearance.theme.system")}
            </Label>}
            <Label htmlFor="light" className="cursor-pointer">
              <RadioGroupItem value="light" className="sr-only" id="light" />
              <div
                className={`rounded-md border-2 p-1 ${
                  selectedTheme === "light" ? "border-foreground/60" : "border-muted"
                }`}
              >
                <div className="space-y-2 rounded-sm bg-muted/60 p-2">
                  <div className="space-y-2 rounded-md bg-card/90 p-2 shadow-sm border border-border/40">
                    <div className="h-2 w-[80px] rounded-lg bg-muted" />
                    <div className="h-2 w-[100px] rounded-lg bg-muted" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-card/90 p-2 shadow-sm border border-border/40">
                    <div className="h-4 w-4 rounded-full bg-muted" />
                    <div className="h-2 w-[100px] rounded-lg bg-muted" />
                  </div>
                </div>
              </div>
              <span className="block w-full p-2 text-center text-sm">
                {t("appearance.theme.light")}
              </span>
            </Label>

            <Label htmlFor="dark" className="cursor-pointer">
              <RadioGroupItem value="dark" className="sr-only" id="dark" />
              <div
                className={`rounded-md border-2 p-1 ${
                  selectedTheme === "dark" ? "border-foreground/60" : "border-muted"
                }`}
              >
                <div className="dark space-y-2 rounded-sm bg-background p-2">
                  <div className="space-y-2 rounded-md bg-card p-2 shadow-sm border border-border/40">
                    <div className="h-2 w-[80px] rounded-lg bg-muted" />
                    <div className="h-2 w-[100px] rounded-lg bg-muted" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-card p-2 shadow-sm border border-border/40">
                    <div className="h-4 w-4 rounded-full bg-muted" />
                    <div className="h-2 w-[100px] rounded-lg bg-muted" />
                  </div>
                </div>
              </div>
              <span className="block w-full p-2 text-center text-sm">
                {t("appearance.theme.dark")}
              </span>
            </Label>
          </RadioGroup>
          <Button onClick={() => handleThemeValueChange(selectedTheme)}>
            {t("common.updatePreferences")}
          </Button>
        </CardContent>
      </Card>}

      {showTheme && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("appearance.quoteColor")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={quoteColor} onValueChange={handleQuoteColorValueChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="green-up-red-down" id="green-up-red-down" />
              <Label htmlFor="green-up-red-down" className="touch:flex touch:min-h-11 touch:min-w-11 touch:cursor-pointer touch:items-center">
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("appearance.quoteColorGreenUp")}</span>
                  <ArrowTopRightIcon className="w-4 h-4 text-green-600" />
                  <ArrowBottomRightIcon className="w-4 h-4 text-red-600" />
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="red-up-green-down" id="red-up-green-down" />
              <Label htmlFor="red-up-green-down" className="touch:flex touch:min-h-11 touch:min-w-11 touch:cursor-pointer touch:items-center">
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("appearance.quoteColorRedUp")}</span>
                  <ArrowTopRightIcon className="w-4 h-4 text-red-600" />
                  <ArrowBottomRightIcon className="w-4 h-4 text-green-600" />
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>}

      {showLanguage && <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("appearance.language")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3 text-sm font-medium">
            {LOCALE_LABELS[selectedLocale]}
          </div>
          <RadioGroup
            value={selectedLocale}
            onValueChange={handleLanguageValueChange}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <div key={loc} className="flex items-center space-x-2">
                <RadioGroupItem value={loc} id={`language-${loc}`} />
                <Label htmlFor={`language-${loc}`} className="touch:flex touch:min-h-11 touch:min-w-11 touch:cursor-pointer touch:items-center">
                  <span className="text-sm">{LOCALE_LABELS[loc]}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>}
    </div>
  );
};

export default App;
