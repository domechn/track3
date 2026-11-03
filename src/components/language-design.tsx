import { useTranslation, type Locale } from "@/i18n";

type Props = { value: Locale; onChange: (value: Locale) => void };

const labels = [
  { locale: "en" as Locale, name: "English", description: "English", icon: "EN" },
  { locale: "zh" as Locale, name: "简体中文", description: "Simplified Chinese", icon: "中" },
];
const examples = [
  ["Overview", "总览"], ["History", "历史"], ["Total value", "总价值"], ["Today", "今天"],
];

export function LanguageDesign({ value, onChange }: Props) {
  const { t } = useTranslation();
  return <div className="t3-fidelity-language" data-testid="language-preview">
    <section className="choice-card">
      <div className="intro"><b>{t("fidelity.language.app")}</b><small>{t("fidelity.language.appNote")}</small></div>
      <div className="options" role="radiogroup" aria-label={t("fidelity.language.app")}>
        {labels.map((item) => <button key={item.locale} type="button" role="radio" aria-checked={value === item.locale}
          onClick={() => onChange(item.locale)}>
          <span className="icon">{item.icon}</span><span className="copy"><b>{item.name}</b><small>{item.description}</small></span><span className="radio" />
        </button>)}
      </div>
      <div className="footer">{t("fidelity.language.instant")}</div>
    </section>
    <section className="preview-card">
      <div className="heading"><b>{t("fidelity.language.preview")}</b><span>{value === "zh" ? "简体中文" : "English"}</span></div>
      <div className="examples">{examples.map(([en, zh]) => <div key={en}><b>{value === "zh" ? zh : en}</b><span>{value === "zh" ? en : zh}</span></div>)}</div>
      <div className="footer">{t("fidelity.language.currentLeft")}</div>
    </section>
  </div>;
}
