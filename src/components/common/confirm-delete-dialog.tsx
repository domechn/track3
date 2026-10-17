import { useState, type MouseEvent, type ReactElement } from "react";
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
  title: string;
  description: string;
  cancelLabel: string;
  actions: { label: string; onClick: () => void }[];
};

export default function ConfirmDeleteDialog({
  trigger,
  title,
  description,
  cancelLabel,
  actions,
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  return (
    <AlertDialog open={internalOpen} onOpenChange={setInternalOpen}>
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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={stopPropagation}>
            {cancelLabel}
          </AlertDialogCancel>
          {actions.map(({ label, onClick }, index) => (
            <AlertDialogAction
              key={index}
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
