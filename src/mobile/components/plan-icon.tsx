type Name = "plus" | "alert" | "lock" | "download" | "check" | "back" | "info" | "edit" | "trash" | "more";

export default function PlanIcon({ name }: { name: Name }) {
  const shape = {
    plus: <path d="M9 3.5v11M3.5 9h11" />,
    alert: <><path d="M9 3l7 12H2z" /><path d="M9 7.5v3M9 12.6v.2" /></>,
    lock: <><rect x="4" y="8" width="10" height="7" rx="1.5" /><path d="M6 8V6a3 3 0 0 1 6 0v2" /></>,
    download: <path d="M9 3v8M5.5 8L9 11.5 12.5 8M3.5 14.5h11" />,
    check: <path d="M3.5 9.5l3.5 3.5 7.5-8" />,
    back: <path d="M11 4L6 9l5 5" />,
    info: <><circle cx="9" cy="9" r="6.5" /><path d="M9 8v4M9 5.8v.2" /></>,
    edit: <path d="M3 15l.8-3.5L12.5 3l2.5 2.5-8.7 8.7z" />,
    trash: <path d="M3.5 5h11M7 5V3.5h4V5M5 5l.7 9.5h6.6L13 5" />,
    more: <><circle cx="3.5" cy="9" r="1.2" /><circle cx="9" cy="9" r="1.2" /><circle cx="14.5" cy="9" r="1.2" /></>,
  };
  return <svg viewBox="0 0 18 18" width="18" height="18" fill="none" stroke="currentColor"
    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shape[name]}</svg>;
}
