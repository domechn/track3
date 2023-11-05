import { cn } from "@/lib/utils";
import { LinkProps, Link, useMatch, useResolvedPath } from "react-router-dom";

export function MainNav({
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
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
      <CustomLink to="/overview">Overview</CustomLink>
      <CustomLink to="/wallets">Wallets</CustomLink>
      <CustomLink to="/comparison">Comparison</CustomLink>
      <CustomLink to="/history">History</CustomLink>
      <CustomLink to="/settings">Settings</CustomLink>
    </nav>
  );
}
