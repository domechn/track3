export type SetupAssistantQuestion = {
  question: string;
  page: "cost-basis" | "goals" | "rebalance";
  summary: string;
};
export type PendingAssistantQuestion = SetupAssistantQuestion | { question: string };

export const PENDING_ASSISTANT_QUESTION_KEY = "track3-pending-assistant-question";

export function storePendingAssistantQuestion(value: PendingAssistantQuestion): void {
  sessionStorage.setItem(PENDING_ASSISTANT_QUESTION_KEY, JSON.stringify(value));
}

export function takePendingAssistantQuestion(): PendingAssistantQuestion | null {
  const raw = sessionStorage.getItem(PENDING_ASSISTANT_QUESTION_KEY);
  sessionStorage.removeItem(PENDING_ASSISTANT_QUESTION_KEY);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (typeof candidate.question !== "string" || !candidate.question.trim()) return null;
    if (candidate.page === undefined) return { question: candidate.question };
    return ["cost-basis", "goals", "rebalance"].includes(String(candidate.page)) &&
      typeof candidate.summary === "string" ? candidate as SetupAssistantQuestion : null;
  } catch {
    return null;
  }
}
