import { useEffect, useState } from "react";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { queryHistoricalData } from "@/middlelayers/charts-history";
import type { QuoteColor } from "@/middlelayers/types";
import type { Theme } from "@/middlelayers/ui-state/appearance";
import { useTranslation } from "@/i18n";

type Props = {
  selectedTheme: Theme;
  quoteColor: QuoteColor;
  onThemeChange: (value: string) => void;
  onQuoteColorChange: (value: string) => void;
};

const themeChoices: { id: Theme; title: string; subtitle: string }[] = [
  { id: "light", title: "Light", subtitle: "Bright surfaces" },
  { id: "dark", title: "Dark", subtitle: "Terminal, true neutral" },
  { id: "system", title: "System", subtitle: "Follows your device" },
];

function Mini({ mode, values, total, faint = false, hideRail = false }: { mode: "light" | "dark"; values: number[]; total: number; faint?: boolean; hideRail?: boolean }) {
  const lo = Math.min(...values), hi = Math.max(...values);
  const points = values.map((value, index) => `${index / Math.max(1, values.length - 1) * 160},${48 - (value - lo) / Math.max(1, hi - lo) * 44}`).join(" ");
  return <div className={`t3-fidelity-appearance-mini ${mode} ${faint ? "faint" : ""} ${hideRail ? "no-rail" : ""}`}>
    {!hideRail && <div className="rail"><i /><i /><i /><i /></div>}
    <div className="main">
      {faint ? <><i className="skeleton" /><i className="skeleton" /></> : <><small>Total value</small><b>${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></>}
      {/* color-semantics: neutral this preview line shows total value. */}
      <svg viewBox="0 0 160 52" aria-hidden="true"><polyline fill="none" stroke="#4a8ad6" strokeWidth="1.5" points={points} /></svg>
      {[70, 54, 38].map((width) => <div className="fake-row" key={width}><i style={{ width: width / 2 }} /><i /></div>)}
    </div>
  </div>;
}

export function AppearanceDesign({ selectedTheme, quoteColor, onThemeChange, onQuoteColorChange }: Props) {
  const { t } = useTranslation();
  const [values, setValues] = useState<number[]>([]);
  useEffect(() => {
    let live = true;
    void queryHistoricalData(31, true, { includeTransactions: false })
      .then((rows) => { if (live) setValues(rows.map((row) => row.total).reverse()); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const total = values.at(-1) ?? 0;
  const series = values.length > 1 ? values : [0, 1];
  const quoteChoices: { value: QuoteColor; title: string; subtitle: string; up: string; down: string }[] = [
    { value: "green-up-red-down", title: t("fidelity.appearance.green"), subtitle: t("fidelity.appearance.greenNote"), up: "hsl(var(--positive))", down: "hsl(var(--negative))" },
    { value: "red-up-green-down", title: t("fidelity.appearance.red"), subtitle: t("fidelity.appearance.redNote"), up: "hsl(var(--negative))", down: "hsl(var(--positive))" },
  ];
  return <div className="t3-fidelity-appearance" data-testid="theme-preview-grid">
    <section>
      <div className="heading"><b>{t("fidelity.appearance.theme")}</b><small>{t("fidelity.appearance.instant")}</small></div>
      <div className="choices" role="radiogroup" aria-label={t("fidelity.appearance.theme")}>
        {themeChoices.map(({ id, title, subtitle }) => <button key={id} type="button" className="theme-choice"
          role="radio" aria-checked={selectedTheme === id} onClick={() => onThemeChange(id)}>
          {id === "system" ? <div className="split"><Mini mode="dark" values={series} total={total} faint /><Mini mode="light" values={series} total={total} faint hideRail /></div>
            : <Mini mode={id} values={series} total={total} />}
          <span className="choice-copy"><i className="radio" /><span><b>{t(`fidelity.appearance.${id}`) || title}</b><small>{t(`fidelity.appearance.${id}Note`) || subtitle}</small></span></span>
        </button>)}
      </div>
      <p className="note"><InfoCircledIcon />{t("fidelity.appearance.designNote")}</p>
    </section>
    <section>
      <div className="heading"><b>{t("fidelity.appearance.colours")}</b></div>
      <p className="intro">{t("fidelity.appearance.coloursNote")}</p>
      <div className="colour-choices" role="radiogroup" aria-label={t("fidelity.appearance.colours")}>
        {quoteChoices.map((choice) => <button key={choice.value} type="button" role="radio" aria-checked={quoteColor === choice.value}
          className="colour-choice" onClick={() => onQuoteColorChange(choice.value)}>
          <span className="choice-copy"><i className="radio" /><span><b>{choice.title}</b><small>{choice.subtitle}</small></span></span>
          <span className="samples">
            <span><small>{t("fidelity.appearance.btcToday")}</small><b style={{ color: choice.up }}>+2.14%</b><small style={{ color: choice.up }}>+$1,320.40</small></span>
            <span><small>{t("fidelity.appearance.aaplToday")}</small><b style={{ color: choice.down }}>−1.07%</b><small style={{ color: choice.down }}>−$265.10</small></span>
          </span>
        </button>)}
      </div>
    </section>
  </div>;
}
