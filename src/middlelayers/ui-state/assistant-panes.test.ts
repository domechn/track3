import { beforeEach, expect, it } from "vitest";
import { readAssistantPanes, writeAssistantPanes } from "./assistant-panes";

beforeEach(() => localStorage.clear());

it.each([
  [1440, { chats: true, context: true }],
  [1280, { chats: true, context: true }],
  [1120, { chats: true, context: true }],
  [1119, { chats: true, context: false }],
  [1100, { chats: true, context: false }],
  [1099, { chats: true, context: false }],
  [900, { chats: true, context: false }],
  [899, { chats: false, context: false }],
])("uses the responsive pane default at %ipx without stored data", (width, expected) => {
  expect(readAssistantPanes(width)).toEqual(expected);
});

it("stores both choices in one key and restores them at any width", () => {
  writeAssistantPanes({ chats: false, context: true });
  expect(localStorage.getItem("track3.ui.assistant.panes")).toBe('{"chats":false,"context":true}');
  expect(readAssistantPanes(899)).toEqual({ chats: false, context: true });
  expect(readAssistantPanes(1440)).toEqual({ chats: false, context: true });
});

it("preserves an explicit Context choice in a 900px window", () => {
  writeAssistantPanes({ chats: true, context: true });
  expect(readAssistantPanes(900)).toEqual({ chats: true, context: true });
  expect(readAssistantPanes(1100)).toEqual({ chats: true, context: true });
});

it.each(["{", "[]", "null", '{"chats":true}', '{"chats":1,"context":false}'])(
  "falls back to the responsive default for invalid stored JSON: %s", (raw) => {
    localStorage.setItem("track3.ui.assistant.panes", raw);
    expect(readAssistantPanes(899)).toEqual({ chats: false, context: false });
  },
);

it("ignores unrelated older UI state while reading a missing key", () => {
  localStorage.setItem("track3-assistant-date-range", '{"from":"2024-01-01","to":"2024-01-31"}');
  expect(readAssistantPanes(1100)).toEqual({ chats: true, context: false });
});
