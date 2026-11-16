import { describe, expect, it, vi } from "vitest";
import { initialUpdateState, isExpectedTransition, updateReducer, updateTransitions, type UpdateAction, type UpdatePhase } from "./auto-updater-state";

describe("updater state", () => {
  it("moves through check, connect, download, verify, install and restart", () => {
    let state = updateReducer(initialUpdateState, { type: "check" });
    expect(state.phase).toBe("checking");
    state = updateReducer(state, { type: "available" });
    expect(state.phase).toBe("available");
    state = updateReducer(state, { type: "connect" });
    expect(state.phase).toBe("connecting");
    state = updateReducer(state, { type: "started", total: 1000 });
    state = updateReducer(state, { type: "progress", bytes: 250, elapsedMs: 1000 });
    expect(state).toMatchObject({ phase: "downloading", total: 1000, received: 250, percent: 25, speed: 250, etaSeconds: 3 });
    state = updateReducer(state, { type: "verify" });
    expect(state.phase).toBe("verifying");
    state = updateReducer(state, { type: "install" });
    expect(state.phase).toBe("installing");
    state = updateReducer(state, { type: "ready" });
    expect(state.phase).toBe("restart-required");
  });

  it("keeps an unknown total indeterminate and can cancel", () => {
    let state = updateReducer(initialUpdateState, { type: "connect" });
    state = updateReducer(state, { type: "started" });
    state = updateReducer(state, { type: "progress", bytes: 50, elapsedMs: 1000 });
    expect(state).toMatchObject({ phase: "downloading", total: null, percent: null, received: 50 });
    state = updateReducer(state, { type: "cancel" });
    expect(state.phase).toBe("cancelled");
  });

  it("records a failed reason and resets bytes for a fresh attempt", () => {
    let state = updateReducer(initialUpdateState, { type: "started", total: 100 });
    state = updateReducer(state, { type: "progress", bytes: 50, elapsedMs: 1000 });
    state = updateReducer(state, { type: "fail", reason: "network", details: "HTTP 503" });
    expect(state).toMatchObject({ phase: "failed", reason: "network", details: "HTTP 503", received: 50 });
    state = updateReducer(state, { type: "connect" });
    expect(state).toMatchObject({ phase: "connecting", received: 0, total: null, reason: null });
  });

  it("hides and restores notes, progress and completed states", () => {
    let state = updateReducer(initialUpdateState, { type: "available" });
    state = updateReducer(state, { type: "notes" });
    expect(state.phase).toBe("notes");
    state = updateReducer(state, { type: "connect" });
    state = updateReducer(state, { type: "hide" });
    expect(state).toMatchObject({ phase: "connecting", visible: false });
    state = updateReducer(state, { type: "show" });
    expect(state.visible).toBe(true);
    state = updateReducer(state, { type: "none" });
    expect(state.phase).toBe("none");
  });
});

// Every (phase, action) pair the component can dispatch, taken from its dispatch sites.
const active: UpdatePhase[] = ["connecting", "downloading", "verifying", "installing"];
const dispatched: [UpdateAction, UpdatePhase[], UpdatePhase | "same"][] = [
  [{ type: "check" }, ["none"], "checking"],
  [{ type: "available" }, ["checking", "notes"], "available"],
  [{ type: "none" }, ["checking", "available", "notes", "failed", "cancelled"], "none"],
  [{ type: "notes" }, ["available"], "notes"],
  [{ type: "connect" }, ["none", "checking", "available", "notes", "failed", "cancelled"], "connecting"],
  [{ type: "started", total: 100 }, ["connecting"], "downloading"],
  [{ type: "progress", bytes: 10, elapsedMs: 1000 }, ["downloading"], "downloading"],
  [{ type: "verify" }, ["connecting", "downloading"], "verifying"],
  [{ type: "install" }, ["connecting", "downloading", "verifying"], "installing"],
  [{ type: "ready" }, ["installing"], "restart-required"],
  [{ type: "fail", reason: "network", details: "HTTP 503" }, active, "failed"],
  [{ type: "cancel" }, ["connecting", "downloading"], "cancelled"],
  [{ type: "hide" }, [...active, "restart-required", "failed", "cancelled"], "same"],
  [{ type: "show" }, [...active, "restart-required", "failed", "cancelled"], "same"],
];
const pairs = dispatched.flatMap(([action, from, to]) => from.map((phase) => [phase, action, to === "same" ? phase : to] as const));

describe("updater transition table", () => {
  it.each(pairs)("%s + %o gives %s", (from, action, to) => {
    const next = updateReducer({ ...initialUpdateState, phase: from }, action);
    expect(next.phase).toBe(to);
    if (action.type === "hide") expect(next.visible).toBe(false);
    if (action.type === "show" || action.type === "fail" || action.type === "cancel" || action.type === "ready") expect(next.visible).toBe(true);
  });
});

describe("exported updater transition table", () => {
  it("lists exactly the pairs the component dispatches", () => {
    const expected = Object.fromEntries(dispatched.map(([action, from]) => [action.type, [...from].sort()]));
    const actual = Object.fromEntries(Object.entries(updateTransitions).map(([type, from]) => [type, [...from].sort()]));
    expect(actual).toEqual(expected);
    for (const [phase, action] of pairs) expect(isExpectedTransition(phase, action)).toBe(true);
  });

  it("still accepts a pair outside the table and reports it once", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const state = { ...initialUpdateState, phase: "restart-required" as const };
      expect(isExpectedTransition("restart-required", { type: "notes" })).toBe(false);
      expect(updateReducer(state, { type: "notes" }).phase).toBe("notes");
      expect(updateReducer(state, { type: "notes" }).phase).toBe("notes");
      expect(warn.mock.calls.filter(([message]) => String(message).includes("restart-required"))).toEqual([
        ["Unexpected updater transition: notes from restart-required"],
      ]);
    } finally { warn.mockRestore(); }
  });
});
