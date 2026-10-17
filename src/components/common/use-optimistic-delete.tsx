import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { recordSnapshotDeleted, recordSnapshotUndone } from "@/middlelayers/sync/delete-hook";

type DeleteOptions<T, Result> = {
  update: (items: T) => T;
  rollback: (items: T) => T;
  commit: () => Promise<Result>;
  undo: (result: Result) => Promise<void>;
  onDeleted?: () => void;
  onUndone?: () => void;
  successMessage: string;
  undoLabel: string;
  undoAltText: string;
  undoWindowMs: number;
  syncSnapshotUuid?: string;
};

export function useOptimisticDelete<T>(setItems: Dispatch<SetStateAction<T>>) {
  const { toast } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  const run = useCallback(async <Result,>({
    update,
    rollback,
    commit,
    undo,
    onDeleted,
    onUndone,
    successMessage,
    undoLabel,
    undoAltText,
    undoWindowMs,
    syncSnapshotUuid,
  }: DeleteOptions<T, Result>) => {
    setIsDeleting(true);
    setItems(update);
    const showError = (error: unknown) => toast({
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
    try {
      const result = await commit();
      if (syncSnapshotUuid) {
        void recordSnapshotDeleted(syncSnapshotUuid).catch(showError);
      }
      onDeleted?.();
      toast({
        description: successMessage,
        duration: undoWindowMs,
        action: (
          <ToastAction
            altText={undoAltText}
            onClick={() => {
              void undo(result)
                .then(() => {
                  setItems(rollback);
                  onUndone?.();
                  if (syncSnapshotUuid) void recordSnapshotUndone(syncSnapshotUuid).catch(showError);
                })
                .catch(showError);
            }}
          >
            {undoLabel}
          </ToastAction>
        ),
      });
    } catch (error) {
      setItems(rollback);
      showError(error);
    } finally {
      setIsDeleting(false);
    }
  }, [setItems, toast]);

  return { run, isDeleting };
}
