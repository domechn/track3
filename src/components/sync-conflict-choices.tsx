import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { syncCategory } from "@/middlelayers/sync/config-keys";

const configConflictNames: Record<string, string> = {
  "6": "querySize", "7": "currency", "8": "quoteColor", "10": "exchanges",
  "11": "wallets", "12": "general", "20": "stockBroker", "993": "costBasis",
  "994": "assistant", "995": "blacklist", rebalance: "rebalance",
};

export function ConfigConflictChoices({ id, t, resolve, disabled = false, pending, ConfirmDialog = ConfirmDeleteDialog }: {
  id: string;
  t: (key: string, fallback?: string) => string;
  resolve: (id: string, choice: "local" | "remote") => void;
  disabled?: boolean;
  pending?: "local" | "remote";
  ConfirmDialog?: typeof ConfirmDeleteDialog;
}) {
  if (!syncCategory(id)) return null;
  const name = configConflictNames[id]
    ? t(`sync.configConflict.name.${configConflictNames[id]}`)
    : t("sync.details.config");
  return <div className="min-w-0 space-y-2 rounded-md border p-2">
    <p className="break-words font-medium">{name}</p>
    <div className="flex flex-wrap gap-2">
      {(["local", "remote"] as const).map((choice) => {
        const label = t(`sync.details.${choice}`);
        return <ConfirmDialog key={choice}
          trigger={<SyncActionButton size="sm" variant="outline" disabled={disabled} pending={pending === choice}
            pendingLabel={t("sync.pending.resolve")} className="h-auto min-h-11 whitespace-normal text-left">{label}</SyncActionButton>}
          title={t("sync.details.confirmTitle")}
          description={t(`sync.details.confirm.${choice}`)}
          cancelLabel={t("common.cancel")}
          actions={[{ label, onClick: () => resolve(id, choice) }]} />;
      })}
    </div>
  </div>;
}
