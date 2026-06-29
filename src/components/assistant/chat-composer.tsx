import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/i18n";
import { v4 as uuidv4 } from "uuid";
import { mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import {
  KeyboardIcon,
  PaperPlaneIcon,
  ReloadIcon,
  StopIcon,
  Cross2Icon,
} from "@radix-ui/react-icons";

type ImageAttachment = {
  id: string;
  path: string;
  previewUrl: string;
  mimeType: string;
};

async function saveAttachment(file: File): Promise<ImageAttachment> {
  const base = await appDataDir();
  const dir = `${base.replace(/\/+$/, "")}/ai/attachments`;
  await mkdir(dir, { recursive: true });
  const id = uuidv4();
  const ext = file.name.split(".").pop() || "png";
  const path = `${dir}/${id}.${ext}`;
  const buffer = await file.arrayBuffer();
  await writeFile(path, new Uint8Array(buffer));
  return {
    id,
    path,
    previewUrl: URL.createObjectURL(file),
    mimeType: file.type || `image/${ext}`,
  };
}

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
  onSend: (text?: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [attachments, setAttachments] = useState<ImageAttachment[]>([]);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);

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

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageItem = Array.from(items).find((item) =>
      item.type.startsWith("image/"),
    );
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    saveAttachment(file)
      .then((attachment) => {
        setAttachments((prev) => [...prev, attachment]);
      })
      .catch((err) => console.error("Failed to save pasted image:", err));
  }, []);

// Resize large images before base64 encoding to save AI context window.
// Most vision models don't need full resolution — 2048px is plenty.
async function imageToCompressedBase64(
  path: string,
  mimeType: string,
): Promise<string> {
  const data = await readFile(path);
  const blob = new Blob([data], { type: mimeType });
  const img = await createImageBitmap(blob);
  let { width, height } = img;
  const MAX_DIM = 2048;
  if (width > MAX_DIM || height > MAX_DIM) {
    const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx?.drawImage(img, 0, 0, width, height);
  img.close();
  const compressedBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), mimeType === "image/png" ? "image/jpeg" : mimeType, 0.8),
  );
  const buffer = await compressedBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

  const handleSend = useCallback(async () => {
    if (attachments.length > 0) {
      const imageParts = await Promise.all(
        attachments.map(async (a) => {
          const dataUrl = await imageToCompressedBase64(a.path, a.mimeType);
          return `![image](${dataUrl})`;
        }),
      );
      const text = valueRef.current.trim();
      const fullText = text
        ? [...imageParts, text].join("\n\n")
        : imageParts.join("\n\n");
      onSend(fullText);
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);
    } else {
      onSend();
    }
  }, [attachments, onSend]);

  return (
    <div className="shrink-0 border-t border-[var(--glass-border)] bg-card/70 p-3 backdrop-blur-sm shadow-[0_-6px_18px_-10px_rgba(0,0,0,0.18)]">
      <div className="rounded-xl border border-[var(--glass-border)] bg-background/60 shadow-sm transition-colors focus-within:border-primary/40 focus-within:bg-background/80">
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pt-2">
            {attachments.map((a) => (
              <div key={a.id} className="group relative">
                <img
                  src={a.previewUrl}
                  className="h-14 w-14 rounded-md border border-[var(--glass-border)] object-cover"
                  alt=""
                />
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  <Cross2Icon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 p-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) {
                handleSend();
              }
            }
          }}
          placeholder={t("assistant.chat.placeholder")}
          rows={1}
          disabled={disabled}
          className="min-h-[36px] max-h-40 flex-1 resize-none border-0 bg-transparent px-2 py-1.5 text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-0 disabled:opacity-50"
          data-testid="chat-input"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          autoComplete="off"
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
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label={t("assistant.chat.send")}
            data-testid="chat-send"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all duration-200 ease-out hover:bg-primary/90 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <PaperPlaneIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
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
