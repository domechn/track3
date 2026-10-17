import { useState, type MouseEvent, type ReactElement, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const stopPropagation = (event: MouseEvent) => event.stopPropagation();

type ConfirmDeleteDialogProps = {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  cancelLabel: string;
  actions: { label: string; onClick: () => void; disabled?: boolean }[];
};

export default function ConfirmDeleteDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  children,
  cancelLabel,
  actions,
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = open !== undefined;
  return (
    <AlertDialog
      open={controlled ? open : internalOpen}
      onOpenChange={(next) => {
        if (!controlled) setInternalOpen(next);
        onOpenChange?.(next);
      }}
    >
      {trigger && (
        <AlertDialogTrigger
          asChild
          onClick={stopPropagation}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") event.stopPropagation();
          }}
        >
          {trigger}
        </AlertDialogTrigger>
      )}
      <AlertDialogContent
        overlayProps={{ onClick: stopPropagation, "data-testid": "delete-dialog-overlay" } as React.ComponentPropsWithoutRef<typeof AlertDialogContent>["overlayProps"]}
        onClick={stopPropagation}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={stopPropagation}>
            {cancelLabel}
          </AlertDialogCancel>
          {actions.map(({ label, onClick, disabled }, index) => (
            <AlertDialogAction
              key={index}
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
            >
              {label}
            </AlertDialogAction>
          ))}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
