import { useEffect, useRef, useState } from "react";
import {
  ChatBubbleIcon,
  ChevronDownIcon,
  CopyIcon,
  PersonIcon,
  CheckIcon,
} from "@radix-ui/react-icons";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/mobile/i18n";
import MarkdownRenderer from "@/components/assistant/markdown-renderer";
import type { AssistantBlock, ChatMessage } from "@/components/assistant/use-chat";
import UsageLabel from "@/components/assistant/usage-label";
import ActionCard from "@/components/assistant/action-card";
import PhoneActionCard from "@/mobile/components/assistant/phone-action-card";
import { isIOS } from "@/utils/platform";
import { FidelityIcon } from "@/mobile/components/fidelity-icon";
import type { CurrencyRateDetail } from "@/middlelayers/types";

function stripThinkTags(s: string): string {
  return s.replace(/<\/?think\s*>/gi, "").trim();
}

function ThinkBlock({ text, isStreaming, hasResponseStarted }: {
  text: string;
  isStreaming?: boolean;
  hasResponseStarted?: boolean;
}) {
  const [expanded, setExpanded] = useState(!isIOS());
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
          {isThinkingPhase && (
            <span
              aria-hidden
              data-testid="thinking-stream-indicator"
              className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground"
            />
          )}
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
          <p className="whitespace-pre-wrap break-words text-xs italic leading-relaxed text-muted-foreground">
            {displayText}
          </p>
        </div>
      )}
    </div>
  );
}

/** Merge consecutive text and think blocks for continuous rendering. */
function mergeBlocks(blocks: AssistantBlock[]): AssistantBlock[] {
  const merged: AssistantBlock[] = [];
  let pendingText = "";
  for (const b of blocks) {
    if (b.kind === "text") {
      if (!b.text.trim()) continue;
      pendingText = pendingText ? pendingText + "\n\n" + b.text : b.text;
    } else {
      if (pendingText) {
        merged.push({ kind: "text", text: pendingText });
        pendingText = "";
      }
      const last = merged[merged.length - 1];
      if (b.kind === "think" && last?.kind === "think") {
        merged[merged.length - 1] = { kind: "think", text: last.text + "\n\n" + b.text };
      } else {
        merged.push(b);
      }
    }
  }
  if (pendingText) merged.push({ kind: "text", text: pendingText });
  return merged;
}

