import type { ReactNode } from "react";
import type { TargetIcon } from "@radix-ui/react-icons";

export default function EmptyState({ icon: Icon, title, hint, action, children, className = "" }: {
  icon: typeof TargetIcon;
  title: ReactNode;
  hint: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return <div data-empty-state data-card className={`t3-empty-state ${className}`}>
    <Icon aria-hidden="true" className="t3-empty-state-icon" />
    <h3>{title}</h3>
    <p>{hint}</p>
    {action}
    {children}
  </div>;
}
