import { useEffect, useMemo, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRightIcon,
  BarChartIcon,
  ClockIcon,
  DashboardIcon,
  GearIcon,
  MagicWandIcon,
  MixIcon,
  PieChartIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import MessageBubble from "./message-bubble";
import type { ChatMessage } from "./use-chat";

type CapabilityKey =
  | "assistant.chat.capabilities.summary"
  | "assistant.chat.capabilities.history"
  | "assistant.chat.capabilities.compare"
  | "assistant.chat.capabilities.market"
  | "assistant.chat.capabilities.health"
  | "assistant.chat.capabilities.recent";

const CAPABILITIES: Array<{ key: CapabilityKey; Icon: React.ComponentType<{ className?: string }> }> = [
  { key: "assistant.chat.capabilities.summary", Icon: PieChartIcon },
  { key: "assistant.chat.capabilities.history", Icon: BarChartIcon },
  { key: "assistant.chat.capabilities.compare", Icon: MixIcon },
  { key: "assistant.chat.capabilities.market", Icon: DashboardIcon },
  { key: "assistant.chat.capabilities.health", Icon: MagicWandIcon },
  { key: "assistant.chat.capabilities.recent", Icon: ClockIcon },
];

type ExampleKey =
  | "assistant.chat.examples.summary"
  | "assistant.chat.examples.health"
  | "assistant.chat.examples.compare"
  | "assistant.chat.examples.activity"
  | "assistant.chat.examples.btc"
  | "assistant.chat.examples.altcoin";

const EXAMPLES: Array<{ key: ExampleKey; Icon: React.ComponentType<{ className?: string }>; tagKey: CapabilityKey }> = [
  { key: "assistant.chat.examples.summary", Icon: PieChartIcon, tagKey: "assistant.chat.capabilities.summary" },
  { key: "assistant.chat.examples.health", Icon: MagicWandIcon, tagKey: "assistant.chat.capabilities.health" },
  { key: "assistant.chat.examples.compare", Icon: MixIcon, tagKey: "assistant.chat.capabilities.compare" },
  { key: "assistant.chat.examples.activity", Icon: ClockIcon, tagKey: "assistant.chat.capabilities.recent" },
  { key: "assistant.chat.examples.btc", Icon: DashboardIcon, tagKey: "assistant.chat.capabilities.market" },
  { key: "assistant.chat.examples.altcoin", Icon: BarChartIcon, tagKey: "assistant.chat.capabilities.history" },
];

export default function ChatThread({
  messages,
  isStreaming,
  onPickPrompt,
}: {
  messages: ChatMessage[];
  isStreaming: boolean;
  onPickPrompt?: (prompt: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const userScrolledAwayRef = useRef(false);
  const isEmpty = messages.length === 0 && !isStreaming;

  // Set up scroll-position detection on the ScrollArea viewport once on mount.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // The ScrollArea's Viewport is the actual scrollable parent.
    // Radix sets data-radix-scroll-area-viewport on the viewport element.
    const viewport = el.parentElement?.closest(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    const onScroll = () => {
      const threshold = 100;
      const isAtBottom =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
        threshold;
      userScrolledAwayRef.current = !isAtBottom;
    };

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // When a new message turn starts (messages.length grows), always scroll
  // to the bottom and reset the scroll-away lock.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const viewport = el.parentElement?.closest(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    userScrolledAwayRef.current = false;
    requestAnimationFrame(() => {
      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    });
  }, [messages.length]);

  // During streaming, auto-scroll only if the user hasn't manually scrolled
  // away from the bottom of the conversation. During the think-only phase
  // (assistant has think blocks but no text blocks yet), skip auto-scroll
  // so the thinking content stays visible.
  useEffect(() => {
    if (userScrolledAwayRef.current) return;

    const el = scrollRef.current;
    if (!el) return;

    const viewport = el.parentElement?.closest(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement | null;
    if (!viewport) return;

    // If the latest assistant message has think blocks but no text blocks
    // yet, we're in the thinking phase — scrolling to the very bottom would
    // push the think content above the visible area, making it unreadable.
    const lastMsg = messages.at(-1);
    if (
      lastMsg?.role === "assistant" &&
      lastMsg.blocks.some(b => b.kind === "think") &&
      !lastMsg.blocks.some(b => b.kind === "text")
    ) {
      return;
    }

    requestAnimationFrame(() => {
      if (typeof viewport.scrollTo === "function") {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      }
    });
  }, [messages, isStreaming]);

  return (
    <ScrollArea className="flex-1">
      <div
        ref={scrollRef}
        className="flex h-full flex-col gap-3 px-3 py-4 sm:px-4 md:px-6"
        data-testid="chat-thread"
      >
        {isEmpty ? (
          <WelcomePanel onPickPrompt={onPickPrompt} />
        ) : (
          messages.map((m, i) => (
            <MessageBubble key={i} message={m} isStreaming={isStreaming} />
          ))
        )}
        {isStreaming && messages.at(-1)?.role !== "assistant" && (
          <p className="text-sm italic text-muted-foreground">
            <span className="inline-flex gap-1">
              <Dot delay="0ms" />
              <Dot delay="120ms" />
              <Dot delay="240ms" />
            </span>
          </p>
        )}
      </div>
    </ScrollArea>
  );
}

function WelcomePanel({
  onPickPrompt,
}: {
  onPickPrompt?: (prompt: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="m-auto flex w-full max-w-3xl flex-col gap-6 py-6"
      data-testid="chat-welcome"
    >
      <div className="space-y-2 text-center sm:text-left">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("assistant.chat.welcome.greeting")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("assistant.chat.welcome")}
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("assistant.chat.capabilities.title")}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {CAPABILITIES.map(({ key, Icon }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-border)] bg-card/60 px-2.5 py-1 text-xs text-foreground/80"
            >
              <Icon className="h-3 w-3 text-muted-foreground" />
              {t(key)}
            </span>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {t("assistant.chat.examples.title")}
        </p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {EXAMPLES.map(({ key, Icon, tagKey }) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => onPickPrompt?.(t(key))}
                disabled={!onPickPrompt}
                className={cn(
                  "group flex w-full items-start gap-2.5 rounded-lg border border-[var(--glass-border)] bg-card/60 p-3 text-left text-sm",
                  "transition-all duration-200 ease-out",
                  "hover:border-primary/40 hover:bg-card/80",
                  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  "motion-reduce:transition-none",
                  !onPickPrompt && "cursor-default opacity-90",
                )}
                data-testid={`chat-example-${key.split(".").pop()}`}
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {t(tagKey)}
                  </span>
                  <span className="mt-0.5 block text-sm leading-snug text-foreground/90">
                    {t(key)}
                  </span>
                </span>
                <ArrowRightIcon
                  aria-hidden
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground motion-reduce:transition-none"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}
