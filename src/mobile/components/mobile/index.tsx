import React, { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeftIcon, ChevronRightIcon, Cross2Icon } from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/mobile/i18n";
import { iosHaptic } from "@/utils/ios-native";
import { isIOS } from "@/utils/platform";
import "@/mobile/components/mobile/mobile.css";
export { AnimatedAmount, Button, DeltaPill, EmptyState, IconButton, MobileCard, MobileSkeleton, Pill, SectionHeader } from "@/mobile/components/mobile/design";
export { MobileIcon } from "@/mobile/components/mobile/icons";
export { MobileNavigation, MobileSidebar } from "@/mobile/components/mobile/navigation";
export { SplitView } from "@/mobile/components/mobile/split-view";
export { useSizeClass } from "@/mobile/components/mobile/size-class";
export { Switch } from "@/mobile/components/ui/switch";

export const MOBILE_MEDIA_QUERY = "(pointer: coarse)";

export function useHaptics() {
  return (kind: "selection" | "light" | "success" = "selection") => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    if (isIOS()) {
      void iosHaptic(kind === "success" ? "success" : "light").catch(() => {});
      return;
    }
    navigator.vibrate?.(kind === "success" ? [12, 28, 12] : kind === "light" ? 8 : 5);
  };
}

export function useIsMobile() {
  const [mobile, setMobile] = useState(() => isIOS() || (window.matchMedia?.(MOBILE_MEDIA_QUERY).matches ?? false));
  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA_QUERY);
    const update = () => setMobile(isIOS() || query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);
  return mobile;
}

export function LargeTitle({ children, className }: React.PropsWithChildren<{ className?: string }>) {
  return <h1 className={cn("ios-large-title mobile-large-title", className)}>{children}</h1>;
}

export function MobilePage({
  title, back, children, className, actions,
}: React.PropsWithChildren<{
  title: string;
  back?: () => void;
  className?: string;
  actions?: React.ReactNode;
}>) {
  const { t } = useTranslation();
  return (
    <section className={cn("mobile-page", className)}>
      <div className="mobile-page-nav">
        {back && <button type="button" className="mobile-back" onClick={back} aria-label={t("common.back", "Back")}>
          <ChevronLeftIcon aria-hidden="true" />{t("common.back", "Back")}
        </button>}
        <div className="mobile-page-actions">{actions}</div>
      </div>
      <LargeTitle>{title}</LargeTitle>
      {children}
    </section>
  );
}

export function BottomSheet({
  open, onOpenChange, title, children, detents = ["medium", "large"], initialDetent, className, inline = false,
}: React.PropsWithChildren<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  detents?: Array<"medium" | "large">;
  initialDetent?: "medium" | "large";
  className?: string;
  inline?: boolean;
}>) {
  const { t } = useTranslation();
  const [detent, setDetent] = useState<"medium" | "large">(initialDetent ?? detents[0] ?? "medium");
  const startY = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  const [viewport, setViewport] = useState(() => {
    const visual = window.visualViewport;
    return visual ? {
      bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop),
      height: visual.height,
    } : null;
  });
  useEffect(() => {
    if (!open || !window.visualViewport) return;
    const visual = window.visualViewport;
    const update = () => setViewport({
      bottom: Math.max(0, window.innerHeight - visual.height - visual.offsetTop),
      height: visual.height,
    });
    visual.addEventListener("resize", update);
    visual.addEventListener("scroll", update);
    update();
    return () => {
      visual.removeEventListener("resize", update);
      visual.removeEventListener("scroll", update);
    };
  }, [open]);
  const restoreFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) restoreFocus.current = document.activeElement as HTMLElement;
  wasOpen.current = open;
  const dragStart = (event: React.PointerEvent) => {
    startY.current = event.clientY;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const dragMove = (event: React.PointerEvent) => {
    if (startY.current === null) return;
    setDrag(Math.max(-window.innerHeight, Math.min(window.innerHeight - 120, event.clientY - startY.current)));
  };
  const dragEnd = (event: React.PointerEvent) => {
    if (startY.current === null) return;
    const distance = event.clientY - startY.current;
    startY.current = null;
    setDrag(0);
    if (distance > 80) {
      if (detent === "large" && detents.includes("medium")) setDetent("medium");
      else onOpenChange(false);
    } else if (distance < -80 && detents.includes("large")) {
      setDetent("large");
    }
  };
  const sheetHeight = detent === "large"
    ? "100dvh - env(safe-area-inset-top) - .5rem"
    : "min(60dvh, 42rem)";
  const dragHeight = drag === 0 ? undefined
    : `calc(${sheetHeight} ${drag > 0 ? "-" : "+"} ${Math.abs(drag)}px)`;
  if (inline) return <aside role="region" aria-label={title} className={cn("mobile-inline-detail", className)}>
    <div className="mobile-sheet-heading">
      <h2>{title}</h2>
      {open && <button type="button" className="mobile-sheet-close" aria-label={t("common.close", "Close")}
        onClick={() => onOpenChange(false)}><Cross2Icon aria-hidden="true" /></button>}
    </div>
    {open && <div className="mobile-sheet-body">{children}</div>}
  </aside>;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="mobile-sheet-backdrop" />
        <Dialog.Content className={cn("mobile-sheet", `mobile-sheet-${detent}`, className)} aria-describedby={undefined}
          style={{ ...(viewport ? { bottom: viewport.bottom, maxHeight: viewport.height } : {}), height: dragHeight }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreFocus.current?.focus({ preventScroll: true });
          }}>
          <div className="mobile-sheet-handle-area" onPointerDown={dragStart} onPointerMove={dragMove}
            onPointerUp={dragEnd} onPointerCancel={() => { startY.current = null; setDrag(0); }}>
            <span className="mobile-sheet-handle" aria-hidden="true" />
          </div>
          <div className="mobile-sheet-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="mobile-sheet-close" aria-label={t("common.close", "Close")}><Cross2Icon aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="mobile-sheet-body">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export type SheetAction = { label: string; onClick: () => void; destructive?: boolean; disabled?: boolean };

