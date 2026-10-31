import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { indicatorClassName?: string; minimumFill?: boolean }
>(({ className, indicatorClassName, minimumFill, value, max, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    max={max}
    className={cn(
      "relative h-1 w-full overflow-hidden rounded-full bg-control",
      className
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className={cn("h-full w-full flex-1 bg-accent-data transition-all", indicatorClassName)}
      style={minimumFill
        ? { width: value && value > 0 ? `${Math.min(100, value / (max || 100) * 100)}%` : "0%", minWidth: value && value > 0 ? "8px" : undefined }
        : { transform: `translateX(-${100 - (max && max > 0 ? (value || 0) / max * 100 : (value || 0))}%)` }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
