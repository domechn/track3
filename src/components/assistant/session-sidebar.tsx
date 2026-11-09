import { useCallback, useMemo } from "react";
import { useTranslation, type Locale } from "@/i18n";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  DrawingPinIcon,
  PinTopIcon,
  Cross2Icon,
  PlusIcon,
  LockClosedIcon,
  ChevronLeftIcon,
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
  onCollapse?: () => void;
  collapseRef?: React.Ref<HTMLButtonElement>;
  controlsId?: string;
};

function relativeTime(iso: string, t: (key: string) => string, locale: Locale): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("ai.session.relative.justNow");
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return t("fidelity.assistant.yesterday");
  return date.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-GB", { day: "numeric", month: "short" });
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
  onCollapse,
  collapseRef,
  controlsId = "assistant-chats",
}: SessionSidebarProps) {
  const { t, locale } = useTranslation();

  const pinned = useMemo(() => sessions.filter((s) => s.pinned === 1), [sessions]);
  const recent = useMemo(() => sessions.filter((s) => s.pinned === 0), [sessions]);
  const today = useMemo(() => recent.filter((s) => new Date(s.updatedAt).toDateString() === new Date().toDateString()), [recent]);
  const earlier = useMemo(() => recent.filter((s) => new Date(s.updatedAt).toDateString() !== new Date().toDateString()), [recent]);

  return (
    <div
      className="flex h-full w-[300px] shrink-0 flex-col border-r border-[var(--glass-border)] bg-card/40"
      data-testid="session-sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] px-3 py-2.5">
        <h2 className="text-[15px] font-semibold text-foreground">
          {t("fidelity.assistant.chats")}
        </h2>
        <div className="t3-assistant-sidebar-actions"><Button
          variant="ghost"
          size="sm"
          onClick={onNew}
          className="touch:h-11 gap-1 px-2 text-xs h-7"
          data-testid="session-new-chat"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          {t("ai.session.newChat")}
        </Button>
        {onCollapse && <button type="button" onClick={onCollapse} ref={collapseRef}
          aria-label={t("assistant.panes.collapseChats")} aria-expanded="true" aria-controls={controlsId}
          title={`${t("assistant.panes.collapseChats")} (Ctrl/⌘+Shift+[)`}
          className="t3-assistant-pane-toggle" data-testid="chats-header-toggle">
          <ChevronLeftIcon aria-hidden="true" />
        </button>}</div>
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
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
            {pinned.length > 0 && recent.length > 0 && (
              <Separator className="mx-3 my-1" />
            )}
            {today.length > 0 && (
              <div>
                <div className="px-3 pb-0.5 pt-2.5">
                  <span className="text-xs text-muted-foreground">
                    {t("fidelity.assistant.today")}
                  </span>
                </div>
                {today.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    isProcessing={s.id === processingId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onPin={onPin}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
            {earlier.length > 0 && (
              <div>
                <div className="px-3 pb-0.5 pt-2.5">
                  <span className="text-xs text-muted-foreground">
                    <span className="t3-assistant-earlier-label">{t("fidelity.assistant.earlier")}</span>
                    <span className="t3-assistant-recent-label">{t("ai.session.recent")}</span>
                  </span>
                </div>
                {earlier.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeId}
                    isProcessing={s.id === processingId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onPin={onPin}
                    t={t}
                    locale={locale}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <div className="t3-assistant-session-foot"><LockClosedIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />{t("fidelity.assistant.storage")}</div>
    </div>
  );
}

function SessionItem({
  session,
  isActive,
  isProcessing = false,
  onSelect,
  onDelete,
  onPin,
  t,
  locale,
}: {
  session: ChatSessionMeta;
  isActive: boolean;
  isProcessing?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  t: (key: string) => string;
  locale: Locale;
}) {
  const handlePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPin(session.id, session.pinned === 1 ? false : true);
    },
    [session.id, session.pinned, onPin],
  );

  return (
      <div
        className={cn(
          "group relative mx-2 rounded-md px-3 py-2 text-left transition-colors border-l-2",
          "hover:bg-accent/60",
          isActive && "bg-accent border-primary",
          !isActive && "border-transparent",
        )}
        data-testid={`session-item-${session.id}`}
        data-active={isActive ? "true" : undefined}
      >
        <div className="flex items-start gap-1">
          <button
            type="button"
            onClick={() => onSelect(session.id)}
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
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{session.preview || relativeTime(session.updatedAt, t, locale)}</span>
          </button>
          <span className="t3-assistant-session-time">{relativeTime(session.updatedAt, t, locale)}</span>
          {/* Hover actions */}
          <span className="mt-0.5 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 touch:opacity-100 motion-reduce:opacity-100">
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
