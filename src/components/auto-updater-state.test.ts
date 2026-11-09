import { describe, expect, it } from "vitest";
import { initialUpdateState, updateReducer } from "./auto-updater-state";

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
