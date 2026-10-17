import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import {
  classifySyncError, validateSyncSettings, type SyncCategoryName, type SyncConnectionResult, type SyncSettings,
} from "@/middlelayers/sync/settings";

const categories: SyncCategoryName[] = ["history", "settings", "secrets", "rebalance", "chat"];
const fields = ["endpoint", "region", "bucket", "prefix", "accessKeyId", "secretAccessKey"] as const;
type Field = typeof fields[number];
const configConflictNames: Record<string, string> = {
  "6": "querySize", "7": "currency", "8": "quoteColor", "10": "exchanges",
  "11": "wallets", "12": "general", "20": "stockBroker", "993": "costBasis",
  "994": "assistant", "995": "blacklist", rebalance: "rebalance",
};

function invalidConfigurationFields(form: SyncSettings): Set<Field> {
  const invalid = new Set<Field>();
  let endpoint: URL | undefined;
  try { endpoint = new URL(form.endpoint.trim()); } catch { invalid.add("endpoint"); }
  if (endpoint && ((endpoint.protocol !== "https:" && !(endpoint.protocol === "http:" &&
    ["localhost", "127.0.0.1"].includes(endpoint.hostname))) ||
    endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
    (!form.pathStyle && (endpoint.pathname !== "/" ||
      ["localhost", "127.0.0.1"].includes(endpoint.hostname))))) invalid.add("endpoint");
  if (!form.region.trim()) invalid.add("region");
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(form.bucket.trim())) invalid.add("bucket");
  const prefix = form.prefix.trim().replace(/^\/+|\/+$/g, "");
  if (prefix && prefix.split("/").some((part) => !part || /^(?:\.|%2e){1,2}$/i.test(part))) invalid.add("prefix");
  if (!form.accessKeyId.trim()) invalid.add("accessKeyId");
  if (!form.secretAccessKey) invalid.add("secretAccessKey");
  return invalid;
}

