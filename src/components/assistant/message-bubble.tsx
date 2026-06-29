import { useEffect, useRef, useState } from "react";
import {
  ChatBubbleIcon,
  ChevronDownIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import InlineChart from "./inline-chart";
import type { AssistantBlock, ChatMessage } from "./use-chat";

function stripThinkTags(s: string): string {
  return s.replace(/<\/?think\s*>/gi, "").trim();
}

function ThinkBlock({ text, isStreaming, hasResponseStarted }: {
  text: string;
  isStreaming?: boolean;
  hasResponseStarted?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoCollapsedRef = useRef(false);
  const { t } = useTranslation();

  const isThinkingPhase = !!(isStreaming && !hasResponseStarted);

  // Auto-scroll the thinking content as it streams in
  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [expanded, text]);

  // Auto-collapse when the real response starts generating
  useEffect(() => {
    if (hasResponseStarted && !autoCollapsedRef.current && text) {
      setExpanded(false);
      autoCollapsedRef.current = true;
    }
  }, [hasResponseStarted, text]);

  const displayText = stripThinkTags(text);
  if (!displayText) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--glass-border)] bg-accent/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium tracking-wider text-muted-foreground hover:bg-accent/20 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center">
            <svg
              width="14"
              height="14"
              viewBox="0 0 15 15"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-muted-foreground"
            >
              <path
                d="M7.5 0C7.5 0 5.5 3 5.5 5.5C5.5 7.43 6.5 8.5 7.5 8.5C8.5 8.5 9.5 7.43 9.5 5.5C9.5 3 7.5 0 7.5 0ZM7.5 9C5.5 9 3 10.5 3 12V13C3 13.55 3.45 14 4 14H11C11.55 14 12 13.55 12 13V12C12 10.5 9.5 9 7.5 9Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </span>
          {t("assistant.chat.think.label")}
        </span>
        <ChevronDownIcon
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            expanded ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {expanded && (
        <div
          ref={scrollRef}
          className={cn(
            "overflow-y-auto overscroll-contain px-3 pb-3 scroll-smooth",
            isThinkingPhase ? "max-h-[4.5rem]" : "max-h-[300px]",
          )}
        >
          <p className="whitespace-pre-wrap break-words text-xs italic leading-relaxed text-muted-foreground/50">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}

function renderAssistantBlock(block: AssistantBlock, idx: number, isStreaming?: boolean, hasResponseStarted?: boolean) {
  if (block.kind === "think") {
    return <ThinkBlock key={idx} text={block.text} isStreaming={isStreaming} hasResponseStarted={hasResponseStarted} />;
  }
  if (block.kind === "text") {
    if (!block.text) return null;
    // Preserve newlines from streamed content while keeping typography rhythm.
    // Strip any stray <think> tags that some models emit in the content.
    return (
      <p
        key={idx}
        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90"
      >
        {stripThinkTags(block.text)}
      </p>
    );
  }
  return <InlineChart key={idx} spec={block.chart} />;
}

export default function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const hasResponseStarted = !isUser &&
    message.blocks.some(b => b.kind === "think") &&
    message.blocks.some(b => b.kind === "text");

  return (
    <div
      className={cn(
        "flex w-full gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
      data-testid={isUser ? "user-bubble" : "assistant-bubble"}
    >
      {!isUser && (
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <ChatBubbleIcon className="h-3.5 w-3.5" />
        </span>
      )}
      <div
        className={cn(
          "max-w-[min(880px,100%)] rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-[var(--glass-border)] bg-card/80 backdrop-blur",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </p>
      ) : (
          <div className="space-y-3">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("assistant.chat.title")}
            </div>
            {message.blocks.length === 0 ? (
              <p className="flex items-center gap-1 text-sm italic text-muted-foreground">
                <span className="inline-flex gap-1">
                  <span aria-hidden className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                    style={{ animationDelay: "120ms" }}
                  />
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
                    style={{ animationDelay: "240ms" }}
                  />
                </span>
                {t("assistant.chat.thinking")}
              </p>
            ) : (
              message.blocks.map((b, i) => renderAssistantBlock(b, i, isStreaming, hasResponseStarted))
            )}
          </div>
        )}
      </div>
      {isUser && (
        <span
          aria-hidden
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"
        >
          <PersonIcon className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
