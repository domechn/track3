import { useCallback, useMemo } from "react";
import { useTranslation } from "@/i18n";
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

export default function SessionSidebar({
  sessions,
  activeId,
  processingId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
  onPin,
}: SessionSidebarProps) {
  const { t } = useTranslation();

  const pinned = useMemo(() => sessions.filter((s) => s.pinned === 1), [sessions]);
  const recent = useMemo(() => sessions.filter((s) => s.pinned === 0), [sessions]);

  return (
    <div
      className="flex w-[260px] shrink-0 flex-col border-r border-[var(--glass-border)] bg-card/40"
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

function SessionItem({
  session,
  isActive,
  isProcessing = false,
  onSelect,
  onDelete,
  onPin,
  t,
}: {
  session: ChatSessionMeta;
  isActive: boolean;
  isProcessing?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  t: (key: string) => string;
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
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {relativeTime(session.updatedAt, t)}
            </span>
          </button>
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