export default function SyncSettingsPage() {
  const { t } = useTranslation();
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [form, setForm] = useState<SyncSettings>(() => syncRuntime.getSettings());
  const awaitingSettings = useRef(status.mode === "loading");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [forgetText, setForgetText] = useState("");
  const [forgetOpen, setForgetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [configurationInvalid, setConfigurationInvalid] = useState<Set<Field>>(() => new Set());
  const [devices, setDevices] = useState<Awaited<ReturnType<typeof syncRuntime.devices>>>([]);
  const [configConflicts, setConfigConflicts] = useState<Array<{ id: string }>>([]);

  useEffect(() => {
    if (awaitingSettings.current && status.mode !== "loading") {
      setForm(syncRuntime.getSettings());
      awaitingSettings.current = false;
    }
    if (status.mode === "ready" || status.mode === "locked") {
      void syncRuntime.devices().then(setDevices).catch(() => setDevices([]));
    }
  }, [status.mode]);

  useEffect(() => {
    if (status.sync.report?.devices) void syncRuntime.devices().then(setDevices).catch(() => {});
    if (status.mode === "ready") void syncRuntime.configConflicts().then(setConfigConflicts).catch(() => {});
  }, [status.mode, status.sync.report]);

  async function resolveConfigConflict(id: string, choice: "local" | "remote") {
    setBusy(true);
    try {
      await syncRuntime.resolveConfigConflict(id, choice);
      setConfigConflicts(await syncRuntime.configConflicts());
    } catch {
      setMessage(t("sync.configConflict.failed"));
    } finally {
      setBusy(false);
    }
  }

  function updateField(name: typeof fields[number], value: string) {
    setForm((current) => ({ ...current, [name]: value }));
    setConfigurationInvalid(new Set());
    setMessage(undefined);
  }

  function showResult(result: SyncConnectionResult) {
    setConfigurationInvalid(result === "configuration" ? invalidConfigurationFields(form) : new Set());
    setMessage(t(`sync.connection.${result}`));
  }

  async function testConnection() {
    if (validateSyncSettings(form)) { showResult("configuration"); return; }
    setBusy(true);
    try {
      showResult(await syncRuntime.test(form, passphrase));
    } finally {
      setBusy(false);
    }
  }

  async function enable() {
    if (validateSyncSettings(form)) { showResult("configuration"); return; }
    if (status.mode !== "ready" && status.mode !== "locked") {
      if (passphrase.length < 16) { setMessage(t("sync.passphrase.weak")); return; }
    }
    setBusy(true);
    try {
      if (status.mode !== "ready" && status.mode !== "locked" &&
          (!await syncRuntime.hasHeader(form) || confirmation) && passphrase !== confirmation) {
        setMessage(t("sync.passphrase.mismatch"));
        return;
      }
      const result = await syncRuntime.configure(form, passphrase);
      showResult(result);
      if (result === "ok") {
        setPassphrase("");
        setConfirmation("");
      }
    } catch (error) {
      showResult(classifySyncError(error));
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    try {
      const result = await syncRuntime.unlock(passphrase);
      showResult(result);
      if (result === "ok") setPassphrase("");
    } finally {
      setBusy(false);
    }
  }

  async function forget() {
    setBusy(true);
    try {
      await syncRuntime.forgetRemote();
      setMessage(t("sync.forgotten"));
      setForgetOpen(false);
      setForgetText("");
    } catch {
      setMessage(t("sync.connection.network"));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (busy) return;
    setBusy(true);
    try {
      await syncRuntime.disable();
      setMessage(undefined);
    } catch {
      setMessage(t("sync.disableFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("sync.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("sync.intro")}</p>
          {status.mode === "unreadable" && (
            <p role="alert" className="text-sm text-destructive">{t("sync.unreadable")}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field} className={field === "endpoint" ? "space-y-2 sm:col-span-2" : "space-y-2"}>
                <Label htmlFor={`sync-${field}`}>{t(`sync.field.${field}`)}</Label>
                <Input
                  id={`sync-${field}`}
                  type={field === "secretAccessKey" || field === "accessKeyId" ? "password" : "text"}
                  autoComplete="off"
                  aria-invalid={configurationInvalid.has(field)}
                  aria-describedby={configurationInvalid.has(field) && message ? "sync-settings-message" : undefined}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sync-path-style">{t("sync.pathStyle")}</Label>
            <Switch id="sync-path-style" checked={form.pathStyle}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, pathStyle: checked }))} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => void testConnection()}>{t("sync.test")}</Button>
            {status.mode === "ready" ? (
              <Button disabled={busy} onClick={() => void enable()}>{t("sync.save")}</Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("sync.passphrase.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div role="note" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 font-semibold text-destructive">
            {t("sync.passphrase.warning")}
          </div>
          {status.mode === "ready" ? (
            <p className="text-sm text-muted-foreground">{t("sync.passphrase.session")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="sync-passphrase">{t("sync.passphrase.label")}</Label>
                <Input id="sync-passphrase" type="password" autoComplete="new-password" value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)} />
              </div>
              {status.mode !== "locked" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sync-confirm">{t("sync.passphrase.confirm")}</Label>
                    <Input id="sync-confirm" type="password" autoComplete="new-password" value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {passphrase.length < 16 ? t("sync.passphrase.hint")
                      : new Set(passphrase.toLowerCase()).size < 8 || /(.)\1{4}/.test(passphrase)
                        ? t("sync.passphrase.predictable") : t("sync.passphrase.strong")}
                  </p>
                </>
              )}
              <Button disabled={busy} onClick={() => void (status.mode === "locked" ? unlock() : enable())}>
                {t(status.mode === "locked" ? "sync.unlock" : "sync.enable")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("sync.categories.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("sync.categories.deviceLocal")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((category) => (
            <div key={category} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={`sync-category-${category}`}>{t(`sync.categories.${category}`)}</Label>
                {category === "secrets" && <p className="text-xs text-muted-foreground">{t("sync.categories.secretsWarning")}</p>}
              </div>
              <Switch id={`sync-category-${category}`} checked={form.categories[category]}
                onCheckedChange={(checked) => setForm((current) => ({
                  ...current, categories: { ...current.categories, [category]: checked },
                }))} />
            </div>
          ))}
          {status.mode === "ready" && <Button variant="outline" disabled={busy} onClick={() => void enable()}>{t("sync.save")}</Button>}
        </CardContent>
      </Card>

      {status.mode === "ready" && configConflicts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sync.configConflict.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("sync.configConflict.description")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {configConflicts.map(({ id }) => (
              <div key={id} className="flex flex-wrap items-center justify-between gap-3">
                <span>{configConflictNames[id]
                  ? t(`sync.configConflict.name.${configConflictNames[id]}`)
                  : t("sync.configConflict.key").replace("{id}", id)}</span>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={busy}
                    onClick={() => void resolveConfigConflict(id, "local")}>{t("sync.configConflict.local")}</Button>
                  <Button variant="outline" disabled={busy}
                    onClick={() => void resolveConfigConflict(id, "remote")}>{t("sync.configConflict.remote")}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(status.mode !== "disabled" || !!syncRuntime.getSettings().endpoint) && (
        <Card>
          <CardHeader>
            <CardTitle>{t("sync.devices.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("sync.devices.localNames")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">{t("sync.devices.empty")}</p>}
            {devices.map((device) => (
              <div key={device.id} className="grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <Input aria-label={t("sync.devices.name").replace("{device}", device.id.slice(0, 8))}
                    defaultValue={device.name} maxLength={60}
                    onBlur={(event) => void syncRuntime.renameDevice(device.id, event.target.value)
                      .catch(() => setMessage(t("sync.devices.renameFailed")))} />
                  {device.current && <span className="text-xs text-muted-foreground">{t("sync.devices.current")}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {device.lastUpload
                    ? t("sync.devices.lastUpload").replace("{time}", new Date(device.lastUpload).toLocaleString())
                    : t("sync.devices.never")}
                </span>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {status.mode !== "disabled" && <>
                <Button disabled={busy || status.mode !== "ready"} onClick={() => void syncRuntime.syncNow()}>{t("sync.now")}</Button>
                <Button variant="outline" disabled={busy} onClick={() => void disable()}>{t("sync.disable")}</Button>
              </>}
              <ConfirmDeleteDialog
                trigger={<Button variant="destructive" disabled={busy}>{t("sync.forget")}</Button>}
                open={forgetOpen}
                onOpenChange={(open) => { setForgetOpen(open); if (!open) setForgetText(""); }}
                title={t("sync.forget")}
                description={t("sync.forgetWarning")}
                cancelLabel={t("common.cancel")}
                actions={[{ label: t("sync.forget"), disabled: forgetText !== "FORGET", onClick: () => { void forget(); } }]}
              >
                <div className="space-y-3">
                  <Label htmlFor="sync-forget-confirm">{t("sync.forgetType")}</Label>
                  <Input id="sync-forget-confirm" value={forgetText} onChange={(event) => setForgetText(event.target.value)} />
                </div>
              </ConfirmDeleteDialog>
            </div>
          </CardContent>
        </Card>
      )}
      <span role="status" className="sr-only">{busy ? t("common.loading") : ""}</span>
      {message && <p id="sync-settings-message" role="alert" className="text-sm text-foreground">{message}</p>}
    </div>
  );
}
