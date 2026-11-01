import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { useSyncFeedback, waitForSyncResult } from "@/components/settings/use-sync-feedback";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { syncCategories as categories, syncFields as fields, configConflictNames, invalidConfigurationFields, syncFormWithField, syncFormWithCategory, syncFormWithPathStyle, type SyncField as Field } from "@/middlelayers/ui-state/config-form";
import {
  validateSyncSettings, type SyncConnectionResult, type SyncSettings,
} from "@/middlelayers/sync/settings";

export default function SyncSettingsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { busy, statusMessage, clearStatus, error, success, result, run } = useSyncFeedback(t, toast);
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [form, setForm] = useState<SyncSettings>(() => syncRuntime.getSettings());
  const awaitingSettings = useRef(status.mode === "loading");
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [forgetText, setForgetText] = useState("");
  const [forgetOpen, setForgetOpen] = useState(false);
  const [configurationInvalid, setConfigurationInvalid] = useState<Set<Field>>(() => new Set());
  const [unsavedCategories, setUnsavedCategories] = useState(false);
  const [unsavedPathStyle, setUnsavedPathStyle] = useState(false);
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

  useEffect(() => {
    if (status.mode === "unreadable") error(t("sync.unreadable"));
  }, [status.mode]);

  useEffect(() => {
    if (!busy || !window.matchMedia("(max-width: 900px)").matches) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector(".sync-settings-page button[aria-busy=true]")?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [busy]);

  async function resolveConfigConflict(id: string, choice: "local" | "remote") {
    await run(`conflict-${id}-${choice}`, async () => {
      await syncRuntime.resolveConfigConflict(id, choice);
      setConfigConflicts(await syncRuntime.configConflicts());
      success(t("sync.configConflict.resolved"), false, "sync.toast.resolved");
    }, "sync.configConflict.failed");
  }

  function updateField(name: typeof fields[number], value: string) {
    setForm((current) => syncFormWithField(current, name, value));
    setConfigurationInvalid(new Set());
    clearStatus();
  }

  function showResult(outcome: SyncConnectionResult, successText: string, titleKey: string) {
    setConfigurationInvalid(outcome === "configuration" ? invalidConfigurationFields(form) : new Set());
    result(outcome, successText, true, titleKey);
  }

  function showConfigurationError(titleKey?: string) {
    setConfigurationInvalid(invalidConfigurationFields(form));
    error(t("sync.connection.configuration"), titleKey);
  }

  async function testConnection() {
    if (validateSyncSettings(form)) { showConfigurationError("sync.toast.connectionFailed"); return; }
    await run("test", async () => {
      showResult(await syncRuntime.test(form, passphrase), t("sync.connection.ok"), "sync.toast.connectionOk");
    });
  }

  async function enable() {
    if (validateSyncSettings(form)) { showConfigurationError(); return; }
    if (status.mode !== "ready" && status.mode !== "locked") {
      if (passphrase.length < 16) { error(t("sync.passphrase.weak")); return; }
    }
    await run("save", async () => {
      if (status.mode !== "ready" && status.mode !== "locked" &&
          (!await syncRuntime.hasHeader(form) || confirmation) && passphrase !== confirmation) {
        error(t("sync.passphrase.mismatch"));
        return;
      }
      const outcome = await syncRuntime.configure(form, passphrase);
      showResult(outcome, t(status.mode === "ready" ? "sync.settingsSaved" : "sync.enabled"),
        status.mode === "ready" ? "sync.toast.settingsSaved" : "sync.toast.enabled");
      if (outcome === "ok") {
        setPassphrase("");
        setConfirmation("");
        setUnsavedCategories(false);
        setUnsavedPathStyle(false);
      }
    });
  }

  async function unlock() {
    await run("unlock", async () => {
      const outcome = await syncRuntime.unlock(passphrase);
      showResult(outcome, t("sync.unlocked"), "sync.toast.unlocked");
      if (outcome === "ok") setPassphrase("");
    });
  }

  async function forget() {
    await run("forget", async () => {
      await syncRuntime.forgetRemote();
      success(t("sync.forgotten"), true, "sync.toast.forgotten");
      setForgetOpen(false);
      setForgetText("");
    }, "sync.connection.network");
  }

  async function disable() {
    await run("disable", async () => {
      await syncRuntime.disable();
      success(t("sync.disabled"), false, "sync.toast.disabled");
    }, "sync.disableFailed");
  }

  async function syncNow() {
    await run("now", async () => {
      await syncRuntime.syncNow();
      await waitForSyncResult();
      const latest = syncRuntime.status().sync;
      if (latest.phase === "error") {
        error(t(latest.error === "sync" || !latest.error
          ? "sync.status.errorsPresent" : `sync.connection.${latest.error}`));
      } else if (latest.phase === "idle") {
        const pulled = latest.report?.pulled ?? 0;
        const pushed = latest.report?.pushed ?? 0;
        success(pulled === 0 && pushed === 0 ? t("sync.nowUpToDate")
          : pulled === 0 ? t("sync.nowPushed").replace("{pushed}", String(pushed))
          : pushed === 0 ? t("sync.nowPulled").replace("{pulled}", String(pulled))
          : t("sync.nowSuccess").replace("{pulled}", String(pulled)).replace("{pushed}", String(pushed)),
        false, "sync.toast.complete");
      }
    });
  }

  return (
    <div className="sync-settings-page space-y-5">
      <div className="t3-settings-page-head">
        <h3>{t("settings.phase6.sync")}</h3>
        <p>{t("sync.intro")}</p>
      </div>
      {status.mode === "unreadable" && <p role="alert" className="text-sm text-muted-foreground">{t("sync.unreadable")}</p>}
      <Card className="t3-sync-connection">
        <CardHeader>
          <CardTitle>{t("settings.phase6.connection")}</CardTitle>
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
                  disabled={!!busy}
                  aria-invalid={configurationInvalid.has(field)}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="sync-path-style">{t("sync.pathStyle")}</Label>
            <Switch id="sync-path-style" checked={form.pathStyle} disabled={!!busy}
              onCheckedChange={(checked) => {
                setForm((current) => syncFormWithPathStyle(current, checked));
                setUnsavedPathStyle(true);
              }} />
          </div>
          {unsavedPathStyle && <p role="status" className="text-sm text-muted-foreground">{t("sync.categories.unsaved")}</p>}
          <div className="flex flex-wrap gap-2">
            <SyncActionButton variant="outline" disabled={!!busy} pending={busy === "test"}
              pendingLabel={t("sync.pending.test")} onClick={() => void testConnection()}>{t("sync.test")}</SyncActionButton>
            {status.mode === "ready" ? (
              <SyncActionButton disabled={!!busy} pending={busy === "save"}
                pendingLabel={t("sync.pending.save")} onClick={() => void enable()}>{t("sync.save")}</SyncActionButton>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="t3-sync-passphrase">
        <CardHeader><CardTitle>{t("sync.passphrase.title")}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div role="note" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 font-semibold text-destructive dark:border-red-400 dark:text-red-300">
            {t("sync.passphrase.warning")}
          </div>
          {status.mode === "ready" ? (
            <p className="text-sm text-muted-foreground">{t("sync.passphrase.session")}</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="sync-passphrase">{t("sync.passphrase.label")}</Label>
                <Input id="sync-passphrase" type="password" autoComplete="new-password" value={passphrase} disabled={!!busy}
                  onChange={(event) => setPassphrase(event.target.value)} />
              </div>
              {status.mode !== "locked" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="sync-confirm">{t("sync.passphrase.confirm")}</Label>
                    <Input id="sync-confirm" type="password" autoComplete="new-password" value={confirmation} disabled={!!busy}
                      onChange={(event) => setConfirmation(event.target.value)} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {passphrase.length < 16 ? t("sync.passphrase.hint")
                      : new Set(passphrase.toLowerCase()).size < 8 || /(.)\1{4}/.test(passphrase)
                        ? t("sync.passphrase.predictable") : t("sync.passphrase.strong")}
                  </p>
                </>
              )}
              <SyncActionButton disabled={!!busy} pending={busy === (status.mode === "locked" ? "unlock" : "save")}
                pendingLabel={t(status.mode === "locked" ? "sync.pending.unlock" : "sync.pending.enable")}
                onClick={() => void (status.mode === "locked" ? unlock() : enable())}>
                {t(status.mode === "locked" ? "sync.unlock" : "sync.enable")}
              </SyncActionButton>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="t3-sync-categories">
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
              <Switch id={`sync-category-${category}`} checked={form.categories[category]} disabled={!!busy}
                onCheckedChange={(checked) => {
                  setForm((current) => syncFormWithCategory(current, category, checked));
                  setUnsavedCategories(true);
                }} />
            </div>
          ))}
          {unsavedCategories && <p role="status" className="text-sm text-muted-foreground">{t("sync.categories.unsaved")}</p>}
          {status.mode === "ready" && <SyncActionButton variant="outline" disabled={!!busy}
            pending={busy === "save"} pendingLabel={t("sync.pending.save")}
            onClick={() => void enable()}>{t("sync.save")}</SyncActionButton>}
        </CardContent>
      </Card>

      {status.mode === "ready" && configConflicts.length > 0 && (
        <Card className="t3-sync-conflicts">
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
                  <SyncActionButton variant="outline" disabled={!!busy} pending={busy === `conflict-${id}-local`}
                    pendingLabel={t("sync.pending.resolve")}
                    onClick={() => void resolveConfigConflict(id, "local")}>{t("sync.configConflict.local")}</SyncActionButton>
                  <SyncActionButton variant="outline" disabled={!!busy} pending={busy === `conflict-${id}-remote`}
                    pendingLabel={t("sync.pending.resolve")}
                    onClick={() => void resolveConfigConflict(id, "remote")}>{t("sync.configConflict.remote")}</SyncActionButton>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(status.mode !== "disabled" || !!syncRuntime.getSettings().endpoint) && (
        <Card className="t3-sync-devices">
          <CardHeader>
            <CardTitle>{t("sync.devices.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("sync.devices.localNames")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {devices.length === 0 && <p className="text-sm text-muted-foreground">{t("sync.devices.empty")}</p>}
            {devices.map((device) => (
              <div key={device.id} className="sync-device-row grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1">
                  <Input aria-label={t("sync.devices.name").replace("{device}", device.id.slice(0, 8))}
                    defaultValue={device.name} maxLength={60} disabled={!!busy}
                    onBlur={(event) => {
                      if (event.target.value === device.name) return;
                      const name = event.target.value;
                      void run(`rename-${device.id}`, async () => {
                        await syncRuntime.renameDevice(device.id, name);
                        setDevices((current) => current.map((item) => item.id === device.id
                          ? { ...item, name: name.trim() || device.id.slice(0, 8) } : item));
                        success(t("sync.devices.renamed"), false, "sync.toast.settingsSaved");
                      }, "sync.devices.renameFailed");
                    }} />
                  {device.current && <span className="text-xs text-muted-foreground">{t("sync.devices.current")}</span>}
                </div>
                <span className="sync-device-last-upload text-xs text-muted-foreground">
                  {device.lastUpload
                    ? t("sync.devices.lastUpload").replace("{time}", new Date(device.lastUpload).toLocaleString())
                    : t("sync.devices.never")}
                </span>
              </div>
            ))}
            <div className="sync-device-actions flex flex-wrap gap-2 pt-2">
              {status.mode !== "disabled" && <>
                <SyncActionButton disabled={!!busy || status.mode !== "ready"} pending={busy === "now"}
                  pendingLabel={t("sync.pending.now")} onClick={() => void syncNow()}>{t("sync.now")}</SyncActionButton>
                <SyncActionButton variant="outline" disabled={!!busy} pending={busy === "disable"}
                  pendingLabel={t("sync.pending.disable")} onClick={() => void disable()}>{t("sync.disable")}</SyncActionButton>
              </>}
              <ConfirmDeleteDialog
                trigger={<Button variant="destructive" disabled={!!busy}>{t("sync.forget")}</Button>}
                open={forgetOpen}
                onOpenChange={(open) => { setForgetOpen(open); if (!open) setForgetText(""); }}
                title={t("sync.forget")}
                description={t("sync.forgetWarning")}
                cancelLabel={t("common.cancel")}
                actions={[{ label: busy === "forget" ? t("sync.pending.forget") : t("sync.forget"),
                  disabled: forgetText !== "FORGET" || !!busy, pending: busy === "forget",
                  keepOpen: true, onClick: () => { void forget(); } }]}
              >
                <div className="space-y-3">
                  <Label htmlFor="sync-forget-confirm">{t("sync.forgetType")}</Label>
                  <Input id="sync-forget-confirm" value={forgetText} disabled={!!busy}
                    onChange={(event) => setForgetText(event.target.value)} />
                </div>
              </ConfirmDeleteDialog>
            </div>
          </CardContent>
        </Card>
      )}
      {statusMessage && <p role="status" className="text-sm text-foreground">{statusMessage}</p>}
    </div>
  );
}
