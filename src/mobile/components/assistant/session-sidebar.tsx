import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "@/mobile/i18n";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "@/mobile/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DrawingPinIcon,
  PinTopIcon,
  Cross2Icon,
  PlusIcon,
  DotsHorizontalIcon,
  LockClosedIcon,
} from "@radix-ui/react-icons";
import type { ChatSessionMeta } from "@/middlelayers/ai";

export type SessionSidebarProps = {
  sessions: ChatSessionMeta[];
  activeId: string | null;
  processingId?: string | null;
  isLoading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onBack?: () => void;
  mobile?: boolean;
};

function relativeTime(iso: string, t: (key: string) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return t("ai.session.relative.justNow");
  if (diffMin < 60) return t("ai.session.relative.minutesAgo").replace("{n}", String(diffMin));
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t("ai.session.relative.hoursAgo").replace("{n}", String(diffHours));
  const diffDays = Math.floor(diffHours / 24);
  return t("ai.session.relative.daysAgo").replace("{n}", String(diffDays));
}

function phoneSessionDate(iso: string, t: (key: string) => string, locale: string): string {
  const date = new Date(iso);
  const today = new Date();
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (day === currentDay) return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  if (currentDay - day === 86_400_000) return t("fidelity.assistant.yesterday");
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short" }).format(date);
}

