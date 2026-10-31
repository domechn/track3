import { expect, it } from "vitest";
import { persistedToRuntime, runtimeToPersisted } from "./chat-persist";

it("persists only visible text and pending actions with usage metadata", () => {
  const msg = { role: "assistant" as const, contextTokens: 0, blocks: [
    { kind: "text" as const, text: "  " }, { kind: "text" as const, text: "hello" },
    { kind: "think" as const, text: "hidden" },
  ] };
  expect(runtimeToPersisted(msg)).toEqual({ role: "assistant", contextTokens: 0, blocks: [{ kind: "text", text: "hello" }] });
});

it("loads only text and pending action blocks", () => {
  const msg = { role: "assistant" as const, blocks: [
    { kind: "text" as const, text: "hello" }, { kind: "tool_call" as const, name: "x", args: {} },
  ] };
  expect(persistedToRuntime(msg as Parameters<typeof persistedToRuntime>[0])).toEqual({ role: "assistant", blocks: [{ kind: "text", text: "hello" }] });
});

it("consumes the pending insight question once", async () => {
  const { takeInsightQuestion } = await import("./chat-persist");
  sessionStorage.setItem("track3-insight-question", "what changed?");
  expect(takeInsightQuestion()).toBe("what changed?");
  expect(takeInsightQuestion()).toBeNull();
});
