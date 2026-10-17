import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input touch:h-11 touch:w-11 touch:bg-transparent touch:shadow-none touch:before:absolute touch:before:left-1 touch:before:top-2.5 touch:before:h-5 touch:before:w-9 touch:before:rounded-full touch:before:shadow-sm touch:data-[state=checked]:bg-transparent touch:data-[state=unchecked]:bg-transparent touch:data-[state=checked]:before:bg-primary touch:data-[state=unchecked]:before:bg-input",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none relative block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 touch:-translate-y-0.5 touch:translate-x-1.5 touch:data-[state=checked]:translate-x-[22px] touch:data-[state=unchecked]:translate-x-1.5"
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
