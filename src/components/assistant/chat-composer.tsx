import { useEffect, useRef } from "react";
import { useTranslation } from "@/i18n";
import {
  KeyboardIcon,
  PaperPlaneIcon,
  ReloadIcon,
  StopIcon,
} from "@radix-ui/react-icons";

export default function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Autofocus on mount for a faster first interaction.
    textareaRef.current?.focus();
  }, []);

  // Auto-resize the textarea up to a comfortable cap so long prompts
  // don't feel cramped. Cap at ~6 rows worth of height.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 6 * 24 + 16; // ~6 rows of 24px line-height + padding
    const next = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${next}px`;
  }, [value]);

  const canSend = !isStreaming && value.trim().length > 0 && !disabled;

  return (
    <div className="shrink-0 border-t border-[var(--glass-border)] bg-card/70 p-3 backdrop-blur-sm shadow-[0_-6px_18px_-10px_rgba(0,0,0,0.18)]">
      <div className="flex items-end gap-2 rounded-xl border border-[var(--glass-border)] bg-background/60 p-2 shadow-sm transition-colors focus-within:border-primary/40 focus-within:bg-background/80">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) {
                onSend();
              }
            }
          }}
          placeholder={t("assistant.chat.placeholder")}
          rows={1}
          disabled={disabled}
          className="min-h-[36px] max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
          data-testid="chat-input"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            aria-label={t("assistant.chat.stop")}
            data-testid="chat-stop"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-destructive px-3 text-xs font-medium text-destructive-foreground transition-all duration-200 ease-out hover:bg-destructive/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <StopIcon className="h-3.5 w-3.5" />
            {t("assistant.chat.stop")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSend}
            disabled={!canSend}
            aria-label={t("assistant.chat.send")}
            data-testid="chat-send"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all duration-200 ease-out hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <PaperPlaneIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <KeyboardIcon className="h-3 w-3" />
          {t("assistant.chat.composer.hint")}
        </span>
        {isStreaming && (
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <ReloadIcon className="h-3 w-3 animate-spin" />
            {t("assistant.chat.streaming")}
          </span>
        )}
      </div>
    </div>
  );
}
