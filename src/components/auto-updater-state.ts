export type UpdatePhase = "none" | "checking" | "available" | "notes" | "connecting" | "downloading" | "verifying" | "installing" | "restart-required" | "failed" | "cancelled";
export type FailureReason = "network" | "http" | "signature" | "install" | "other";
export type UpdateState = { phase: UpdatePhase; visible: boolean; total: number | null; received: number; percent: number | null; speed: number | null; etaSeconds: number | null; reason: FailureReason | null; details: string };
export type UpdateAction =
  | { type: "check" | "available" | "none" | "notes" | "connect" | "verify" | "install" | "ready" | "cancel" | "hide" | "show" }
  | { type: "started"; total?: number }
  | { type: "progress"; bytes: number; elapsedMs: number }
  | { type: "fail"; reason: FailureReason; details: string };
export const initialUpdateState: UpdateState = { phase: "none", visible: true, total: null, received: 0, percent: null, speed: null, etaSeconds: null, reason: null, details: "" };
export function updateReducer(state: UpdateState, action: UpdateAction): UpdateState {
  switch (action.type) {
    case "check": return { ...initialUpdateState, phase: "checking" };
    case "available": return { ...state, phase: "available", visible: true };
    case "none": return { ...initialUpdateState };
    case "notes": return { ...state, phase: "notes" };
    case "connect": return { ...initialUpdateState, phase: "connecting" };
    case "started": return { ...state, phase: "downloading", total: action.total && action.total > 0 ? action.total : null };
    case "progress": {
      const received = state.received + action.bytes;
      const speed = action.elapsedMs > 0 ? received / (action.elapsedMs / 1000) : null;
      return { ...state, phase: "downloading", received, speed,
        percent: state.total ? Math.min(100, Math.round(received / state.total * 100)) : null,
        etaSeconds: state.total && speed ? Math.max(0, Math.ceil((state.total - received) / speed)) : null };
    }
    case "verify": return { ...state, phase: "verifying" };
    case "install": return { ...state, phase: "installing" };
    case "ready": return { ...state, phase: "restart-required", visible: true };
    case "fail": return { ...state, phase: "failed", reason: action.reason, details: action.details, visible: true };
    case "cancel": return { ...state, phase: "cancelled", visible: true };
    case "hide": return { ...state, visible: false };
    case "show": return { ...state, visible: true };
  }
}
