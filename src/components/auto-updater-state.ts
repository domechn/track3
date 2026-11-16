export type UpdatePhase = "none" | "checking" | "available" | "notes" | "connecting" | "downloading" | "verifying" | "installing" | "restart-required" | "failed" | "cancelled";
export type FailureReason = "network" | "http" | "signature" | "install" | "other";
export type UpdateState = { phase: UpdatePhase; visible: boolean; total: number | null; received: number; percent: number | null; speed: number | null; etaSeconds: number | null; reason: FailureReason | null; details: string };
export type UpdateAction =
  | { type: "check" | "available" | "none" | "notes" | "connect" | "verify" | "install" | "ready" | "cancel" | "hide" | "show" }
  | { type: "started"; total?: number }
  | { type: "progress"; bytes: number; elapsedMs: number }
  | { type: "fail"; reason: FailureReason; details: string };
export const initialUpdateState: UpdateState = { phase: "none", visible: true, total: null, received: 0, percent: null, speed: null, etaSeconds: null, reason: null, details: "" };
const active = ["connecting", "downloading", "verifying", "installing"] as const;
const shown = [...active, "restart-required", "failed", "cancelled"] as const;
// The phases each action is dispatched from (docs/state-machines/app.md). The reducer accepts every action; this table documents and warns, it does not guard.
export const updateTransitions: Record<UpdateAction["type"], readonly UpdatePhase[]> = {
  check: ["none"],
  available: ["checking", "notes"],
  none: ["checking", "available", "notes", "failed", "cancelled"],
  notes: ["available"],
  connect: ["none", "checking", "available", "notes", "failed", "cancelled"],
  started: ["connecting"],
  progress: ["downloading"],
  verify: ["connecting", "downloading"],
  install: ["connecting", "downloading", "verifying"],
  ready: ["installing"],
  fail: active,
  cancel: ["connecting", "downloading"],
  hide: shown,
  show: shown,
};
export const isExpectedTransition = (phase: UpdatePhase, action: UpdateAction) => updateTransitions[action.type].includes(phase);
const reported = new Set<string>();
export function updateReducer(state: UpdateState, action: UpdateAction): UpdateState {
  if (import.meta.env.DEV && !isExpectedTransition(state.phase, action)) {
    const pair = `${action.type} from ${state.phase}`;
    if (!reported.has(pair)) { reported.add(pair); console.warn(`Unexpected updater transition: ${pair}`); }
  }
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
