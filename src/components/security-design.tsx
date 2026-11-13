import { useEffect, useState } from "react";
import { CheckIcon, ExclamationTriangleIcon, LockClosedIcon, ReloadIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncRecoveryExport } from "@/components/settings/sync-recovery";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  syncReady: boolean;
  encKeyInput: string;
  setEncKeyInput: (value: string) => void;
  encKeyConfirm: string;
  setEncKeyConfirm: (value: string) => void;
  encKeySaving: boolean;
  keyRotated: boolean;
  customKey: boolean | undefined;
  secretInventory?: { exchanges: string[]; brokers: string[]; assistant?: string; sync?: string };
  onRotate: () => void;
  onReset: () => void;
};

export function SecurityDesign(p: Props) {
  const { t } = useTranslation();
  const [rotateOpen, setRotateOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  useEffect(() => {
    if (p.keyRotated && !p.encKeySaving) setRotateOpen(false);
  }, [p.keyRotated, p.encKeySaving]);
  return <div className="t3-b-security t3-b-grid">
    {p.keyRotated && <div className="t3-b-banner positive"><CheckIcon /><div><b>{t("fidelity.settingsB.security.rotated")}</b><span>{t("fidelity.settingsB.security.rotatedDesc")}</span></div></div>}
    <section className="t3-b-card t3-b-security-key">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.security.key")}</h3><p>{t("fidelity.settingsB.security.keyDesc")}</p><p>{t("data.encryption.key.sharedDefault")}</p></div>
        {p.customKey !== undefined && <span className={`t3-b-pill ${p.customKey ? "connected" : "testing"}`}>{t(p.customKey ? "data.encryption.key.customStatus" : "data.encryption.key.defaultStatus")}</span>}</div>
      <div className="t3-b-kpis">
        <div><small>{t("fidelity.settingsB.security.keyId")}</small><strong>—</strong></div>
        <div><small>{t("fidelity.settingsB.security.created")}</small><strong>—</strong></div>
        <div><small>{t("fidelity.settingsB.security.lastRotated")}</small><strong>—</strong></div>
      </div>
      <div className="t3-b-security-list">
        {([
          ["exchanges", "exchangeKeys", p.secretInventory?.exchanges.join(", "), p.secretInventory?.exchanges.length],
          ["brokers", "brokerTokens", p.secretInventory?.brokers.join(", "), p.secretInventory?.brokers.length],
          ["assistant", "assistantKey", p.secretInventory?.assistant, p.secretInventory?.assistant ? 1 : 0],
          ["sync", "syncSecret", p.secretInventory?.sync, p.secretInventory?.sync ? 1 : 0],
        ] as const).map(([kind, key, detail, count]) => <div key={kind}>
          <span><b>{t(`fidelity.settingsB.security.${key}`)}</b><small>{detail || t("fidelity.settingsB.security.notConfigured")}</small></span>
          <small>{count === undefined ? "—" : `${count} ${t(count === 1 ? "fidelity.settingsB.security.secret" : "fidelity.settingsB.security.secrets")}`}</small>
        </div>)}
      </div>
      <div className="t3-b-security-foot">
        <button className="t3-b-button" onClick={() => setRotateOpen(true)} disabled={p.encKeySaving}>
          {p.encKeySaving ? <ReloadIcon className="animate-spin" /> : <ReloadIcon />}
          {t(p.encKeySaving ? "data.encryption.key.saving" : "fidelity.settingsB.security.rotate")}</button>
        {p.customKey && <button className="t3-b-button small" onClick={p.onReset} disabled={p.encKeySaving}>{t("data.encryption.key.remove")}</button>}
        <small>{t("fidelity.settingsB.security.rotateHint")}</small>
      </div>
      <ConfirmDeleteDialog open={rotateOpen} onOpenChange={setRotateOpen}
        title={t("fidelity.settingsB.security.rotateTitle")} description={t("data.encryption.key.storageWarning")}
        cancelLabel={t("common.cancel")}
        actions={[{ label: t("fidelity.settingsB.security.rotateAction"), onClick: p.onRotate, keepOpen: true, disabled: p.encKeySaving }]}>
        <div className="t3-b-rotate-form">
          <label htmlFor="security-new-key">{t("data.encryption.key.newPlaceholder")}</label>
          <input id="security-new-key" className="t3-b-input" type="password" autoComplete="new-password" value={p.encKeyInput} onChange={(event) => p.setEncKeyInput(event.target.value)} />
          <label htmlFor="security-confirm-key">{t("data.encryption.key.confirmPlaceholder")}</label>
          <input id="security-confirm-key" className="t3-b-input" type="password" autoComplete="new-password" value={p.encKeyConfirm} onChange={(event) => p.setEncKeyConfirm(event.target.value)} />
        </div>
      </ConfirmDeleteDialog>
    </section>
    <section className="t3-b-card t3-b-security-recovery">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.security.recovery")}</h3><p>{t("fidelity.settingsB.security.recoveryDesc")}</p></div></div>
      <div className="t3-b-banner warning"><ExclamationTriangleIcon /><div><b>{t("fidelity.settingsB.security.recoveryWarning")}</b>
        <span>{t("fidelity.settingsB.security.recoveryWarningDesc")}</span></div></div>
      <dl className="t3-b-dl">
        <dt>{t("fidelity.settingsB.security.recoveryKey")}</dt><dd>—</dd>
        <dt>{t("fidelity.settingsB.security.storedIn")}</dt><dd>{t("fidelity.settingsB.security.syncBucket")}</dd>
        <dt>{t("fidelity.settingsB.security.covers")}</dt><dd>{t("fidelity.settingsB.security.syncData")}</dd>
        <dt>{t("fidelity.settingsB.security.format")}</dt><dd>{t("fidelity.settingsB.security.fileFormat")}</dd>
      </dl>
      <div className="t3-b-recovery-actions"><button className="t3-b-button small" onClick={() => setRecoveryOpen(true)} disabled={!p.syncReady}>{t("fidelity.settingsB.security.exportFile")}</button>
        {!p.syncReady && <small>{t("fidelity.settingsB.security.syncNotReadyDesc")}</small>}</div>
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}><DialogContent><DialogHeader><DialogTitle>{t("fidelity.settingsB.security.exportFile")}</DialogTitle></DialogHeader><SyncRecoveryExport t={t} /></DialogContent></Dialog>
    </section>
    <section className="t3-b-card t3-b-security-lock">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.security.appLock")}</h3><p>{t("fidelity.settingsB.security.iOSOnly")}</p></div>
        <span className="t3-b-pill testing">iOS</span></div>
      <div className="t3-b-notice"><LockClosedIcon /><b>{t("fidelity.settingsB.security.unavailableDesktop")}</b>
        {t("fidelity.settingsB.security.unavailableDesktopDesc")}</div>
    </section>
    <section className="t3-b-card t3-b-security-preview">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.security.lockScreen")}</h3><p>{t("fidelity.settingsB.security.lockScreenDesc")}</p></div></div>
      <div className="t3-b-notice"><LockClosedIcon /><b>{t("fidelity.settingsB.security.unavailableDesktop")}</b>
        {t("fidelity.settingsB.security.lockPreviewDesc")}</div>
    </section>
  </div>;
}
