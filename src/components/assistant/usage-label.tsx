import { useTranslation } from "@/i18n";
import type { TokenUsage } from "@/middlelayers/ai/budget";
import { CopyIcon } from "@radix-ui/react-icons";

export default function UsageLabel({
  usage,
  pricePerMillionTokens,
  inputPricePerMillionTokens,
  outputPricePerMillionTokens,
  model,
  copyText,
}: {
  usage: TokenUsage;
  pricePerMillionTokens?: number;
  inputPricePerMillionTokens?: number;
  outputPricePerMillionTokens?: number;
  model?: string;
  copyText?: string;
}) {
  const { t, locale } = useTranslation();
  const tokens = t("assistant.usage.tokens")
    .replace("{prompt}", usage.promptTokens.toLocaleString(locale ?? "en"))
    .replace("{completion}", usage.completionTokens.toLocaleString(locale ?? "en"));
  const amount = (usage.promptTokens * (inputPricePerMillionTokens ?? pricePerMillionTokens ?? 0) +
    usage.completionTokens * (outputPricePerMillionTokens ?? pricePerMillionTokens ?? 0)) / 1_000_000;
  const cost = inputPricePerMillionTokens === undefined && outputPricePerMillionTokens === undefined && pricePerMillionTokens === undefined ? "" :
    ` · ${t("assistant.usage.cost").replace("{cost}", new Intl.NumberFormat(locale ?? "en", {
      style: "currency", currency: "USD", minimumFractionDigits: 2,
      maximumFractionDigits: amount < 0.01 ? 6 : 4,
    }).format(amount))}`;
  const estimate = usage.source === "estimated" ? `${t("assistant.usage.estimated")} ` : "";
  return <>
    <span aria-label={`${estimate}${tokens}${cost}`} className="t3-assistant-usage-old text-[11px] text-muted-foreground">{estimate}{tokens}{cost}</span>
    {model && <span className="t3-assistant-usage-design">
      <svg width="12" height="12" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2l1.8 4.7L15.5 8.5l-4.7 1.8L9 15l-1.8-4.7L2.5 8.5l4.7-1.8z" /></svg>
      {t("fidelity.assistant.usageLine")
        .replace("{model}", model)
        .replace("{input}", usage.promptTokens.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))
        .replace("{output}", usage.completionTokens.toLocaleString(locale === "zh" ? "zh-CN" : "en-US"))
        .replace("{cost}", amount.toFixed(3))}
      {copyText && <button type="button" aria-label={t("fidelity.assistant.copyReply")}
        onClick={() => void navigator.clipboard?.writeText(copyText)}><CopyIcon aria-hidden="true" /></button>}
    </span>}
  </>;
}