export default function SessionSidebar({
  sessions,
  activeId,
  processingId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
  onPin,
  onBack,
  mobile = false,
}: SessionSidebarProps) {
  const { t, locale } = useTranslation();

  const pinned = useMemo(() => sessions.filter((s) => s.pinned === 1), [sessions]);
  const recent = useMemo(() => sessions.filter((s) => s.pinned === 0), [sessions]);

  if (mobile) {
    const today = new Date();
    const isToday = (session: ChatSessionMeta) => new Date(session.updatedAt).toDateString() === today.toDateString();
    const groups = [
      { title: t("fidelity.assistant.today"), rows: sessions.filter(isToday) },
      { title: t("fidelity.assistant.earlier"), rows: sessions.filter((session) => !isToday(session)) },
    ];
    return <div className="fidelity-session-list" data-testid="session-sidebar">
      <div className="fidelity-session-page-head relative">
        {onBack && <button type="button" className="fidelity-session-back absolute right-0 top-0 min-h-11 min-w-11" onClick={onBack}>{t("common.back")}</button>}
        <h1>{t("nav.assistant")}</h1>
        <p>{t("fidelity.assistant.sessionsDescription")}</p>
      </div>
      <div className="fidelity-session-section-head">
        <h2>{t("fidelity.assistant.chats")}</h2>
        <Button variant="outline" onClick={onNew} data-testid="session-new-chat"><PlusIcon aria-hidden="true" />{t("ai.session.newChat")}</Button>
      </div>
      <ScrollArea className="fidelity-session-scroll">
        {isLoading ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
          : sessions.length === 0 ? <p>{t("ai.session.empty")}</p>
          : groups.map((group) => group.rows.length > 0 && <section key={group.title} className="fidelity-session-group">
            <h3>{group.title}</h3>
            {group.rows.map((session) => <PhoneSessionRow key={session.id} session={session}
              date={phoneSessionDate(session.updatedAt, t, locale)} active={session.id === activeId}
              onSelect={onSelect} onDelete={onDelete} onPin={onPin} t={t} />)}
          </section>)}
      </ScrollArea>
      <p className="fidelity-session-foot"><LockClosedIcon aria-hidden="true" />{t("fidelity.assistant.sessionsPrivacy")}</p>
    </div>;
  }

  return (
    <div
      className={cn("flex shrink-0 flex-col border-r border-[var(--glass-border)] bg-card/40", mobile ? "w-full min-w-0 flex-1" : "w-[260px]")}
      data-testid="session-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("ai.session.title")}
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onNew}
          className="touch:h-11 gap-1 px-2 text-xs h-7"
          data-testid="session-new-chat"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t("ai.session.newChat")}
        </Button>
      </div>

      {/* Session list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] w-full rounded-md" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("ai.session.empty")}</p>
          </div>
        ) : (
          <div className="py-1">
            {pinned.length > 0 && (
              <div>
                <div className="px-3 pb-0.5 pt-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("ai.session.pinned")}
                  </span>
                </div>
                {pinned.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    isProcessing={s.id === processingId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onPin={onPin}
                    mobile={mobile}
                    t={t}
                  />
                ))}
              </div>
            )}
            {pinned.length > 0 && recent.length > 0 && (
              <Separator className="mx-3 my-1" />
            )}
            {recent.length > 0 && (
              <div>
                <div className="px-3 pb-0.5 pt-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {t("ai.session.recent")}
                  </span>
                </div>
                {recent.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    isProcessing={s.id === processingId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onPin={onPin}
                    mobile={mobile}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function PhoneSessionRow({ session, date, active, onSelect, onDelete, onPin, t }: {
  session: ChatSessionMeta;
  date: string;
  active: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  t: (key: string) => string;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number }>();
  return <div className="t3-selected-list-row fidelity-session-row" data-testid={`session-item-${session.id}`}
    data-active={active ? "true" : undefined}
    data-actions-open={String(actionsOpen)}
    onTouchStart={(event) => { touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
    onTouchEnd={(event) => {
      if (!touchStart.current) return;
      const dx = event.changedTouches[0].clientX - touchStart.current.x;
      const dy = event.changedTouches[0].clientY - touchStart.current.y;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) setActionsOpen(dx < 0);
      touchStart.current = undefined;
    }}>
    <button type="button" className="fidelity-session-select" onClick={() => onSelect(session.id)}
      aria-current={active ? "true" : undefined}
      data-testid={`session-select-${session.id}`}>
      <span className="fidelity-session-title">{session.title || t("ai.session.untitled")}
        {session.pinned === 1 && <span className="fidelity-session-pinned"><DrawingPinIcon aria-hidden="true" />{t("ai.session.pinned")}</span>}</span>
      <span className="fidelity-session-date">{date}</span>
      <span className="fidelity-session-preview">{session.preview}</span>
    </button>
    <button type="button" className="fidelity-session-more" onClick={() => setActionsOpen((open) => !open)}
      aria-label={`${t("ai.session.moreActions")} ${session.title || t("ai.session.untitled")}`} aria-expanded={actionsOpen}>
      <DotsHorizontalIcon aria-hidden="true" />
    </button>
    {actionsOpen && <div className="fidelity-session-actions">
      <button type="button" data-testid={`session-pin-${session.id}`}
        onClick={() => { onPin(session.id, session.pinned !== 1); setActionsOpen(false); }}>
        {session.pinned === 1 ? t("ai.session.unpin") : t("ai.session.pin")}
      </button>
      <ConfirmDeleteDialog trigger={<button type="button" data-testid={`session-delete-${session.id}`}>{t("ai.session.delete")}</button>}
        title={t("ai.session.confirmDeleteTitle")} description={t("ai.session.confirmDeleteBody")}
        cancelLabel={t("ai.session.cancel")} actions={[{ label: t("ai.session.delete"), onClick: () => onDelete(session.id) }]} />
    </div>}
  </div>;
}

function SessionItem({
  session,
  isActive,
  isProcessing = false,
  onSelect,
  onDelete,
  onPin,
  mobile = false,
  t,
}: {
  session: ChatSessionMeta;
  isActive: boolean;
  isProcessing?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  mobile?: boolean;
  t: (key: string) => string;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const touchStart = useRef<{ x: number; y: number }>();
  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPin(session.id, session.pinned === 1 ? false : true);
      setActionsOpen(false);
    },
    [session.id, session.pinned, onPin],
  );

  return (
      <div
        className={cn(
          "t3-selected-list-row group relative mx-2 rounded-md px-3 py-2 text-left transition-colors",
          "hover:bg-accent/60",
        )}
        data-testid={`session-item-${session.id}`}
        data-active={isActive ? "true" : undefined}
        data-actions-open={mobile ? String(actionsOpen) : undefined}
        onTouchStart={mobile ? (event) => {
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } : undefined}
        onTouchEnd={mobile ? (event) => {
          if (!touchStart.current) return;
          const dx = event.changedTouches[0].clientX - touchStart.current.x;
          const dy = event.changedTouches[0].clientY - touchStart.current.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) setActionsOpen(dx < 0);
          touchStart.current = undefined;
        } : undefined}
      >
        <div className="flex items-start gap-1">
          <button
            type="button"
            onClick={() => {
              if (actionsOpen) setActionsOpen(false);
              else onSelect(session.id);
            }}
            aria-current={isActive ? "true" : undefined}
            className="min-h-8 touch:min-h-11 min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`session-select-${session.id}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              {isProcessing && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/75 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              )}
              <span className="truncate text-sm font-medium leading-snug text-foreground/90">
                {session.title || t("ai.session.untitled")}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {relativeTime(session.updatedAt, t)}
            </span>
          </button>
          {mobile && !actionsOpen && <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded text-muted-foreground"
            aria-label={`${t("ai.session.moreActions")} ${session.title || t("ai.session.untitled")}`}
            onClick={() => setActionsOpen(true)}
          ><DotsHorizontalIcon className="h-5 w-5" /></button>}
          {/* Hover actions */}
          <span className={cn("mt-0.5 flex shrink-0 items-center gap-0.5 transition-opacity", mobile ? (actionsOpen ? "opacity-100" : "hidden") : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100 motion-reduce:opacity-100")}>
            <button
              type="button"
              onClick={handlePin}
              title={session.pinned === 1 ? t("ai.session.unpin") : t("ai.session.pin")}
              className="inline-flex h-6 w-6 touch:h-11 touch:w-11 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              data-testid={`session-pin-${session.id}`}
            >
              {session.pinned === 1 ? (
                <PinTopIcon className="h-3.5 w-3.5" />
              ) : (
                <DrawingPinIcon className="h-3.5 w-3.5" />
              )}
            </button>
            <ConfirmDeleteDialog
              trigger={
                <button
                  type="button"
                  title={t("ai.session.delete")}
                  className="inline-flex h-6 w-6 touch:h-11 touch:w-11 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`session-delete-${session.id}`}
                >
                  <Cross2Icon className="h-3.5 w-3.5" />
                </button>
              }
              title={t("ai.session.confirmDeleteTitle")}
              description={t("ai.session.confirmDeleteBody")}
              cancelLabel={t("ai.session.cancel")}
              actions={[{
                label: t("ai.session.delete"),
                onClick: () => onDelete(session.id),
              }]}
            />
          </span>
        </div>
      </div>
  );
}
