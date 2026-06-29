import { useTranslation } from "@/i18n";
import { MagicWandIcon, ArchiveIcon } from "@radix-ui/react-icons";

export const QUICK_ACTION_KEYS = {
  recentAnalysis: "recentAnalysis",
  recentOperations: "recentOperations",
} as const;

export type QuickActionKey =
  (typeof QUICK_ACTION_KEYS)[keyof typeof QUICK_ACTION_KEYS];

const PROMPTS: Record<QuickActionKey, string> = {
  recentAnalysis:
    "Give me a short financial analysis of my portfolio: total value, " +
    "top holdings, and the 30-day change.",
  recentOperations:
    "List my most recent transactions across all wallets, grouped by " +
    "type, and flag any unusual activity.",
};

export function quickActionPrompt(key: QuickActionKey): string {
  return PROMPTS[key];
}

export default function QuickActions({
  disabled,
  onRun,
}: {
  disabled?: boolean;
  onRun: (key: QuickActionKey) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-[var(--glass-border)] bg-card/30 px-4 py-2">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {t("assistant.chat.quickActions.label")}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRun(QUICK_ACTION_KEYS.recentAnalysis)}
        disabled={disabled}
        className="gap-1.5"
        data-testid="quick-action-analysis"
      >
        <MagicWandIcon className="h-3.5 w-3.5" />
        {t("assistant.chat.quickActions.recentAnalysis")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onRun(QUICK_ACTION_KEYS.recentOperations)}
        disabled={disabled}
        className="gap-1.5"
        data-testid="quick-action-operations"
      >
        <ArchiveIcon className="h-3.5 w-3.5" />
        {t("assistant.chat.quickActions.recentOperations")}
      </Button>
    </div>
  );
}

function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "outline";
  size?: "sm";
}) {
  // Local wrapper so we keep the same data-testid plumbing without
  // pulling shadcn Button variants into the AI module when not needed.
  const base =
    "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium " +
    "transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 " +
    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
    "disabled:pointer-events-none disabled:opacity-50";
  const sizes = size === "sm" ? "h-7 px-2.5" : "h-9 px-4";
  const variants =
    variant === "outline"
      ? "border border-[var(--glass-border)] bg-transparent hover:bg-accent/60 hover:text-foreground"
      : "bg-primary text-primary-foreground";
  return (
    <button
      type="button"
      className={`${base} ${sizes} ${variants} ${className ?? ""}`}
      {...props}
    />
  );
}
