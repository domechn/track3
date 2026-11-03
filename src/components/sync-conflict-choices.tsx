import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { syncCategory } from "@/middlelayers/sync/config-keys";

const configConflictNames: Record<string, string> = {
  "6": "querySize", "7": "currency", "8": "quoteColor", "10": "exchanges",
  "11": "wallets", "12": "general", "20": "stockBroker", "993": "costBasis",
  "994": "assistant", "995": "blacklist", rebalance: "rebalance",
};

export function ConfigConflictChoices({ id, t, resolve, disabled = false, pending, designNames = false, remoteDeviceName, mobile = false, ConfirmDialog = ConfirmDeleteDialog }: {
  id: string;
  t: (key: string, fallback?: string) => string;
  resolve: (id: string, choice: "local" | "remote") => void;
  disabled?: boolean;
  pending?: "local" | "remote";
  designNames?: boolean;
  remoteDeviceName?: string;
  mobile?: boolean;
  ConfirmDialog?: typeof ConfirmDeleteDialog;
}) {
  if (!syncCategory(id)) return null;
  const name = mobile && id === "7" ? t("config.mobile.baseCurrency") : designNames && (id === "6" || id === "7")
    ? t(id === "6" ? "fidelity.settingsB.sync.historyCount" : "fidelity.settingsB.sync.baseCurrency")
    : configConflictNames[id]
    ? t(`sync.configConflict.name.${configConflictNames[id]}`)
    : t("sync.details.config");
  return <div className={designNames ? "t3-b-sync-conflict-row" : "min-w-0 space-y-2 rounded-md border p-2"}>
    <p className="break-words font-medium">{name}</p>
    <div className="flex flex-wrap gap-2">
      {(["local", "remote"] as const).map((choice) => {
        const label = t(`sync.details.${choice}`);
        return <ConfirmDialog key={choice}
          trigger={<SyncActionButton size="sm" variant="outline" disabled={disabled} pending={pending === choice}
            pendingLabel={t("sync.pending.resolve")} className="h-auto min-h-11 whitespace-normal text-left">{label}</SyncActionButton>}
          title={mobile ? t(choice === "remote" ? "fidelity.b.sync.useOtherQuestion" : "fidelity.b.sync.useThisQuestion") : t(designNames && choice === "remote" ? "fidelity.settingsB.sync.confirmRemoteTitle" : "sync.details.confirmTitle")}
          description={designNames && choice === "remote"
            ? t("fidelity.settingsB.sync.confirmRemoteDesc").replace("{setting}", name)
              .replace("{device}", remoteDeviceName ?? t("fidelity.settingsB.sync.otherDevice"))
            : t(`sync.details.confirm.${choice}`)}
          cancelLabel={t("common.cancel")}
          actions={[{ label, onClick: () => resolve(id, choice) }]}>
            {designNames && choice === "remote" && <ul className="t3-b-sync-dialog-bullets">
              <li>{t("fidelity.settingsB.sync.confirmRemoteBullet1")}</li>
              <li>{t("fidelity.settingsB.sync.confirmRemoteBullet2")}</li>
            </ul>}
          </ConfirmDialog>;
      })}
    </div>
  </div>;
}
