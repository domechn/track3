import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { ToastAction } from "@/components/ui/toast";
import { CheckIcon, ResetIcon } from "@radix-ui/react-icons";
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
  successDetail?: string;
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
    successDetail,
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
      let syncTimer: ReturnType<typeof setTimeout> | undefined;
      if (syncSnapshotUuid) {
        const recorded = recordSnapshotDeleted(syncSnapshotUuid).catch(showError);
        syncTimer = setTimeout(() => {
          void recorded.finally(() => syncRuntime.trigger("refresh"));
        }, undoWindowMs);
      }
      
      onDeleted?.(result);
      toast({
        className: successDetail ? "fidelity-history-undo-toast" : undefined,
        title: successDetail ? <span className="fidelity-undo-title"><CheckIcon aria-hidden="true" />{successMessage}</span> : undefined,
        description: successDetail ?? successMessage,
        duration: undoWindowMs,
        action: (
          <ToastAction
            className={successDetail ? "fidelity-undo-action" : undefined}
            altText={undoAltText}
            onClick={() => {
              if (syncTimer) clearTimeout(syncTimer);
              void undo(result)
                .then(() => {
                  setItems(undoUpdate ?? rollback);
                  onUndone?.();
                  if (syncSnapshotUuid) void recordSnapshotUndone(syncSnapshotUuid).catch(showError).finally(() => syncRuntime.trigger("refresh"));
                })
                .catch((error) => {
                  showError(error);
                  if (syncSnapshotUuid) syncRuntime.trigger("refresh");
                });
            }}
          >
            {successDetail && <ResetIcon aria-hidden="true" />}
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
