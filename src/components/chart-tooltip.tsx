import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Selection = { index: number; anchor: Element; content: ReactNode };

export function ChartTooltip({ anchor, children }: { anchor: Element | null; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const place = () => {
      const target = anchor.getBoundingClientRect();
      const tip = ref.current!.getBoundingClientRect();
      const card = anchor.closest("[data-ui-card], .fd-card, .fidelity-card, .t3-cmp-card")?.getBoundingClientRect();
      const viewport = { left: 8, right: window.innerWidth - 8, top: 8, bottom: window.innerHeight - 8 };
      const bound = card && card.width >= tip.width + 16
        ? { left: Math.max(card.left + 8, viewport.left), right: Math.min(card.right - 8, viewport.right),
            top: Math.max(card.top + 8, viewport.top), bottom: Math.min(card.bottom - 8, viewport.bottom) }
        : viewport;
      const plot = anchor.closest(".t3-chart-plot, .fd-overview-chart")?.getBoundingClientRect();
      if (plot && Math.min(bound.bottom, plot.bottom - 8) - Math.max(bound.top, plot.top + 8) >= tip.height) {
        bound.top = Math.max(bound.top, plot.top + 8);
        bound.bottom = Math.min(bound.bottom, plot.bottom - 8);
      }
      const above = target.top - tip.height - 12;
      const below = target.bottom + 12;
      const clamp = (value: number, start: number, end: number) => Math.max(start, Math.min(value, end));
      const sideRight = target.right + tip.width + 12 <= bound.right;
      const sideLeft = target.left - tip.width - 12 >= bound.left;
      const fitsAbove = above >= bound.top;
      const fitsBelow = below + tip.height <= bound.bottom;
      let left: number;
      let top: number;
      if ((plot || target.height > tip.height || !fitsAbove && !fitsBelow) && (sideRight || sideLeft)) {
        left = sideRight ? target.right + 12 : target.left - tip.width - 12;
        top = clamp(target.top + target.height / 2 - tip.height / 2, bound.top, bound.bottom - tip.height);
      } else {
        left = clamp(target.left + target.width / 2 - tip.width / 2, bound.left, bound.right - tip.width);
        top = fitsAbove ? above : fitsBelow ? below
          : above >= viewport.top ? above : below + tip.height <= viewport.bottom ? below
          : clamp(above, viewport.top, viewport.bottom - tip.height);
      }
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, children]);
  if (!anchor) return null;
  return createPortal(<div ref={ref} role="tooltip" data-chart-tooltip="" style={position}
    className="pointer-events-none fixed z-[100] w-max max-w-[min(280px,calc(100vw-16px))] rounded-md border border-border bg-popover px-3 py-2 text-xs leading-5 text-popover-foreground shadow-overlay">
    {children}
  </div>, document.body);
}

export function useChartHitArea() {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [roving, setRoving] = useState(0);
  const contentByIndex = useRef(new Map<number, ReactNode>());
  const touchInteraction = useRef(false);
  const active = selection?.index ?? null;
  const select = useCallback((index: number, anchor: Element | null) => {
    if (!anchor) return;
    setRoving(index);
    const content = contentByIndex.current.get(index);
    setSelection((current) => current?.index === index && current.anchor === anchor && current.content === content
      ? current : { index, anchor, content });
  }, []);
  const clear = useCallback(() => {
    touchInteraction.current = false;
    setSelection(null);
  }, []);
  useEffect(() => {
    if (!selection) return;
    const outside = (event: PointerEvent) => {
      if (!selection.anchor.contains(event.target as Node)) {
        touchInteraction.current = false;
        setSelection(null);
      }
    };
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [selection]);
  const markProps = (index: number, label: string, content: ReactNode) => {
    contentByIndex.current.set(index, content);
    return ({
    "data-chart-mark": "",
    "aria-label": label,
    tabIndex: index === roving ? 0 : -1,
    onPointerEnter: (event: React.PointerEvent<Element>) => {
      if (event.pointerType !== "touch") {
        touchInteraction.current = false;
        setRoving(index);
        setSelection({ index, anchor: event.currentTarget, content });
      }
    },
    onPointerLeave: (event: React.PointerEvent<Element>) => {
      if (event.pointerType !== "touch") {
        const anchor = event.currentTarget;
        setSelection((current) => current?.anchor === anchor ? null : current);
      }
    },
    onPointerDown: (event: React.PointerEvent<Element>) => {
      if (event.pointerType === "touch") {
        const anchor = event.currentTarget;
        touchInteraction.current = true;
        setRoving(index);
        setSelection((current) => current?.anchor === anchor ? null
          : { index, anchor, content });
      }
    },
    onFocus: (event: React.FocusEvent<Element>) => {
      setRoving(index);
      setSelection({ index, anchor: event.currentTarget, content });
    },
    onBlur: (event: React.FocusEvent<Element>) => {
      if (!touchInteraction.current &&
        !(event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-chart-group]") ===
          event.currentTarget.closest("[data-chart-group]"))) setSelection(null);
    },
    onKeyDown: (event: React.KeyboardEvent<Element>) => {
      touchInteraction.current = false;
      if (event.key === "Escape") {
        setSelection(null);
        event.stopPropagation();
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const marks = [...(event.currentTarget.closest("[data-chart-group]")?.querySelectorAll<HTMLElement | SVGElement>("[data-chart-mark]") ?? [])];
        const next = marks[Math.max(0, Math.min(marks.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)))];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    },
  });
  };
  return { active, markProps, select, clear, tooltip: <ChartTooltip anchor={selection?.anchor ?? null}>{selection?.content}</ChartTooltip> };
}
