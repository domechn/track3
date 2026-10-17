import { beforeEach, expect, it } from "vitest";
import {
  PENDING_ASSISTANT_QUESTION_KEY, storePendingAssistantQuestion, takePendingAssistantQuestion,
} from "./pending-question";

beforeEach(() => sessionStorage.clear());

it("takes a setup request exactly once with its page context", () => {
  const question = { question: "Set BTC to 40%", page: "rebalance" as const, summary: "BTC 50%" };
  storePendingAssistantQuestion(question);
  expect(takePendingAssistantQuestion()).toEqual(question);
  expect(takePendingAssistantQuestion()).toBeNull();
});

it("keeps insight requests as a plain prefill and drops malformed payloads", () => {
  storePendingAssistantQuestion({ question: "Explain this insight" });
  expect(takePendingAssistantQuestion()).toEqual({ question: "Explain this insight" });
  sessionStorage.setItem(PENDING_ASSISTANT_QUESTION_KEY, '{"question":"hi","page":"unknown","summary":"x"}');
  expect(takePendingAssistantQuestion()).toBeNull();
});
