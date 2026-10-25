import { useEffect, useState, type ButtonHTMLAttributes, type HTMLAttributes, type PropsWithChildren, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { QuoteColor } from "@/middlelayers/types";

export function MobileCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mobile-card", className)} {...props} />;
}

export function SectionHeader({ children, action, className }: PropsWithChildren<{
  action?: ReactNode; className?: string;
}>) {
  return <div className={cn("mobile-section-header", className)}>
    <h2>{children}</h2>{action}
  </div>;
}

export function DeltaPill({ value, children, className, quoteColor = "green-up-red-down" }: PropsWithChildren<{
  value: number; className?: string; quoteColor?: QuoteColor;
}>) {
  return <span className={cn("mobile-delta-pill", className)}
    data-tone={value === 0 ? "neutral"
      : (value > 0) === (quoteColor === "green-up-red-down") ? "gain" : "loss"}>{children}</span>;
}

export function Pill({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <span className={cn("mobile-pill", className)}>{children}</span>;
}

export function IconButton({ label, className, children, ...props }: PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string }
>) {
  return <button type="button" aria-label={label} className={cn("mobile-icon-button", className)} {...props}>
    {children}
  </button>;
}

export function Button({ className, children, ...props }: PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>>) {
  return <button type="button" className={cn("mobile-primary-button", className)} {...props}>{children}</button>;
}

export function MobileSkeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("mobile-skeleton", className)} />;
}

export function AnimatedAmount({ value, format, className }: {
  value: number; format: (value: number) => string; className?: string;
}) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = shown;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - start) / 350);
      setShown(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <span className={cn("ios-money", className)}>{format(shown)}</span>;
}

export function EmptyState({ title, description, action, onAction, illustrationLabel }: {
  title: string; description: string; action: string; onAction: () => void; illustrationLabel: string;
}) {
  return <div className="mobile-empty-state">
    <svg role="img" aria-label={illustrationLabel} viewBox="0 0 160 160" fill="none">
      <circle cx="80" cy="80" r="68" fill="currentColor" opacity=".08" />
      <circle cx="80" cy="80" r="48" stroke="currentColor" strokeWidth="2" opacity=".3" />
      <path d="M48 99h64M53 91l20-20 14 11 23-29" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="110" cy="53" r="5" fill="currentColor" />
    </svg>
    <h2>{title}</h2>
    <p>{description}</p>
    <Button onClick={onAction}>{action}</Button>
  </div>;
}
