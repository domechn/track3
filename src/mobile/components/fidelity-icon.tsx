import type { SVGProps } from "react";

type IconName = "spark" | "clock" | "refresh" | "send" | "search" | "edit" | "trash" | "alert" | "back" | "more";

const paths: Record<IconName, string> = {
  spark: "M9 2l1.8 4.7L15.5 8.5l-4.7 1.8L9 15l-1.8-4.7L2.5 8.5l4.7-1.8z",
  clock: "M9 5v4l2.5 1.5",
  refresh: "M14.5 9a5.5 5.5 0 1 1-1.6-3.9M14.5 3v3h-3",
  send: "M3 9l12-5.5L11.5 15 9 10.5z",
  search: "M12 12l4 4",
  edit: "M3 15l.8-3.5L12.5 3l2.5 2.5-8.7 8.7z",
  trash: "M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5",
  alert: "M9 3l7 12H2zM9 7.5v3M9 12.6v.2",
  back: "M11 4L6 9l5 5",
  more: "",
};

export function FidelityIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {(name === "clock" || name === "search") && <circle cx={name === "clock" ? "9" : "8"} cy={name === "clock" ? "9" : "8"} r={name === "clock" ? "6.5" : "5"} />}
    {name === "more" && <><circle cx="3.5" cy="9" r="1.2" /><circle cx="9" cy="9" r="1.2" /><circle cx="14.5" cy="9" r="1.2" /></>}
    <path d={paths[name]} />
  </svg>;
}
