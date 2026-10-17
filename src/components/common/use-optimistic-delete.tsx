import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { recordSnapshotDeleted, recordSnapshotUndone } from "@/middlelayers/sync/delete-hook";
import { syncRuntime } from "@/middlelayers/sync/runtime";

type DeleteOptions<T, Result> = {
  update: (items: T) => T;
  rollback: (items: T) => T;
  undoUpdate?: (items: T) => T;
  commit: () => Promise<Result>;
  undo: (result: Result) => Promise<void>;
  onDeleted?: (result: Result) => void;
  onUndone?: () => void;
  successMessage: string;
  undoLabel: string;
  undoAltText: string;
  undoWindowMs: number;
  syncSnapshotUuid?: string;
};

export function useOptimisticDelete<T>(setItems: Dispatch<SetStateAction<T>>) {
  const { toast } = useToast();
  const [pendingDeletes, setPendingDeletes] = useState(0);

  const run = useCallback(async <Result,>({
    update,
    rollback,
    undoUpdate,
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
    setPendingDeletes((count) => count + 1);
    setItems(update);
    const showError = (error: unknown) => toast({
      description: error instanceof Error ? error.message : String(error),
      variant: "destructive",
    });
    try {
      const result = await commit();
      if (syncSnapshotUuid) {
        void recordSnapshotDeleted(syncSnapshotUuid).catch(showError).finally(() => syncRuntime.trigger("refresh"));
      }
      
      onDeleted?.(result);
      toast({
        description: successMessage,
        duration: undoWindowMs,
        action: (
          <ToastAction
            altText={undoAltText}
            onClick={() => {
              void undo(result)
                .then(() => {
                  setItems(undoUpdate ?? rollback);
                  onUndone?.();
                  if (syncSnapshotUuid) void recordSnapshotUndone(syncSnapshotUuid).catch(showError).finally(() => syncRuntime.trigger("refresh"));
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
      setPendingDeletes((count) => count - 1);
    }
  }, [setItems, toast]);

  return { run, isDeleting: pendingDeletes > 0 };
}
