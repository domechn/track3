import { useTranslation } from "@/i18n";
import type { TokenUsage } from "@/middlelayers/ai/budget";

export default function UsageLabel({
  usage,
  pricePerMillionTokens,
}: {
  usage: TokenUsage;
  pricePerMillionTokens?: number;
}) {
  const { t, locale } = useTranslation();
  const tokens = t("assistant.usage.tokens")
    .replace("{prompt}", usage.promptTokens.toLocaleString(locale ?? "en"))
    .replace("{completion}", usage.completionTokens.toLocaleString(locale ?? "en"));
  const amount = (usage.promptTokens + usage.completionTokens) * (pricePerMillionTokens ?? 0) / 1_000_000;
  const cost = pricePerMillionTokens === undefined ? "" :
    ` · ${t("assistant.usage.cost").replace("{cost}", new Intl.NumberFormat(locale ?? "en", {
      style: "currency", currency: "USD", minimumFractionDigits: 2,
      maximumFractionDigits: amount < 0.01 ? 6 : 4,
    }).format(amount))}`;
  const estimate = usage.source === "estimated" ? `${t("assistant.usage.estimated")} ` : "";
  return <span aria-label={`${estimate}${tokens}${cost}`} className="text-[11px] text-muted-foreground">{estimate}{tokens}{cost}</span>;
}
