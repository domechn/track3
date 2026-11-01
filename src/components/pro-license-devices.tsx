import { Card } from "@/components/ui/card";
import type { LicenseDevices } from "@/middlelayers/license";

export function ProLicenseDevices({ value, locale, t }: {
  value: LicenseDevices;
  locale: string;
  t: (key: string) => string;
}) {
  const formatDate = (date: string) => new Date(date).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
  return <Card role="region" aria-label={t("system.devices.title")} className="overflow-hidden">
    <div className="border-b px-6 py-4">
      <h3 className="text-base font-semibold">{t("system.devices.title")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("system.devices.slots")
        .replace("{count}", String(value.devices.length)).replace("{limit}", String(value.limit))}</p>
    </div>
    <ul className="divide-y">
      {value.devices.map((device) => <li key={device.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 py-4 text-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{device.platform ? t(`system.devices.platform.${device.platform}`) : t("system.devices.unknown")}</span>
            <span className="font-mono text-xs text-muted-foreground">{device.id.slice(0, 8)}</span>
            {device.current && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{t("system.devices.current")}</span>}
          </div>
          {device.appVersion && <p className="mt-1 text-xs text-muted-foreground">{t("system.devices.version").replace("{version}", device.appVersion)}</p>}
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{t("system.devices.activated").replace("{date}", formatDate(device.activatedAt))}</p>
          <p>{t("system.devices.lastSeen").replace("{date}", device.lastSeenAt ? formatDate(device.lastSeenAt) : t("system.devices.never"))}</p>
        </div>
      </li>)}
    </ul>
  </Card>;
}
