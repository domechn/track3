import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

function useModal(onDismiss?: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(root.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0 || import.meta.env.MODE === "test");
    (controls()[0] ?? root).focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (Array.from(document.querySelectorAll('[aria-modal="true"]')).at(-1) !== root) return;
      if (event.key === "Escape" && dismissRef.current) {
        event.preventDefault();
        dismissRef.current();
      }
      if (event.key !== "Tab") return;
      const items = controls();
      if (!items.length) { event.preventDefault(); root.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return ref;
}

export function ModalPage({ title, children, onDismiss }: { title: string; children: ReactNode; onDismiss?: () => void }) {
  const ref = useModal(onDismiss);
  return createPortal(<div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 overflow-y-auto bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-[calc(env(safe-area-inset-top)+1rem)]">
    {children}
  </div>, document.body);
}

export function ConfirmSheet({ title, children, onDismiss }: { title: string; children: ReactNode; onDismiss?: () => void }) {
  const ref = useModal(onDismiss);
  return createPortal(<div ref={ref} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={title} onClick={(event) => { if (event.target === event.currentTarget) onDismiss?.(); }} className="fixed inset-0 z-50 flex items-end bg-black/50 p-3">
    <div className="w-full space-y-2 rounded-2xl bg-card p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
      {children}
    </div>
  </div>, document.body);
}