function renderAssistantBlock(block: AssistantBlock, idx: number, isStreaming?: boolean, hasResponseStarted?: boolean,
  onDecideAction?: (id: string, decision: "approve" | "reject") => void, canDecideAction?: boolean,
  t?: (key: string) => string, onRetry?: () => void, baseCurrency?: CurrencyRateDetail) {
  if (block.kind === "think") {
    return <ThinkBlock key={idx} text={block.text} isStreaming={isStreaming} hasResponseStarted={hasResponseStarted} />;
  }
  if (block.kind === "text") {
    if (!block.text) return null;
    const errorAt = isIOS() ? block.text.indexOf("[error]") : -1;
    if (errorAt >= 0) {
      const before = block.text.slice(0, errorAt).trim();
      const detail = block.text.slice(errorAt + 7).trim();
      return <div key={idx}>
        {before && <MarkdownRenderer content={stripThinkTags(before)} signedValues />}
        <div className="fidelity-chat-error" role="alert">
          <FidelityIcon name="alert" />
          <div>
            <strong>{t?.("fidelity.assistant.requestFailed")}</strong>
            <p>{t?.("fidelity.assistant.messageSaved")}</p>
            <div className="fidelity-chat-error-actions">
              <button type="button" onClick={onRetry}><FidelityIcon name="refresh" />{t?.("fidelity.assistant.retry")}</button>
              <Link to="/settings/assistant">{t?.("fidelity.assistant.aiSettings")}</Link>
            </div>
            <p className="fidelity-chat-error-detail">{t?.("fidelity.assistant.details").replace("{detail}", detail)}</p>
          </div>
        </div>
      </div>;
    }
    return (
      <div key={idx} className="markdown-content">
        <MarkdownRenderer content={stripThinkTags(block.text)} signedValues={isIOS()} />
      </div>
    );
  }
  if (block.kind === "agent_activity") {
    const activities = block.activities;
    if (activities.length === 0) return null;
    const state = activities.some((activity) => activity.status === "failed") ? "failed"
      : activities.some((activity) => activity.status !== "completed") ? "running" : "done";
    const content = (
      <div className="space-y-1 px-1 py-2">
        {activities.map((a) => (
          <div key={a.taskId} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-block h-2 w-2 rounded-full ${
              a.status === "completed" ? "bg-green-500" :
              a.status === "failed" ? "bg-red-500" :
              "bg-yellow-500 animate-pulse"
            }`} />
            <span className="flex-1 truncate">{a.description}</span>
            {a.status === "completed" && a.resultPreview && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{a.resultPreview}</span>
            )}
          </div>
        ))}
      </div>
    );
    return isIOS()
      ? <details key={idx} className="ios-d3-tool-activity fidelity-tool-activity">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
            <span className="sr-only">{t?.("assistant.chat.toolActivity")}</span>
            <span className="sr-only">{t?.(activities.length === 1 ? "assistant.chat.toolSummary.one" : "assistant.chat.toolSummary.many")
              ?.replace("{count}", String(activities.length)).replace("{status}", t?.(`assistant.chat.toolStatus.${state}`) ?? state)}</span>
            <span className="fidelity-tool-pills">
              {activities.map((activity) => <span key={activity.taskId}
                className="t3-tag fidelity-tool-pill" data-tone={activity.status === "completed" ? "positive" : activity.status === "failed" ? "negative" : "accent"}>
                <span className={`ios-d3-tool-status ios-d3-tool-status-${activity.status === "completed" ? "done" : activity.status}`} aria-hidden="true" />
                <span>{activity.description}</span>
                <small>{activity.status === "completed" && activity.resultPreview
                  ? activity.resultPreview : t?.(`assistant.chat.toolStatus.${activity.status === "completed" ? "done" : activity.status}`)}</small>
              </span>)}
            </span>
            <ChevronDownIcon className="ios-d3-tool-chevron ml-auto h-4 w-4" aria-hidden="true" />
          </summary>
          {content}
        </details>
      : <div key={idx}>{content}</div>;
  }
  if (block.kind === "pending_action") {
    return isIOS()
      ? <PhoneActionCard key={block.id} action={block} onDecide={onDecideAction} canDecide={canDecideAction} baseCurrency={baseCurrency} />
      : <ActionCard key={block.id} action={block} onDecide={onDecideAction} canDecide={canDecideAction} />;
  }
}

export default function MessageBubble({
  message,
  at,
  isStreaming,
  pricePerMillionTokens,
  inputPricePerMillionTokens,
  outputPricePerMillionTokens,
  onDecideAction,
  canDecideAction,
  model,
  onRetry,
  precedingApprovedAlert,
  baseCurrency,
}: {
  message: ChatMessage;
  at?: string;
  isStreaming?: boolean;
  pricePerMillionTokens?: number;
  inputPricePerMillionTokens?: number;
  outputPricePerMillionTokens?: number;
  onDecideAction?: (id: string, decision: "approve" | "reject") => void;
  canDecideAction?: boolean;
  model?: string;
  onRetry?: () => void;
  precedingApprovedAlert?: { symbol: string; threshold: number };
  baseCurrency?: CurrencyRateDetail;
}) {
  const { t } = useTranslation();
  const isUser = message.role === "user";
  const blocks = isUser ? [] : mergeBlocks(message.blocks);
  const messageAt = at;
  const time = messageAt ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(messageAt)) : null;

  return (
    <div
      className={cn(
        "ios-d3-chat-bubble flex w-full flex-wrap gap-2",
        isUser ? "justify-end" : "justify-start",
      )}
      data-testid={isUser ? "user-bubble" : "assistant-bubble"}
      data-streaming={!isUser && Boolean(isStreaming)}
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
        data-selectable=""
        className={cn(
          "ios-d3-chat-body",
          isUser ? "max-w-full" : "flex-1 min-w-0",
          "rounded-2xl px-4 py-3 shadow-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "border border-[var(--glass-border)] bg-card/80",
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {message.content}
          </p>
      ) : (
          <div className="space-y-3">
            <div className="assistant-message-label text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {t("assistant.chat.title")}
            </div>
            {blocks.length === 0 && isStreaming ? (
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
              <>
              {isIOS() && precedingApprovedAlert && <div className="t3-tag fidelity-created-chip" data-tone="positive"><CheckIcon aria-hidden="true" />
                <strong>{t("fidelity.assistant.createdAlert")}</strong>
                <span>{t("fidelity.assistant.createdAlertDetail").replace("{symbol}", precedingApprovedAlert.symbol)
                  .replace("{threshold}", new Intl.NumberFormat("en-US", { style: "currency", currency: "USD",
                    minimumFractionDigits: Number.isInteger(precedingApprovedAlert.threshold) ? 0 : 2,
                    maximumFractionDigits: 2 }).format(precedingApprovedAlert.threshold))}</span></div>}
              {blocks.map((b, i) => renderAssistantBlock(
                b, i, isStreaming, blocks.slice(i + 1).some((later) => later.kind === "text"),
                onDecideAction, canDecideAction, t, onRetry, baseCurrency,
              ))}
              </>
            )}
            {!isStreaming && !blocks.some((block) => block.kind === "pending_action" ||
              (block.kind === "text" && stripThinkTags(block.text))) && (
              <p className="text-sm italic text-muted-foreground">{t("assistant.chat.noResponse")}</p>
            )}
          </div>
        )}
      </div>
      {isUser && time && <span className="fidelity-chat-message-time">{time}</span>}
      {!isUser && message.usage && !(isIOS() && blocks.some((block) => block.kind === "pending_action" && block.status === "approved")) && <div className="ios-d3-chat-bubble-usage basis-full pl-9">
        {isIOS() ? <div className="fidelity-chat-usage">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m8 1 1.5 5.5L15 8l-5.5 1.5L8 15l-1.5-5.5L1 8l5.5-1.5L8 1Z" stroke="currentColor" /></svg>
          <span>{model} · {message.usage.promptTokens.toLocaleString("en-US")} in · {message.usage.completionTokens.toLocaleString("en-US")} out
            {pricePerMillionTokens !== undefined || inputPricePerMillionTokens !== undefined || outputPricePerMillionTokens !== undefined
              ? ` · about $${((message.usage.promptTokens * (inputPricePerMillionTokens ?? pricePerMillionTokens ?? 0) +
                message.usage.completionTokens * (outputPricePerMillionTokens ?? pricePerMillionTokens ?? 0)) / 1_000_000).toFixed(3)}` : ""}
          </span>
          <button type="button" aria-label={t("common.copy")} onClick={() => {
            void navigator.clipboard?.writeText(blocks.flatMap((block) => block.kind === "text" ? [block.text] : []).join("\n\n")).catch(() => {});
          }}><CopyIcon aria-hidden="true" /></button>
        </div> : <UsageLabel usage={message.usage} pricePerMillionTokens={pricePerMillionTokens}
          inputPricePerMillionTokens={inputPricePerMillionTokens} outputPricePerMillionTokens={outputPricePerMillionTokens} />}
      </div>}
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
