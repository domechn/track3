import {
  ChatBubbleIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import InlineChart from "./inline-chart";
import type { AssistantBlock, ChatMessage } from "./use-chat";

function renderAssistantBlock(block: AssistantBlock, idx: number) {
  if (block.kind === "text") {
    if (!block.text) return null;
    // Preserve newlines from streamed content while keeping typography rhythm.
    return (
      <p
        key={idx}
        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90"
      >
        {block.text}
      </p>
    );
  }
  return <InlineChart key={idx} spec={block.chart} />;
}

export default function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

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
              message.blocks.map((b, i) => renderAssistantBlock(b, i))
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
