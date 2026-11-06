import { useTranslation } from "@/i18n";
import { HintCoinList, HintPopover } from "./ui/hint-popover";

type Translate = (key: string) => string;

function CoinNames({ names, t }: { names: readonly string[]; t: Translate }) {
  return <HintCoinList names={names} more={(n) => t("profitSummary.coinMore").replace("{n}", String(n))}
    showAll={t("profitSummary.showAll")} showLess={t("profitSummary.showLess")} />;
}

export function PartialProfitHint({
  names, period, className, t, hoverParent = true,
}: {
  names: readonly string[];
  period: string;
  className?: string;
  t: Translate;
  hoverParent?: boolean;
}) {
  return <HintPopover label={t("profitSummary.explain").replace("{period}", period)}
    className={className} hoverParent={hoverParent}
    trigger={<span aria-hidden="true" className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] leading-none">?</span>}>
    <p>{t(names.length === 1 ? "profitSummary.partialReasonOne" : "profitSummary.partialReasonMany")}</p>
    <CoinNames names={names} t={t} />
    <p>{t(names.length === 1 ? "profitSummary.partialFixOne" : "profitSummary.partialFixMany")}</p>
  </HintPopover>;
}

export function PnlPercentHint({ names, t: givenT }: { names: readonly string[]; t?: Translate }) {
  const { t: defaultT } = useTranslation();
  const t = givenT ?? defaultT;
  const label = t("profitSummary.pnlHow");
  return <HintPopover className="inline-flex min-h-7 items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring touch:min-h-11"
    side="bottom"
    trigger={<><span aria-hidden="true">ⓘ</span> {label}</>}>
    <p>{t("profitSummary.pnlFormula")}</p>
    <p>{t("profitSummary.pnlCounts")}</p>
    {names.length > 0 && <><p>{t("profitSummary.pnlAssets")}</p><CoinNames names={names} t={t} /></>}
  </HintPopover>;
}
