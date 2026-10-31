import { cn } from "@/lib/utils";
import { LinkProps, Link, useMatch, useResolvedPath } from "react-router-dom";
import { useTranslation } from "@/i18n";
import { useAlertBadge } from "../use-alert-badge";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { t } = useTranslation();
  const unread = useAlertBadge();

  function CustomLink({ children, to, ...props }: LinkProps) {
    const resolved = useResolvedPath(to);
    const match = useMatch({ path: resolved.pathname, end: false });

    return (
      <Link
        className={
          "text-sm font-medium text-muted-foreground transition-colors hover:text-primary " +
          (match ? "text-primary" : "")
        }
        to={to}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <nav
      className={cn("flex flex-wrap items-center gap-4", className)}
      {...props}
    >
      <CustomLink to="/overview">{t("nav.overview")}</CustomLink>
      <div role="group" aria-label={t("nav.analyze")} className="flex flex-wrap items-center gap-4">
        <CustomLink to="/summary">{t("nav.summary")}</CustomLink>
        <CustomLink to="/wallets">{t("nav.wallets")}</CustomLink>
        <CustomLink to="/comparison">{t("nav.comparison")}</CustomLink>
        <CustomLink to="/cost-basis">{t("nav.costBasis")}</CustomLink>
      </div>
      <div role="group" aria-label={t("nav.manage")} className="flex flex-wrap items-center gap-4">
        <CustomLink to="/history">{t("nav.history")}</CustomLink>
        <CustomLink to="/rebalance">{t("nav.rebalance")}</CustomLink>
        <CustomLink to="/goals">{t("nav.goals")}{unread > 0 && <><span aria-hidden="true" className="ml-1 rounded-full bg-negative px-1.5 text-xs text-background">{unread}</span>{" "}<span className="sr-only">{t("goals.unread").replace("{count}", String(unread))}</span></>}</CustomLink>
        <CustomLink to="/assistant">{t("nav.assistant")}</CustomLink>
      </div>
      <CustomLink to="/settings">{t("nav.settings")}</CustomLink>
    </nav>
  );
}
