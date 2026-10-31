import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

const DropdownMenu = PopoverPrimitive.Root;
const DropdownMenuTrigger = PopoverPrimitive.Trigger;

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, sideOffset = 4, onKeyDown, onOpenAutoFocus, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content ref={ref} role="menu" sideOffset={sideOffset}
      className={cn("z-50 min-w-40 rounded-overlay border border-control bg-popover p-1 text-popover-foreground shadow-overlay outline-none", className)}
      onOpenAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || !["ArrowDown", "ArrowUp"].includes(event.key)) return;
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)')];
        const current = items.indexOf(document.activeElement as HTMLElement);
        items[(current + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
        event.preventDefault();
      }} {...props} />
  </PopoverPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

const DropdownMenuItem = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => <PopoverPrimitive.Close asChild>
    <button ref={ref} type="button" role="menuitem"
      className={cn("flex min-h-8 w-full items-center rounded-md px-2 text-left text-[13px] outline-none hover:bg-raised focus:bg-raised disabled:opacity-50", className)}
      {...props} />
  </PopoverPrimitive.Close>,
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
