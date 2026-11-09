import { useEffect, useState } from "react";
import { CheckIcon, ExternalLinkIcon, InfoCircledIcon, ReloadIcon } from "@radix-ui/react-icons";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { appDataDir } from "@tauri-apps/api/path";
import { openExternal } from "@/lib/external-links";
import { useTranslation } from "@/i18n";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { requestOnboardingReplay } from "@/middlelayers/onboarding";
import packageJson from "../../package.json";
import { TrackLogo } from "@/components/brand/track-logo";
import ReleaseNotes from "@/components/release-notes";
import { updateDownloadEvent } from "@/components/auto-updater";

type Props = { version: string };

export function AboutDesign({ version }: Props) {
  const { t, locale } = useTranslation();
  const [dataFolder, setDataFolder] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"none" | "current" | "available" | "error">("none");
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => { void appDataDir().then(setDataFolder).catch(() => setDataFolder(undefined)); }, []);
  const checkForUpdates = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const result = await check({ timeout: 15_000 });
      setUpdate(result);
      setCheckResult(result ? "available" : "current");
      setUpdateOpen(!!result);
      if (!result) toast({ title: t("fidelity.settingsB.about.upToDate"), tone: "success",
        description: t("fidelity.settingsB.about.upToDateDetail").replace("{version}", version) });
    } catch {
      setCheckResult("error");
    } finally {
      setChecking(false);
    }
  };
  const install = () => {
    if (!update) return;
    setUpdateOpen(false);
    setCheckResult("none");
    setUpdate(null);
    window.dispatchEvent(new CustomEvent(updateDownloadEvent, { detail: update }));
  };
  const platform = navigator.platform || "—";
  const releaseDate = update?.date && Number.isFinite(Date.parse(update.date))
    ? new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(update.date))
    : undefined;
  return <div className="t3-b-about t3-b-grid">
    {checkResult === "available" && !updateOpen && <div className="t3-b-banner info"><InfoCircledIcon /><div><b>{t("fidelity.settingsB.about.updateAvailable").replace("{version}", update?.version ?? "")}</b>
      <span>{t("fidelity.settingsB.about.updateAvailableDesc").replace("{current}", version)}</span></div>
      <button className="t3-b-button small primary" onClick={() => setUpdateOpen(true)}>{t("fidelity.settingsB.about.viewUpdate")}</button></div>}
    <section className="t3-b-card t3-b-about-app">
      <div className="t3-b-about-brand"><TrackLogo size={56} decorative /><div><b>Track3</b><span>{t("fidelity.settingsB.about.version")} {version} · {t("fidelity.settingsB.about.stable")}</span></div></div>
      <dl className="t3-b-dl">
        <dt>{t("fidelity.settingsB.about.version")}</dt><dd>{version}</dd>
        <dt>{t("fidelity.settingsB.about.platform")}</dt><dd>{platform}</dd>
        <dt>{t("fidelity.settingsB.about.database")}</dt><dd>SQLite</dd>
        <dt>{t("fidelity.settingsB.about.dataFolder")}</dt><dd className="mono">{dataFolder || "—"}</dd>
      </dl>
      <div className="t3-b-about-check"><button className="t3-b-button" data-testid="about-check-updates" onClick={() => { void checkForUpdates(); }} disabled={checking}>
        {checking ? <ReloadIcon className="animate-spin" /> : <ReloadIcon />}{t(checking ? "fidelity.settingsB.about.checking" : "fidelity.settingsB.about.check")}</button>
        <span className={`t3-b-result ${checkResult === "error" ? "negative" : checkResult === "current" ? "positive" : ""}`}>
          {checkResult === "current" && <CheckIcon />}{t(`fidelity.settingsB.about.status.${checking ? "checking" : checkResult}`)}</span></div>
    </section>
    <section className="t3-b-card t3-b-about-help">
      <div className="t3-b-card-head"><h3>{t("fidelity.settingsB.about.help")}</h3></div>
      <div className="t3-b-about-link-row"><div><b>{t("fidelity.settingsB.about.guide")}</b><small>{t("fidelity.settingsB.about.guideDesc")}</small></div>
        <button className="t3-b-button small" data-testid="onboarding-replay" onClick={() => setGuideOpen(true)}>{t("fidelity.settingsB.about.replay")}</button></div>
      {([
        ["docs", "track3.dev/docs/"],
        ["website", "track3.dev"],
        ["github", "github.com/domechn/track3"],
      ] as const).map(([key, label]) => <button className="t3-b-about-link-row link" key={key} onClick={() => { void openExternal(key); }}>
        <div><b>{t(`fidelity.settingsB.about.${key}`)}</b><small>{label}</small></div><ExternalLinkIcon /></button>)}
    </section>
    <section className="t3-b-card t3-b-about-licenses">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.about.openSource")}</h3><p>{t("fidelity.settingsB.about.openSourceDesc")}</p></div>
        <span className="t3-b-about-package-count">{t("fidelity.settingsB.about.packagesShown").replace("{count}", "5")}</span></div>
      <div className="t3-b-about-license-head"><span>{t("fidelity.settingsB.about.package")}</span><span>{t("fidelity.settingsB.about.version")}</span><span>{t("fidelity.settingsB.about.license")}</span></div>
      {([
        ["React", packageJson.dependencies.react, "MIT"],
        ["Tauri API", packageJson.dependencies["@tauri-apps/api"], "MIT / Apache-2.0"],
        ["Radix UI icons", packageJson.dependencies["@radix-ui/react-icons"], "MIT"],
        ["Chart.js", packageJson.dependencies["chart.js"], "MIT"],
        ["Tailwind CSS", packageJson.devDependencies.tailwindcss, "MIT"],
      ] as const).map(([name, version, license]) => <div className="t3-b-about-license-row" key={name}><b>{name}</b><span>{version.replace(/^[~^]/, "")}</span><span>{license}</span></div>)}
      <div className="t3-b-about-license-foot"><button className="t3-b-button small" onClick={() => { void openExternal("license"); }}>{t("fidelity.settingsB.about.viewProjectLicense")}</button></div>
    </section>
    <section className="t3-b-card t3-b-about-news">
      <div className="t3-b-card-head"><div><h3>{t("fidelity.settingsB.about.features")}</h3><p>{t("fidelity.settingsB.about.featuresDesc")}</p></div></div>
      {["sync", "backup", "pro", "security"].map((item) => <div className="t3-b-about-feature" key={item}><CheckIcon /><span>{t(`fidelity.settingsB.about.feature.${item}`)}</span></div>)}
      <button className="t3-b-about-release-link" onClick={() => { void openExternal("changelog"); }}>{t("fidelity.settingsB.about.fullNotes")} <ExternalLinkIcon /></button>
    </section>
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}><DialogContent className="t3-b-about-guide-dialog"><DialogHeader><DialogTitle>{t("fidelity.settingsB.about.guideTitle")}</DialogTitle>
      <DialogDescription>{t("fidelity.settingsB.about.guideConfirm")}</DialogDescription></DialogHeader>
      <DialogFooter><Button variant="outline" onClick={() => setGuideOpen(false)}>{t("common.cancel")}</Button>
        <Button onClick={() => { setGuideOpen(false); requestOnboardingReplay(); }}>{t("fidelity.settingsB.about.startGuide")}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={updateOpen} onOpenChange={setUpdateOpen}>
      <DialogContent className="t3-b-about-update-dialog"><DialogHeader><DialogTitle>{t("fidelity.settingsB.about.updateAvailable").replace("{version}", update?.version ?? "")}</DialogTitle>
        <DialogDescription>{t("fidelity.settingsB.about.youHave").replace("{version}", version)}
          {releaseDate && <> {t("fidelity.settingsB.about.released").replace("{date}", releaseDate)}</>}</DialogDescription></DialogHeader>
        {update?.body && <ReleaseNotes content={update.body} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setUpdateOpen(false)}>{t("fidelity.settingsB.about.later")}</Button>
          <Button onClick={install}>{t("fidelity.settingsB.about.downloadInstall")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>;
}
