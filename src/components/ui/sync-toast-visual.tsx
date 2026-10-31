import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";

export type SyncToastStatus = "success" | "pending" | "error";

export function syncToastStyle(status: SyncToastStatus) {
  const base = "sync-toast max-h-[calc(100dvh-10rem)] min-h-[76px] overflow-y-auto border border-control border-l-[3px] pl-12 pr-14 shadow-overlay sm:min-w-[320px] bg-raised text-foreground";
  if (status === "success") return `${base} border-l-positive`;
  if (status === "pending") return `${base} border-l-accent-data`;
  return `${base} border-l-negative`;
}

export function SyncToastIcon({ status }: { status: SyncToastStatus }) {
  const Icon = status === "success" ? CheckCircledIcon
    : status === "pending" ? ReloadIcon : ExclamationTriangleIcon;
  return <Icon aria-hidden="true" className={`absolute left-5 top-5 h-5 w-5 ${status === "pending" ? "motion-safe:animate-spin" : ""}`} />;
}
