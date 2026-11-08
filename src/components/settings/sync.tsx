import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DesktopIcon, EyeClosedIcon, EyeOpenIcon, LockClosedIcon, MobileIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { ConfigConflictChoices } from "@/components/sync-conflict-choices";
import { SyncActionButton } from "@/components/settings/sync-action-button";
import { SyncRecoveryUnlock } from "@/components/settings/sync-recovery";
import { SyncStatusCard } from "@/components/settings/sync-status-card";
import { useSyncFeedback, waitForSyncResult } from "@/components/settings/use-sync-feedback";
import { useTranslation } from "@/i18n";
import { syncRuntime } from "@/middlelayers/sync/runtime";
import { useWideDesktop } from "@/components/use-wide-desktop";
import { syncCategories as categories, syncFields as fields, invalidConfigurationFields, syncFormWithField, syncFormWithCategory, syncFormWithPathStyle, type SyncField as Field } from "@/middlelayers/ui-state/config-form";
import {
  validateSyncSettings, type SyncConnectionResult, type SyncSettings,
} from "@/middlelayers/sync/settings";

export default function SyncSettingsPage() {
  const { t, locale } = useTranslation();
  const wide = useWideDesktop();
  const { toast } = useToast();
  const { busy, statusMessage, clearStatus, error, success, result, run } = useSyncFeedback(t, toast, true);
  const status = useSyncExternalStore(syncRuntime.subscribe, syncRuntime.status);
  const [form, setForm] = useState<SyncSettings>(() => syncRuntime.getSettings());
  const awaitingSettings = useRef(status.mode === "loading");
  const [passphrase, setPassphrase] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [forgetText, setForgetText] = useState("");
  const [forgetOpen, setForgetOpen] = useState(false);
  const [configurationInvalid, setConfigurationInvalid] = useState<Set<Field>>(() => new Set());
  const [unsavedFields, setUnsavedFields] = useState(false);
  const [unsavedCategories, setUnsavedCategories] = useState(false);
  const [unsavedPathStyle, setUnsavedPathStyle] = useState(false);
  const [devices, setDevices] = useState<Awaited<ReturnType<typeof syncRuntime.devices>>>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const detailsLoaded = useRef(false);
  const [editingDevice, setEditingDevice] = useState<string>();
  const [editingDeviceName, setEditingDeviceName] = useState("");
  const [configConflicts, setConfigConflicts] = useState<Array<{ id: string }>>([]);

  useEffect(() => {
    if (awaitingSettings.current && status.mode !== "loading") {
      setForm(syncRuntime.getSettings());
      awaitingSettings.current = false;
    }
  }, [status.mode]);

  useEffect(() => {
    if (status.mode !== "ready" && status.mode !== "locked") {
      detailsLoaded.current = false;
      setDevices([]);
      setConfigConflicts([]);
      setDetailsLoading(false);
      return;
    }
    let active = true;
    setDetailsLoading(wide && !detailsLoaded.current);
    void Promise.all([
      syncRuntime.devices().catch(() => []),
      status.mode === "ready" ? syncRuntime.configConflicts().catch(() => []) : Promise.resolve([]),
    ]).then(([nextDevices, nextConflicts]) => {
      if (!active) return;
      setDevices(nextDevices);
      setConfigConflicts(nextConflicts);
      detailsLoaded.current = true;
      setDetailsLoading(false);
    });
    return () => { active = false; };
  }, [status.mode, status.sync.report, wide]);

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
  function renameDevice(id: string, name: string) {
    void run(`rename-${id}`, async () => {
      await syncRuntime.renameDevice(id, name);
      setDevices((current) => current.map((item) => item.id === id
        ? { ...item, name: name.trim() || id.slice(0, 8) } : item));
      setEditingDevice(undefined);
      success(t("sync.devices.renamed"), false, "sync.toast.settingsSaved");
    }, "sync.devices.renameFailed");
  }
  function uploadTime(value: string | null | undefined) {
    if (!value) return t("sync.devices.never");
    const date = new Date(value);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const day = date.toDateString() === today.toDateString() ? t("fidelity.settingsB.sync.today")
      : date.toDateString() === yesterday.toDateString() ? t("fidelity.settingsB.sync.yesterday")
        : date.toLocaleDateString();
    return `${day}, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`;
  }

  function updateField(name: typeof fields[number], value: string) {
    setForm((current) => syncFormWithField(current, name, value));
    setUnsavedFields(true);
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
        setUnsavedFields(false);
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
          : wide ? t("fidelity.settingsB.sync.toastDescription").replace("{pushed}", String(pushed)).replace("{pulled}", String(pulled))
          : pulled === 0 ? t("sync.nowPushed").replace("{pushed}", String(pushed))
            : pushed === 0 ? t("sync.nowPulled").replace("{pulled}", String(pulled))
              : t("sync.nowSuccess").replace("{pulled}", String(pulled)).replace("{pushed}", String(pushed)),
        false, wide ? "fidelity.settingsB.sync.toastTitle" : "sync.toast.complete");
      }
    });
  }

  return (
    <div className="sync-settings-page space-y-5" data-mode={status.mode}>
      <div className="t3-settings-page-head">
        <h3>{t("settings.phase6.sync")}</h3>
        <p>{t("sync.intro")}</p>
      </div>
      {status.mode === "unreadable" && <p role="alert" className="text-sm text-muted-foreground">{t("sync.unreadable")}</p>}
      <Card className="t3-sync-connection">
        <CardHeader>
          <CardTitle>{t("settings.phase6.connection")}</CardTitle>
          {wide && status.mode === "ready" && status.sync.report && status.sync.phase !== "error" &&
            <span className="t3-tag" data-tone="positive">{t("fidelity.settingsB.ai.connected")}</span>}
          {wide && <p className="text-sm text-muted-foreground">{t("fidelity.settingsB.sync.connectionDesc")}</p>}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field} className={`${field === "endpoint" ? "space-y-2 sm:col-span-2" : "space-y-2"}${wide && field === "secretAccessKey" ? " t3-b-sync-secret-field" : ""}`}>
                <Label htmlFor={`sync-${field}`}>{t(wide && (field === "endpoint" || field === "prefix")
                  ? `fidelity.settingsB.sync.${field}` : `sync.field.${field}`)}</Label>
                <Input
                  id={`sync-${field}`}
                  type={field === "accessKeyId" || (field === "secretAccessKey" && (!wide || !revealSecret)) ? "password" : "text"}
                  autoComplete="off"
                  disabled={!!busy}
                  aria-invalid={configurationInvalid.has(field)}
                  value={form[field]}
                  onChange={(event) => updateField(field, event.target.value)}
                />
                {wide && field === "secretAccessKey" && <button type="button"
                  aria-label={t(revealSecret ? "fidelity.settingsB.sync.hideSecret" : "fidelity.settingsB.sync.showSecret")}
                  disabled={!!busy} onClick={() => setRevealSecret((current) => !current)}>
                  {revealSecret ? <EyeClosedIcon aria-hidden="true" /> : <EyeOpenIcon aria-hidden="true" />}
                </button>}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div><Label htmlFor="sync-path-style">{t(wide ? "fidelity.settingsB.sync.pathStyle" : "sync.pathStyle")}</Label>
              {wide && <p className="text-xs text-muted-foreground">{t("fidelity.settingsB.sync.pathHint")}</p>}</div>
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
            {status.mode === "ready" && (!wide || unsavedFields || unsavedPathStyle) ? (
              <SyncActionButton disabled={!!busy} pending={busy === "save"}
                pendingLabel={t("sync.pending.save")} onClick={() => void enable()}>{t("sync.save")}</SyncActionButton>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="t3-sync-top-right">
      <Card className="t3-sync-passphrase">
        <CardHeader><CardTitle>{t(wide ? "fidelity.settingsB.sync.passphrase" : "sync.passphrase.title")}</CardTitle>
          {wide && status.mode === "ready" && <span className="t3-tag" data-tone="positive">{t("fidelity.settingsB.sync.unlocked")}</span>}
          {wide && <p className="text-sm text-muted-foreground">{t(status.mode === "locked" ? "fidelity.settingsB.sync.lockedDesc" : "fidelity.settingsB.sync.passphraseDesc")}</p>}</CardHeader>
        <CardContent className="space-y-4">
          {wide && status.mode === "ready" ? <div className="t3-b-sync-ready-passphrase">
            <dl className="t3-b-dl">
              <dt>{t("fidelity.settingsB.sync.setOn")}</dt><dd>—</dd>
              <dt>{t("fidelity.settingsB.sync.unlocked")}</dt><dd>{t("fidelity.settingsB.sync.untilQuit")}</dd>
              <dt>{t("fidelity.settingsB.sync.encryption")}</dt><dd>{t("fidelity.settingsB.sync.keyDerived")}</dd>
              <dt>{t("fidelity.settingsB.sync.remoteSees")}</dt><dd>{t("fidelity.settingsB.sync.ciphertext")}</dd>
            </dl>
            <div className="t3-b-sync-restart"><LockClosedIcon aria-hidden="true" /><div><b>{t("fidelity.settingsB.sync.askedAgain")}</b><small>{t("fidelity.settingsB.sync.keptMemory")}</small></div></div>
            <div className="t3-b-banner warning"><span>⚠</span><div><b>{t("fidelity.settingsB.sync.warningTitle")}</b><span>{t("fidelity.settingsB.sync.warningFull")}</span></div></div>
          </div> : <>
          <div role="note" className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 font-semibold text-destructive dark:border-red-400 dark:text-red-300">
            {t(status.mode === "ready" || status.mode === "locked" ? "sync.recovery.passphraseWarning" : "sync.passphrase.warning")}
          </div>
          {status.mode === "ready" ? (
            <p className="text-sm text-muted-foreground">{t("sync.recovery.session")}</p>
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
              {status.mode === "locked" && <SyncRecoveryUnlock t={t} />}
            </>
          )}
          </>}
        </CardContent>
      </Card>
      <SyncStatusCard status={status} busy={busy} onSyncNow={() => { void syncNow(); }} t={t} locale={locale} />
      </div>

      <Card className="t3-sync-categories">
        <CardHeader>
          <CardTitle>{t("sync.categories.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t(wide ? "fidelity.settingsB.sync.categoriesDesc" : "sync.categories.deviceLocal")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="t3-sync-category-grid">
          {categories.map((category) => (
            <div key={category} className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor={`sync-category-${category}`}>{t(wide && category === "history" ? "fidelity.settingsB.sync.history" : `sync.categories.${category}`)}</Label>
                <p className={`t3-b-sync-category-description${category === "secrets" ? " secret" : ""}`}>
                    {category === "secrets" && <LockClosedIcon aria-hidden="true" />}
                    {t(`fidelity.settingsB.sync.category.${category}.description`)}
                  </p>
              </div>
              <Switch id={`sync-category-${category}`} checked={form.categories[category]} disabled={!!busy}
                onCheckedChange={(checked) => {
                  setForm((current) => syncFormWithCategory(current, category, checked));
                  setUnsavedCategories(true);
                }} />
            </div>
          ))}
          </div>
          {unsavedCategories && <p role="status" className="text-sm text-muted-foreground">{t("sync.categories.unsaved")}</p>}
          {status.mode === "ready" && (!wide || unsavedCategories) && <SyncActionButton variant="outline" disabled={!!busy}
            pending={busy === "save"} pendingLabel={t("sync.pending.save")}
            onClick={() => void enable()}>{t("sync.save")}</SyncActionButton>}
          {wide && <div className="t3-b-sync-local-note"><MobileIcon aria-hidden="true" /><div><b>{t("fidelity.settingsB.sync.deviceLocal")}</b><small>{t("fidelity.settingsB.sync.localNote")}</small></div></div>}
        </CardContent>
      </Card>

      {((status.mode === "ready" && configConflicts.length > 0)
        || (wide && (status.mode === "ready" || status.mode === "locked"))) && (
        <Card className="t3-sync-conflicts">
          <CardHeader>
            <CardTitle>{t(wide ? "fidelity.settingsB.sync.conflictsTitle" : "sync.configConflict.title")}
              {wide && configConflicts.length > 0 && <span className="t3-tag t3-b-sync-conflict-count" data-tone="warning">
                {t("fidelity.settingsB.sync.conflictsCount").replace("{count}", String(configConflicts.length))}
              </span>}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{t(wide ? "fidelity.settingsB.sync.conflictsDesc" : "sync.configConflict.description")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {detailsLoading && wide ? Array.from({ length: 3 }, (_, index) =>
              <div className="t3-b-sync-skeleton-row" key={index} aria-hidden="true">
                <i className="t3-b-sync-skeleton" /><i className="t3-b-sync-skeleton secondary" /><i className="t3-b-sync-skeleton switch" />
              </div>) : configConflicts.length === 0 && <p className="text-sm text-muted-foreground">{t("fidelity.settingsB.sync.noConflicts")}</p>}
            {!detailsLoading && (wide
              ? [...configConflicts].sort((a, b) => Number(b.id === "7") - Number(a.id === "7"))
              : configConflicts).map(({ id }) => <ConfigConflictChoices key={id} id={id} t={t}
              designNames={wide}
              remoteDeviceName={devices.filter((device) => !device.current).length === 1
                ? devices.find((device) => !device.current)?.name : undefined}
              disabled={!!busy} pending={busy === `conflict-${id}-local` ? "local" : busy === `conflict-${id}-remote` ? "remote" : undefined}
              resolve={(key, choice) => { void resolveConfigConflict(key, choice); }} />)}
          </CardContent>
        </Card>
      )}

      {(status.mode !== "disabled" || !!syncRuntime.getSettings().endpoint) && (
        <Card className="t3-sync-devices">
          <CardHeader>
            <CardTitle>{t("sync.devices.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(wide ? "fidelity.settingsB.sync.devicesDesc" : "sync.devices.localNames")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {wide && devices.length > 0 && <div className="t3-b-sync-device-head">
              <span>{t("fidelity.settingsB.sync.deviceColumn")}</span>
              <span>{t("fidelity.settingsB.sync.lastUpload")}</span>
              <span />
            </div>}
            {detailsLoading && wide ? Array.from({ length: 2 }, (_, index) =>
              <div className="t3-b-sync-skeleton-row" key={index} aria-hidden="true">
                <i className="t3-b-sync-skeleton" /><i className="t3-b-sync-skeleton secondary" /><i className="t3-b-sync-skeleton switch" />
              </div>) : devices.length === 0 && <p className="text-sm text-muted-foreground">{t("sync.devices.empty")}</p>}
            {!detailsLoading && devices.map((device) => (
              <div key={device.id} className="sync-device-row grid items-center gap-2 sm:grid-cols-[1fr_auto]">
                {wide ? <>
                  <div className="t3-b-device-identity">
                    <DesktopIcon aria-hidden="true" />
                    {editingDevice === device.id ? <Input autoFocus aria-label={t("sync.devices.name").replace("{device}", device.id.slice(0, 8))}
                      value={editingDeviceName} maxLength={60} disabled={!!busy}
                      onChange={(event) => setEditingDeviceName(event.target.value)}
                      onKeyDown={(event) => { if (event.key === "Enter") renameDevice(device.id, editingDeviceName); if (event.key === "Escape") setEditingDevice(undefined); }} />
                      : <b>{device.name}</b>}
                    {device.current && <span className="t3-tag" data-tone="accent">{t("sync.devices.current")}</span>}
                  </div>
                  <span className="sync-device-last-upload text-xs text-muted-foreground">{uploadTime(device.lastUpload)}</span>
                  {editingDevice === device.id
                    ? <button className="t3-b-button small" disabled={!!busy} onClick={() => renameDevice(device.id, editingDeviceName)}>{t("fidelity.settingsB.sync.saveName")}</button>
                    : <button className="t3-b-device-edit" aria-label={t("fidelity.settingsB.sync.renameDevice").replace("{name}", device.name)}
                      disabled={!!busy} onClick={() => { setEditingDevice(device.id); setEditingDeviceName(device.name); }}><Pencil1Icon /></button>}
                </> : <>
                <div className="space-y-1">
                  <Input aria-label={t("sync.devices.name").replace("{device}", device.id.slice(0, 8))}
                    defaultValue={device.name} maxLength={60} disabled={!!busy}
                    onBlur={(event) => {
                      if (event.target.value === device.name) return;
                      renameDevice(device.id, event.target.value);
                    }} />
                  {device.current && <span className="text-xs text-muted-foreground">{t("sync.devices.current")}</span>}
                </div>
                <span className="sync-device-last-upload text-xs text-muted-foreground">
                  {device.lastUpload
                    ? t("sync.devices.lastUpload").replace("{time}", new Date(device.lastUpload).toLocaleString())
                    : t("sync.devices.never")}
                </span>
                </>}
              </div>
            ))}
            <div className="sync-device-actions flex flex-wrap gap-2 pt-2">
              {status.mode !== "disabled" && <>
                {wide ? <ConfirmDeleteDialog
                  trigger={<SyncActionButton variant="outline" disabled={!!busy} pending={false}
                    pendingLabel={t("sync.pending.disable")}>{t("sync.disable")}</SyncActionButton>}
                  title={t("fidelity.settingsB.sync.disableTitle")}
                  description={t("fidelity.settingsB.sync.disableDesignDesc")}
                  cancelLabel={t("common.cancel")}
                  actions={[{ label: t("sync.disable"), pending: busy === "disable", disabled: !!busy,
                    onClick: () => { void disable(); } }]}>
                    <ul className="t3-b-sync-dialog-bullets">
                      <li>{t("fidelity.settingsB.sync.disableBullet1")}</li>
                      <li>{t("fidelity.settingsB.sync.disableBullet2")}</li>
                    </ul>
                  </ConfirmDeleteDialog>
                  : <SyncActionButton variant="outline" disabled={!!busy} pending={busy === "disable"}
                    pendingLabel={t("sync.pending.disable")} onClick={() => void disable()}>{t("sync.disable")}</SyncActionButton>}
              </>}
              <ConfirmDeleteDialog
                trigger={<Button variant="outline" className={wide ? "t3-b-sync-forget" : ""} disabled={!!busy}>{t("sync.forget")}</Button>}
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
            {wide && status.mode !== "disabled" && <p className="t3-b-sync-devices-footer">
              {t("fidelity.settingsB.sync.devicesFooter").replace("{prefix}", form.prefix).replace("{bucket}", form.bucket)}
            </p>}
          </CardContent>
        </Card>
      )}
      {statusMessage && <p role="status" className="text-sm text-foreground">{statusMessage}</p>}
    </div>
  );
}