export function ActionSheet({ open, onOpenChange, title, actions }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  actions: SheetAction[];
}) {
  const { t } = useTranslation();
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} detents={["medium"]}>
      <div className="mobile-action-sheet">
        {actions.map((action) => <button type="button" key={action.label} disabled={action.disabled}
          className={cn("mobile-action", action.destructive && "text-destructive")}
          onClick={() => { action.onClick(); onOpenChange(false); }}>{action.label}</button>)}
        <button type="button" className="mobile-action mobile-action-cancel" onClick={() => onOpenChange(false)}>{t("common.cancel")}</button>
      </div>
    </BottomSheet>
  );
}

export function SwipeableRow({ children, actions, className, allowImmediateAction = false }: React.PropsWithChildren<{ actions: SheetAction[]; className?: string; allowImmediateAction?: boolean }>) {
  const [revealed, setRevealed] = useState(false);
  const haptic = useHaptics();
  const start = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const onPointerDown = (event: React.PointerEvent) => {
    suppressClick.current = false;
    start.current = { x: event.clientX, y: event.clientY };
  };
  const onPointerUp = (event: React.PointerEvent) => {
    if (!start.current) return;
    const x = event.clientX - start.current.x;
    const y = event.clientY - start.current.y;
    start.current = null;
    if (Math.abs(x) < 40 || Math.abs(x) < Math.abs(y)) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 500);
    setRevealed(x < 0);
    haptic("selection");
  };
  return <div data-swipeable-row className={cn("mobile-swipe-row", className)}
    onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
    onClickCapture={(event) => {
      if (allowImmediateAction && (event.target as Element).closest(".mobile-swipe-actions")) return;
      if (!suppressClick.current) return;
      suppressClick.current = false;
      event.preventDefault();
      event.stopPropagation();
    }}>
    <div className="mobile-swipe-content">{children}</div>
    <div aria-hidden={!revealed} className={cn("mobile-swipe-actions", revealed && "mobile-swipe-actions-revealed")}>
      {actions.map((action) => <button type="button" key={action.label} disabled={action.disabled}
        tabIndex={revealed ? 0 : -1}
        className={cn("mobile-swipe-action", action.destructive && "mobile-swipe-destructive")}
        onClick={() => { action.onClick(); setRevealed(false); }}>{action.label}</button>)}
    </div>
  </div>;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className, label }: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  className?: string;
  label?: string;
}) {
  const haptic = useHaptics();
  return <div role="radiogroup" aria-label={label} className={cn("mobile-segments", className)}>
    {options.map((option) => <button type="button" role="radio" aria-checked={value === option.value}
      key={option.value} className="mobile-segment" onClick={() => {
        if (value !== option.value) haptic("selection");
        onChange(option.value);
      }}>{option.label}</button>)}
  </div>;
}

