import { type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "./popover";

let activeHint: string | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function setActiveHint(next: string | null) {
  if (activeHint === next) return;
  activeHint = next;
  listeners.forEach((listener) => listener());
}

export function HintPopover({
  label, children, trigger, className, hoverParent = false, side = "top",
}: {
  label?: string;
  children: ReactNode;
  trigger?: ReactNode;
  className?: string;
  hoverParent?: boolean;
  side?: "top" | "bottom";
}) {
  const id = useId();
  const contentId = `${id}-hint`;
  const open = useSyncExternalStore(subscribe, () => activeHint === id, () => false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cardAnchor = useRef({
    getBoundingClientRect: () => buttonRef.current?.parentElement?.getBoundingClientRect()
      ?? document.documentElement.getBoundingClientRect(),
    get contextElement() { return buttonRef.current?.parentElement ?? undefined; },
  });
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focusOpened = useRef(false);
  const pointerDown = useRef(false);
  const pinned = useRef(false);
  const clearTimers = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
  };
  const enter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    if (activeHint === id && pinned.current) return;
    pinned.current = false;
    clearTimers();
    openTimer.current = setTimeout(() => setActiveHint(id), 150);
  };
  const leave = (event: PointerEvent) => {
    if (event.pointerType === "touch" || pinned.current) return;
    clearTimers();
    closeTimer.current = setTimeout(() => {
      if (activeHint === id) setActiveHint(null);
    }, 100);
  };
  useEffect(() => {
    const parent = hoverParent ? buttonRef.current?.parentElement : undefined;
    if (!parent) return;
    parent.addEventListener("pointerenter", enter);
    parent.addEventListener("pointerleave", leave);
    return () => {
      parent.removeEventListener("pointerenter", enter);
      parent.removeEventListener("pointerleave", leave);
    };
  });
  useEffect(() => () => {
    clearTimers();
    if (activeHint === id) setActiveHint(null);
  }, [id]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !contentRef.current?.contains(target)) {
        pinned.current = false;
        setActiveHint(null);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);

  const button = <button ref={buttonRef} type="button" className={className} aria-label={label}
        aria-expanded={open} aria-describedby={open ? contentId : undefined}
        onPointerEnter={!hoverParent ? (event) => enter(event.nativeEvent) : undefined}
        onPointerLeave={!hoverParent ? (event) => leave(event.nativeEvent) : undefined}
        onPointerDown={() => { pointerDown.current = true; focusOpened.current = false; }}
        onPointerUp={() => { pointerDown.current = false; }}
        onPointerCancel={() => { pointerDown.current = false; }}
        onFocus={() => {
          if (pointerDown.current) return;
          focusOpened.current = true;
          pinned.current = true;
          clearTimers();
          setActiveHint(id);
        }}
        onBlur={(event) => {
          if (contentRef.current?.contains(event.relatedTarget)) return;
          pinned.current = false;
          focusOpened.current = false;
          if (activeHint === id) setActiveHint(null);
        }}
        onClick={() => {
          clearTimers();
          if (focusOpened.current) {
            focusOpened.current = false;
            return;
          }
          const next = activeHint !== id || !pinned.current;
          pinned.current = next;
          setActiveHint(next ? id : null);
          pointerDown.current = false;
        }}>
        {trigger ?? <span aria-hidden="true">ⓘ</span>}
      </button>
  return <Popover open={open} onOpenChange={(next) => {
    if (next || activeHint === id) {
      if (!next) pinned.current = false;
      setActiveHint(next ? id : null);
    }
  }}>
    {hoverParent ? <><PopoverAnchor virtualRef={cardAnchor} />{button}</>
      : <PopoverAnchor asChild>{button}</PopoverAnchor>}
    <PopoverContent ref={contentRef} id={contentId} role="tooltip" side={side} align="center"
      collisionPadding={8} avoidCollisions sideOffset={8}
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}
      onInteractOutside={(event) => {
        if (buttonRef.current?.contains(event.target as Node)) event.preventDefault();
      }}
      onPointerEnter={() => clearTimers()}
      onPointerLeave={(event) => leave(event.nativeEvent)}
      className="z-[100] w-max max-w-[min(360px,calc(100vw-16px))] max-h-[40vh] overflow-y-auto overflow-x-hidden !rounded-[6px] border border-border bg-popover p-3 text-xs leading-5 text-popover-foreground shadow-overlay [overflow-wrap:anywhere]">
      {children}
    </PopoverContent>
  </Popover>;
}

export function HintCoinList({
  names, more, showAll, showLess,
}: {
  names: readonly string[];
  more: (count: number) => string;
  showAll: string;
  showLess: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const extra = Math.max(0, names.length - 8);
  return <span className="block max-h-[25vh] overflow-y-auto [overflow-wrap:anywhere]">
    <span>{(expanded ? names : names.slice(0, 8)).join(", ")}</span>
    {extra > 0 && <>
      {!expanded && <span> {more(extra)}</span>}
      {" "}<button type="button" className="underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => setExpanded(!expanded)}>{expanded ? showLess : showAll}</button>
    </>}
  </span>;
}
