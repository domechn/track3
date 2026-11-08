import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TagTone = "neutral" | "accent" | "positive" | "negative" | "warning" | "outline";

export function Tag({ tone = "neutral", className, ...props }: HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone;
}) {
  return <span className={cn("t3-tag", className)} data-tone={tone} {...props} />;
}
