import { cn } from "@/lib/utils";
import { LinkProps, Link, useMatch, useResolvedPath } from "react-router-dom";
import { useTranslation } from "@/i18n";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  const { t } = useTranslation();

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
      className={cn("flex items-center space-x-4 lg:space-x-6", className)}
      {...props}
    >
      <CustomLink to="/overview">{t("nav.overview")}</CustomLink>
      <CustomLink to="/summary">{t("nav.summary")}</CustomLink>
      <CustomLink to="/wallets">{t("nav.wallets")}</CustomLink>
      <CustomLink to="/comparison">{t("nav.comparison")}</CustomLink>
      <CustomLink to="/history">{t("nav.history")}</CustomLink>
      <CustomLink to="/settings">{t("nav.settings")}</CustomLink>
    </nav>
  );
}
