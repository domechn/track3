import { useEffect, useState } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { LOCALE_LABELS, SUPPORTED_LOCALES, useTranslation, type Locale } from "@/mobile/i18n";
import en from "@/mobile/en.json";
import zh from "@/mobile/zh.json";
import type { Theme } from "@/middlelayers/ui-state/appearance";
import type { QuoteColor } from "@/middlelayers/types";

const line = "0.0,41.8 5.3,45.3 10.7,41.9 16.0,44.1 21.3,37.2 26.7,33.4 32.0,40.3 37.3,42.1 42.7,40.4 48.0,39.8 53.3,39.7 58.7,40.4 64.0,42.1 69.3,46.0 74.7,44.2 80.0,45.9 85.3,44.7 90.7,48.0 96.0,46.0 101.3,44.8 106.7,45.1 112.0,43.9 117.3,37.9 122.7,32.4 128.0,27.5 133.3,25.1 138.7,16.1 144.0,16.3 149.3,5.9 154.7,5.7 160.0,4.0";

function sampleMoney(locale: Locale, value: number, signed = false) {
  const amount = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "currency", currency: "USD",
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : signed ? "+" : ""}${amount}`;
}

function samplePercent(locale: Locale, value: number) {
  const amount = new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
    style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(Math.abs(value));
  return `${value < 0 ? "−" : "+"}${amount}`;
}

function MiniPreview({ mode, split = false }: { mode: "light" | "dark"; split?: boolean }) {
  const { t, locale } = useTranslation();
  return <div className={`fidelity-theme-preview is-${mode}${split ? " is-split" : ""}`}>
    {(!split || mode === "dark") && <div className="fidelity-theme-preview-rail"><i /><i /><i /><i /></div>}
    <div className="fidelity-theme-preview-main">
      {split ? <><i /><i /></> : <><span>{t("overview.design.totalValue")}</span><strong>{sampleMoney(locale, 763809.27)}</strong></>}
      <svg viewBox="0 0 160 52" aria-hidden="true"><polyline points={line} /></svg>
      {split && <><div className="fidelity-theme-preview-skeleton" /><div className="fidelity-theme-preview-skeleton" /></>}
    </div>
  </div>;
}

function ChoiceRadio({ selected }: { selected: boolean }) {
  return <span className={`fidelity-choice-radio${selected ? " is-selected" : ""}`} aria-hidden="true" />;
}

export function FidelityAppearance({
  section, selectedTheme, quoteColor, selectedLocale, onThemeChange, onQuoteColorChange, onLanguageChange,
}: {
  section: "theme" | "language";
  selectedTheme: Theme;
  quoteColor: QuoteColor;
  selectedLocale: Locale;
  onThemeChange: (value: Theme) => void;
  onQuoteColorChange: (value: QuoteColor) => void;
  onLanguageChange: (value: Locale) => void;
}) {
  const { t } = useTranslation();
  const [languageToast, setLanguageToast] = useState(false);
  useEffect(() => {
    if (!languageToast) return;
    const timer = setTimeout(() => setLanguageToast(false), 4000);
    return () => clearTimeout(timer);
  }, [languageToast]);
  if (section === "theme") return <div className="fidelity-appearance">
    <section className="fidelity-appearance-card">
      <header className="fidelity-appearance-head"><h2>{t("fidelity.settings.appearance.theme")}</h2>
        <span>{t("fidelity.settings.appearance.instant")}</span></header>
      <div className="fidelity-theme-options">
        {(["light", "dark", "system"] as const).map((value) =>
          <button key={value} type="button" className={`fidelity-theme-option${selectedTheme === value ? " is-selected" : ""}`}
            aria-label={value === "system"
              ? `${t("fidelity.settings.appearance.system")} · ${t("appearance.theme.system")}`
              : t(`fidelity.settings.appearance.${value}`)}
            aria-pressed={selectedTheme === value} onClick={() => onThemeChange(value)}>
            <div className={`fidelity-theme-preview-wrap t3-theme-preview-${value}`} data-testid="theme-preview">{value === "system"
              ? <><MiniPreview mode="dark" split /><MiniPreview mode="light" split /></>
              : <MiniPreview mode={value} />}</div>
            <div className="fidelity-theme-option-copy"><ChoiceRadio selected={selectedTheme === value} />
              <div><strong>{t(`fidelity.settings.appearance.${value}`)}</strong>
                {value === "system" && <span className="sr-only">{t("appearance.theme.system")}</span>}
                <small>{t(`fidelity.settings.appearance.${value}Hint`)}</small></div></div>
          </button>)}
      </div>
      <p className="fidelity-appearance-note"><InfoCircledIcon aria-hidden="true" />
        {t("fidelity.settings.appearance.designNote")}</p>
    </section>
    <section className="fidelity-appearance-card">
      <header className="fidelity-appearance-head"><h2>{t("fidelity.settings.appearance.colours")}</h2></header>
      <p className="fidelity-appearance-description">{t("fidelity.settings.appearance.coloursHint")}</p>
      <div className="fidelity-colour-options">
        {(["green-up-red-down", "red-up-green-down"] as const).map((value) => <button key={value} type="button"
          className={`fidelity-colour-option${quoteColor === value ? " is-selected" : ""}`}
          aria-label={value === "green-up-red-down"
            ? `${t("fidelity.settings.appearance.greenUp")} · ${t("appearance.quoteColorGreenUp")}`
            : `${t("fidelity.settings.appearance.redUp")} · ${t("appearance.quoteColorRedUp")}`}
          aria-pressed={quoteColor === value} onClick={() => onQuoteColorChange(value)}>
          <div className="fidelity-colour-option-heading"><ChoiceRadio selected={quoteColor === value} />
            <div><strong>{t(value === "green-up-red-down" ? "fidelity.settings.appearance.greenUp" : "fidelity.settings.appearance.redUp")}</strong>
              <small>{t(value === "green-up-red-down" ? "fidelity.settings.appearance.greenUpHint" : "fidelity.settings.appearance.redUpHint")}</small></div>
          </div>
          <div className={`fidelity-colour-preview${value === "red-up-green-down" ? " is-red-up" : ""}`}>
            <div><span>{t("fidelity.settings.appearance.btcToday")}</span><strong>{samplePercent(selectedLocale, 0.0214)}</strong><small>{sampleMoney(selectedLocale, 1320.4, true)}</small></div>
            <div><span>{t("fidelity.settings.appearance.aaplToday")}</span><strong>{samplePercent(selectedLocale, -0.0107)}</strong><small>{sampleMoney(selectedLocale, -265.1, true)}</small></div>
          </div>
        </button>)}
      </div>
    </section>
  </div>;

  return <div className="fidelity-language">
    <h2 className="sr-only">{t("settings.mobile.language")}</h2>
    <section className="fidelity-language-card is-options">
      <div className="fidelity-language-intro"><h2>{t("fidelity.settings.language.appLanguage")}</h2>
        <p>{t("fidelity.settings.language.intro")}</p></div>
      {SUPPORTED_LOCALES.map((value) => <button key={value} type="button" aria-pressed={selectedLocale === value}
        className={`fidelity-language-option${selectedLocale === value ? " is-selected" : ""}`}
        onClick={() => { onLanguageChange(value); if (value !== selectedLocale) setLanguageToast(true); }}>
        <span className="fidelity-language-icon">{value === "en" ? "EN" : "中"}</span>
        <span className="fidelity-language-copy"><strong>{value === "zh" ? zh["fidelity.settings.language.chineseDetail"] : LOCALE_LABELS[value]}</strong>
          <small>{t(value === "en" ? "fidelity.settings.language.englishName" : "fidelity.settings.language.chineseEnglishName")}</small></span>
        <ChoiceRadio selected={selectedLocale === value} />
      </button>)}
      <p className="fidelity-language-footer">{t("fidelity.settings.language.instant")}</p>
    </section>
    <section className="fidelity-language-card is-preview">
      <header className="fidelity-appearance-head"><h2>{t("fidelity.settings.language.preview")}</h2>
        <span>{selectedLocale === "zh" ? zh["fidelity.settings.language.chineseDetail"] : LOCALE_LABELS[selectedLocale]}</span></header>
      <div className="fidelity-language-preview-rows">
        {(["fidelity.settings.language.previewOverview", "nav.history", "overview.design.totalValue", "fidelity.assistant.today"] as const).map((key) =>
          <div key={key}><strong>{t(key)}</strong><span>{selectedLocale === "en" ? zh[key] : en[key]}</span></div>)}
      </div>
      <p>{t("fidelity.settings.language.previewNote")}</p>
    </section>
    {languageToast && <div className="fidelity-language-toast" role="status"><strong>{t("fidelity.settings.language.changed")}</strong>
      <span>{t(selectedLocale === "zh" ? "fidelity.settings.language.changedToZh" : "fidelity.settings.language.changedToEn")}</span></div>}
  </div>;
}
