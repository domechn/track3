import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref}
    className={cn("min-h-[84px] w-full rounded-md border border-input bg-sunken px-3 py-2.5 text-[13px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:shadow-focus disabled:opacity-50", className)}
    {...props} />,
);
Textarea.displayName = "Textarea";

export { Textarea };
