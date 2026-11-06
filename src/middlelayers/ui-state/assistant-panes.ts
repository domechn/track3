export type AssistantPanes = { chats: boolean; context: boolean };

const assistantPanesStorageKey = "track3.ui.assistant.panes";

export function readAssistantPanes(width: number): AssistantPanes {
  const fallback = { chats: width >= 900, context: width >= 1120 };
  try {
    const raw = localStorage.getItem(assistantPanesStorageKey);
    if (!raw) return fallback;
    const stored: unknown = JSON.parse(raw);
    if (stored && typeof stored === "object" && !Array.isArray(stored)
      && "chats" in stored && typeof stored.chats === "boolean"
      && "context" in stored && typeof stored.context === "boolean") {
      return { chats: stored.chats, context: stored.context };
    }
  } catch {
    // Corrupt or unavailable local storage leaves the page usable.
  }
  return fallback;
}

export function writeAssistantPanes(panes: AssistantPanes): void {
  try {
    localStorage.setItem(assistantPanesStorageKey, JSON.stringify(panes));
  } catch {
    // The in-memory choice still works when storage is unavailable.
  }
}
