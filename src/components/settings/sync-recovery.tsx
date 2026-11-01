import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { pickRecoveryFile, writeRecoveryFile } from "@/middlelayers/sync/recovery-file-io";

type Props = { t: (key: string) => string };

export function SyncRecoveryExport({ t }: Props) {
  const [syncPassphrase, setSyncPassphrase] = useState("");
  const [filePassphrase, setFilePassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function exportFile() {
    setError(false);
    if (filePassphrase !== confirmation) {
      setMessage(t("sync.recovery.mismatch"));
      setError(true);
      return;
    }
    if (filePassphrase.length < 16 || filePassphrase === syncPassphrase) {
      setMessage(t("sync.recovery.separate"));
      setError(true);
      return;
    }
    setBusy(true);
    try {
      const encrypted = await syncRuntime.exportRecoveryFile(syncPassphrase, filePassphrase);
      const saved = await writeRecoveryFile(encrypted, syncRuntime.getSettings().bucket);
      setMessage(saved ? t("sync.recovery.exported") : "");
      if (saved) {
        setSyncPassphrase("");
        setFilePassphrase("");
        setConfirmation("");
      }
    } catch {
      setMessage(t("sync.recovery.exportFailed"));
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <p role="note" className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-foreground">
      {t("sync.recovery.warning")}
    </p>
    <p className="text-sm text-muted-foreground">{t("sync.recovery.scope")}</p>
    <div className="space-y-2">
      <Label htmlFor="recovery-current-passphrase">{t("sync.recovery.current")}</Label>
      <Input id="recovery-current-passphrase" type="password" autoComplete="off" value={syncPassphrase}
        disabled={busy} onChange={(event) => setSyncPassphrase(event.target.value)} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="recovery-file-passphrase">{t("sync.recovery.filePassphrase")}</Label>
      <Input id="recovery-file-passphrase" type="password" autoComplete="new-password" value={filePassphrase}
        disabled={busy} onChange={(event) => setFilePassphrase(event.target.value)} />
    </div>
    <div className="space-y-2">
      <Label htmlFor="recovery-file-confirm">{t("sync.recovery.confirm")}</Label>
      <Input id="recovery-file-confirm" type="password" autoComplete="new-password" value={confirmation}
        disabled={busy} onChange={(event) => setConfirmation(event.target.value)} />
    </div>
    <Button disabled={busy} aria-busy={busy} onClick={() => void exportFile()}>{t("sync.recovery.export")}</Button>
    {message && <p role={error ? "alert" : "status"} className={error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>{message}</p>}
  </div>;
}

export function SyncRecoveryUnlock({ t }: Props) {
  const passphraseId = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<string>();
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function chooseFile() {
    setBusy(true);
    setError("");
    setFile(undefined);
    setPassphrase("");
    try {
      const selected = await pickRecoveryFile();
      if (selected) setFile(selected);
    } catch {
      setError(t("sync.recovery.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    if (!file || !passphrase) {
      setError(t("sync.recovery.enterPassphrase"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (await syncRuntime.unlockRecoveryFile(file, passphrase) !== "ok") {
        setError(t("sync.recovery.importFailed"));
      } else {
        setFile(undefined);
        setPassphrase("");
      }
    } catch {
      setError(t("sync.recovery.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-3">
    <Button variant="outline" aria-expanded={open} onClick={() => {
      setOpen(!open);
      setFile(undefined);
      setPassphrase("");
      setError("");
    }}>{t("sync.recovery.use")}</Button>
    {open && <>
      <p className="text-sm text-muted-foreground">{t("sync.recovery.useHint")}</p>
      <Button disabled={busy} aria-busy={busy} onClick={() => void chooseFile()}>{t("sync.recovery.choose")}</Button>
      {file && <>
        <div className="space-y-2">
          <Label htmlFor={passphraseId}>{t("sync.recovery.filePassphrase")}</Label>
          <Input id={passphraseId} type="password" autoComplete="off" value={passphrase}
            disabled={busy} onChange={(event) => setPassphrase(event.target.value)} />
        </div>
        <Button disabled={busy} aria-busy={busy} onClick={() => void unlock()}>{t("sync.recovery.unlock")}</Button>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </>}
  </div>;
}
