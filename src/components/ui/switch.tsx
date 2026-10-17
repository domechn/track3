import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-11 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-transparent transition-colors before:absolute before:left-1 before:top-2.5 before:h-5 before:w-9 before:rounded-full before:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-input sm:h-5 sm:w-9 sm:shadow-sm sm:before:hidden sm:data-[state=checked]:bg-primary sm:data-[state=unchecked]:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative block h-4 w-4 -translate-y-0.5 translate-x-1.5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-[22px] sm:translate-y-0 sm:data-[state=checked]:translate-x-4 sm:data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
