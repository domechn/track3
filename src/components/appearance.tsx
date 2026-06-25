import { useEffect, useState } from "react";
import { ArrowBottomRightIcon, ArrowTopRightIcon } from "@radix-ui/react-icons";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import {
  getQuoteColor,
  saveQuoteColor,
  saveTheme,
} from "@/middlelayers/configuration";
import { QuoteColor } from "@/middlelayers/types";
import { reloadApp } from "@/utils/app";
import { Theme, useTheme } from "./common/theme";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  useTranslation,
  type Locale,
} from "@/i18n";

const App = ({
  onQuoteColorChange,
}: {
  onQuoteColorChange?: (val: QuoteColor) => void;
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [quoteColor, setQuoteColor] = useState<QuoteColor>("green-up-red-down");
  const [selectedTheme, setSelectedTheme] = useState<Theme>("light");
  const [selectedLocale, setSelectedLocale] = useState<Locale>(locale);
  const currentTheme = useTheme();

  useEffect(() => {
    loadGeneralSettings();
  }, []);

  async function loadGeneralSettings() {
    const color = await getQuoteColor();
    setQuoteColor(color);
    setSelectedTheme(currentTheme.theme);
  }

  async function handleThemeValueChange(val: string) {
    const v = val as Theme;
    await saveTheme(v);
    setSelectedTheme(v);
    reloadApp();
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium tracking-tight">{t("appearance.title")}</h3>
        <p className="text-sm text-muted-foreground">
          {t("appearance.subtitle")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
      </div>

      <Card>
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
                <div className="space-y-2 rounded-sm bg-slate-950/95 p-2">
                  <div className="space-y-2 rounded-md bg-slate-800/90 p-2 shadow-sm border border-white/10">
                    <div className="h-2 w-[80px] rounded-lg bg-slate-400/80" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-400/80" />
                  </div>
                  <div className="flex items-center space-x-2 rounded-md bg-slate-800/90 p-2 shadow-sm border border-white/10">
                    <div className="h-4 w-4 rounded-full bg-slate-400/80" />
                    <div className="h-2 w-[100px] rounded-lg bg-slate-400/80" />
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
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("appearance.quoteColor")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={quoteColor} onValueChange={handleQuoteColorValueChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="green-up-red-down" id="green-up-red-down" />
              <Label htmlFor="green-up-red-down">
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("appearance.quoteColorGreenUp")}</span>
                  <ArrowTopRightIcon className="w-4 h-4 text-green-600" />
                  <ArrowBottomRightIcon className="w-4 h-4 text-red-600" />
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="red-up-green-down" id="red-up-green-down" />
              <Label htmlFor="red-up-green-down">
                <div className="flex items-center gap-2 text-sm">
                  <span>{t("appearance.quoteColorRedUp")}</span>
                  <ArrowTopRightIcon className="w-4 h-4 text-red-600" />
                  <ArrowBottomRightIcon className="w-4 h-4 text-green-600" />
                </div>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
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
                <Label htmlFor={`language-${loc}`}>
                  <span className="text-sm">{LOCALE_LABELS[loc]}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
