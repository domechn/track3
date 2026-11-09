import type { CurrencyRateDetail } from "@/middlelayers/types";
import { useTranslation } from "@/i18n";
import { useTranslation as useMobileTranslation } from "@/mobile/i18n";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function CurrencySwitchButton({ preferredCurrency, displayCurrency, onToggle, collapsed = false, mobile = false, disabled = false }: {
  preferredCurrency: CurrencyRateDetail;
  displayCurrency: CurrencyRateDetail;
  onToggle: () => void;
  collapsed?: boolean;
  mobile?: boolean;
  disabled?: boolean;
}) {
  const desktopT = useTranslation().t;
  const mobileT = useMobileTranslation().t;
  const t = mobile ? mobileT : desktopT;
  if (preferredCurrency.currency === "USD") return null;
  const overridden = displayCurrency.currency === "USD";
  const label = t("currency.quick.showIn").replace("{currency}", overridden ? preferredCurrency.currency : "USD");
  const button = <button type="button" onClick={onToggle} disabled={disabled}
    aria-label={label} aria-pressed={overridden} title={label}
    className={cn("t3-nav-item t3-currency-switch group relative flex w-full items-center gap-3 px-[9px] text-[13px] font-medium whitespace-nowrap",
      mobile && "mobile-rail-item", collapsed && "justify-center px-0")}>
    <span className="t3-currency-switch-icon" aria-hidden="true">
      <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="9" cy="9" r="6.5" /><path d="M6 7h6M6 10h6" />
      </svg>
      <span className={cn("t3-currency-switch-badge", overridden && "is-overridden")}>{displayCurrency.currency}</span>
    </span>
    {!collapsed && <span className="truncate">{t("currency.quick.label")}</span>}
  </button>;
  return <TooltipProvider delayDuration={220}><Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger>
    <TooltipContent side={collapsed ? "right" : "top"} sideOffset={10}>{label}</TooltipContent>
  </Tooltip></TooltipProvider>;
}
