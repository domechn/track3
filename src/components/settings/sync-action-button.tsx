import type { ComponentProps } from "react";
import { ReloadIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";

export function SyncActionButton({
  pending, pendingLabel, children, ...props
}: ComponentProps<typeof Button> & { pending: boolean; pendingLabel: string }) {
  return (
    <Button {...props} className={`focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${pending
      ? "sync-action-pending" : ""} ${props.className ?? ""}`}
      disabled={props.disabled || pending} aria-busy={pending}>
      <span className="inline-grid place-items-center">
        <span className={`col-start-1 row-start-1 ${pending ? "invisible" : ""}`} aria-hidden={pending}>{children}</span>
        <span className={`col-start-1 row-start-1 inline-flex items-center ${pending ? "" : "invisible"}`} aria-hidden={!pending}>
          <ReloadIcon aria-hidden="true" className="mr-2 h-4 w-4 motion-safe:animate-spin" />
          {pendingLabel}
        </span>
      </span>
    </Button>
  );
}
