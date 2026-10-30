import { CheckCircledIcon, ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";

export type SyncToastStatus = "success" | "pending" | "error";

export function syncToastStyle(status: SyncToastStatus) {
  const base = "sync-toast max-h-[calc(100dvh-10rem)] min-h-[76px] overflow-y-auto border-2 border-l-[6px] pl-12 pr-14 shadow-xl sm:min-w-[320px]";
  if (status === "success") return `${base} border-emerald-300 border-l-emerald-700 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:border-l-emerald-400 dark:bg-emerald-950 dark:text-emerald-50`;
  if (status === "pending") return `${base} border-sky-300 border-l-sky-700 bg-sky-50 text-sky-950 dark:border-sky-700 dark:border-l-sky-400 dark:bg-sky-950 dark:text-sky-50`;
  return `${base} border-red-800 border-l-red-950 bg-red-700 text-white dark:border-red-500 dark:border-l-red-300 dark:bg-red-800 dark:text-white`;
}

export function SyncToastIcon({ status }: { status: SyncToastStatus }) {
  const Icon = status === "success" ? CheckCircledIcon
    : status === "pending" ? ReloadIcon : ExclamationTriangleIcon;
  return <Icon aria-hidden="true" className={`absolute left-5 top-5 h-5 w-5 ${status === "pending" ? "motion-safe:animate-spin" : ""}`} />;
}
