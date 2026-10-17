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
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  cancelLabel: string;
  actions: { label: string; onClick: () => void }[];
};

export default function ConfirmDeleteDialog({
  trigger,
  open,
  onOpenChange,
  title,
  description,
  cancelLabel,
  actions,
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const changeOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <AlertDialog open={open ?? internalOpen} onOpenChange={changeOpen}>
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
        overlayProps={{ onClick: stopPropagation }}
        onClick={stopPropagation}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") changeOpen(false);
        }}
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