export function PullToRefresh({ children, onRefresh, disabled, className }: React.PropsWithChildren<{
  onRefresh: () => void | Promise<void>; disabled?: boolean; className?: string;
}>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const haptic = useHaptics();
  const { t } = useTranslation();
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => () => { start.current = null; }, []);
  return <div data-testid="pull-to-refresh" className={className}
    onTouchStart={(event) => {
      if (!event.currentTarget.contains(event.target as Node)) return;
      if (disabled || refreshing || window.scrollY > 0) return;
      for (let element = event.target as Element | null; element; element = element.parentElement) {
        if (element.scrollTop > 0 && element.scrollHeight > element.clientHeight &&
          /^(auto|scroll|overlay)$/.test(getComputedStyle(element).overflowY)) return;
        if (element === event.currentTarget) break;
      }
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }}
    onTouchMove={(event) => {
      if (!start.current) return;
      const x = event.touches[0].clientX - start.current.x;
      const y = event.touches[0].clientY - start.current.y;
      if (Math.abs(x) > Math.abs(y)) { start.current = null; return; }
      setPull(Math.max(0, Math.min(80, y)));
    }}
    onTouchEnd={(event) => {
      if (!start.current) return;
      const x = event.changedTouches[0].clientX - start.current.x;
      const y = event.changedTouches[0].clientY - start.current.y;
      start.current = null;
      setPull(0);
      if (y < 72 || Math.abs(x) > Math.abs(y)) return;
      haptic("light");
      setRefreshing(true);
      void Promise.resolve(onRefresh()).finally(() => setRefreshing(false));
    }}>
    {(pull > 0 || refreshing) && <div className="mobile-pull-indicator" role="status"
      aria-label={t("mobile.refreshView")} style={{ minHeight: pull || 44 }}>
      <span className={refreshing ? "animate-spin" : ""} aria-hidden="true">↻</span>
    </div>}
    {children}
  </div>;
}

export function InsetGroup({ children, title, className }: React.PropsWithChildren<{ title?: string; className?: string }>) {
  return <section className={cn("mobile-inset-section", className)}>
    {title && <h2 className="mobile-inset-heading">{title}</h2>}
    <div className="mobile-inset-group">{children}</div>
  </section>;
}

export function ListRow({ children, value, onClick, href, trailing, className, ariaCurrent }: React.PropsWithChildren<{
  value?: React.ReactNode; onClick?: () => void; href?: string; trailing?: React.ReactNode; className?: string;
  ariaCurrent?: "page";
}>) {
  const content = <><span className="mobile-list-label">{children}</span>{value && <span className="mobile-list-value">{value}</span>}{trailing ?? ((href || onClick) && <ChevronRightIcon aria-hidden="true" />)}</>;
  const classes = cn("mobile-list-row", className);
  if (href) return <a href={href} className={classes} aria-current={ariaCurrent}>{content}</a>;
  if (onClick) return <button type="button" onClick={onClick} className={classes}>{content}</button>;
  return <div className={classes}>{content}</div>;
}

export type MobileRecord = {
  id: string;
  title: string;
  subtitle?: React.ReactNode;
  fields: Array<{ label: string; value: React.ReactNode }>;
  actions?: SheetAction[];
};

export function MobileRecordList({ records, className, empty }: { records: MobileRecord[]; className?: string; empty?: React.ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const record = records.find((item) => item.id === selected);
  return <div className={cn("mobile-record-list", className)}>
    {records.length === 0 && empty && <div className="mobile-list-row text-muted-foreground">{empty}</div>}
    {records.map((item) => <ListRow key={item.id} onClick={() => setSelected(item.id)} value={item.subtitle}>
      {item.title}
    </ListRow>)}
    <BottomSheet open={!!record} onOpenChange={(open) => { if (!open) setSelected(null); }}
      title={record?.title ?? ""} detents={["medium", "large"]}>
      <dl className="mobile-record-fields">
        {record?.fields.map((field, index) => <div key={`${field.label}-${index}`} className="mobile-record-field">
          <dt>{field.label}</dt><dd>{field.value}</dd>
        </div>)}
      </dl>
      {record?.actions?.map((action) => <button type="button" key={action.label}
        className={cn("mobile-action", action.destructive && "text-destructive")}
        disabled={action.disabled} onClick={() => { setSelected(null); action.onClick(); }}>{action.label}</button>)}
    </BottomSheet>
  </div>;
}
