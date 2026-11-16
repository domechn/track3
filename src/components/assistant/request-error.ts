import type { AssistantBlock } from "./use-chat";

export type RequestError = { before: string; detail: string; httpStatus?: string };

// A failed request is stored inside the reply text as "\n\n[error] <reason>".
// The marker only counts at the start of the text or of a line, so a model
// that writes "[error]" inside a sentence is not shown as a failure.
export function splitRequestError(text: string): RequestError | null {
  const marker = /(?:^|\n)\[error\][ \t]*/i.exec(text);
  if (!marker) return null;
  const detail = text.slice(marker.index + marker[0].length).trim();
  return {
    before: text.slice(0, marker.index).trim(),
    detail,
    httpStatus: /\b(?:HTTP|status)\s+(\d{3})\b/i.exec(detail)?.[1],
  };
}

export function isRequestError(block: AssistantBlock): boolean {
  return block.kind === "text" && splitRequestError(block.text) !== null;
}
