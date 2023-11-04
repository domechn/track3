import { cn } from "@/lib/utils";
import { LinkProps, Link, useMatch, useResolvedPath } from "react-router-dom";
import { buttonVariants } from "../ui/button";

interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {
  items: {
    href: string;
    title: string;
  }[];
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  function CustomLink({ children, to, ...props }: LinkProps) {
    const resolved = useResolvedPath(to);
    const match = useMatch({ path: resolved.pathname, end: true });

    return (
      <Link
        className={cn(
          buttonVariants({ variant: "ghost" }),
          match
            ? "bg-muted hover:bg-muted"
            : "hover:bg-transparent hover:underline",
          "justify-start"
        )}
        to={to}
        {...props}
      >
        {children}
      </Link>
    );
  }

  return (
    <nav
      className={cn(
        "flex space-x-2 lg:flex-col lg:space-x-0 lg:space-y-1",
        className
      )}
      {...props}
    >
      {items.map((item) => (
        <CustomLink key={item.href} to={item.href}>
          {item.title}
        </CustomLink>
      ))}
    </nav>
  );
}
