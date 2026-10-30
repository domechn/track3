import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckIcon, ClipboardCopyIcon, ExclamationTriangleIcon, OpenInNewWindowIcon, ReloadIcon, UpdateIcon } from "@radix-ui/react-icons";
import { Button } from "@/components/ui/button";
import { detectPublicIp, type PublicIp } from "@/middlelayers/public-ip";

let cachedIp: PublicIp | undefined;
let pendingLookup: Promise<PublicIp | undefined> | undefined;

export function PublicIpInfo({ t, mobile = false }: { t: (key: string) => string; mobile?: boolean }) {
  const [status, setStatus] = useState<"loading" | "value" | "error">("loading");
  const [ip, setIp] = useState(cachedIp);
  const [copied, setCopied] = useState(false);
  const mounted = useRef(false);
  const loading = useRef(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>();

  const refresh = async () => {
    if (loading.current) return;
    loading.current = true;
    clearTimeout(copiedTimer.current);
    setCopied(false);
    setStatus("loading");
    const lookup = pendingLookup ??= detectPublicIp()
      .then((value) => value, () => undefined)
      .finally(() => { pendingLookup = undefined; });
    const next = await lookup;
    if (next) cachedIp = next;
    if (mounted.current) {
      if (next) {
        setIp(next);
        setStatus("value");
      } else {
        setIp(undefined);
        setStatus("error");
      }
    }
    loading.current = false;
  };

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => { mounted.current = false; };
  }, []);

  const copy = async () => {
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip.address);
      if (!mounted.current) return;
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  return (
    <div role="group" aria-label={t("config.publicIpLabel")} aria-busy={status === "loading"} className={mobile
      ? "min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-sm"
      : "min-w-0 rounded-md border border-border bg-muted/30 px-3 py-3 text-sm"}>
      <p className="mb-2 text-xs font-medium text-muted-foreground">{t("config.publicIpLabel")}</p>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {status === "value" && ip && <span className="min-w-0 select-text break-all rounded-md bg-secondary px-2.5 py-1.5 font-mono text-base font-semibold text-secondary-foreground">{ip.address}</span>}
        {status === "loading" && <span role="status" className="inline-flex items-center gap-2 font-medium text-foreground">
          <ReloadIcon aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          {t("config.publicIpLoading")}
        </span>}
        {status === "error" && <span role="alert" className="flex min-w-0 flex-[1_1_10rem] items-start gap-2 text-[13px] font-medium leading-5 text-destructive dark:text-red-400">
          <ExclamationTriangleIcon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          {t("config.publicIpError")}
        </span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {status !== "error" && <Button type="button" variant="outline" size="sm" className={`${mobile ? "min-h-11" : "min-h-9"} min-w-[6.75rem] touch:min-w-[6.75rem] gap-1.5 border-foreground/50 bg-card text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50`}
            disabled={status !== "value"} onClick={() => void copy()}>
            {copied ? <CheckIcon aria-hidden="true" className="h-4 w-4" /> : <ClipboardCopyIcon aria-hidden="true" className="h-4 w-4" />}
            {t(copied ? "config.publicIpCopied" : "config.publicIpCopy")}
          </Button>}
          <Button type="button" variant="outline" size="sm" className={`${mobile ? "min-h-11" : "min-h-9"} gap-1.5 border-foreground/50 bg-card text-sm font-semibold text-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50`}
            disabled={status === "loading"} onClick={() => void refresh()}>
            <UpdateIcon aria-hidden="true" className="h-4 w-4" />
            {t(status === "error" ? "config.publicIpRetry" : "config.publicIpRefresh")}
          </Button>
        </div>
      </div>
      <span role="status" aria-live="polite" className="sr-only">{copied ? t("config.publicIpCopied") : ""}</span>
      {ip?.version === 6 && status === "value" && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("config.publicIpIpv6")}</p>}
      {status === "value" && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{t("config.publicIpHint")}</p>}
      <button type="button" className={`mt-2 inline-flex ${mobile ? "min-h-11" : "min-h-9"} items-center gap-1.5 text-left text-xs font-medium text-primary underline underline-offset-2 hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
        onClick={() => { void openUrl("https://track3.dev/docs/").catch(() => {}); }}>
        {t("config.publicIpDocs")} <OpenInNewWindowIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      </button>
      {mobile && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("config.publicIpMobileHint")}</p>}
    </div>
  );
}
