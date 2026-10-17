export type ActionStatus = "pending" | "executing" | "approved" | "rejected" | "expired" | "failed";
export type PendingAction = {
  kind: "pending_action";
  id: string;
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  preview: { before: string; after: string };
  risk: "low" | "medium" | "high";
  status: ActionStatus;
  createdAt: string;
  expiresAt: string;
  result?: string;
};

export async function resolveAction(
  action: PendingAction,
  decision: "approve" | "reject",
  actionSessionId: string,
  activeSessionId: string | (() => string),
  claim: (status: ActionStatus) => Promise<boolean>,
  finish: (status: ActionStatus, result: string) => Promise<void>,
  execute: () => Promise<string>,
  now = new Date(),
): Promise<PendingAction> {
  const currentSessionId = () => typeof activeSessionId === "function" ? activeSessionId() : activeSessionId;
  if (action.status !== "pending" || actionSessionId !== currentSessionId()) return action;
  const expired = now.getTime() >= Date.parse(action.expiresAt);
  const status: ActionStatus = expired ? "expired" : decision === "reject" ? "rejected" : "executing";
  if (!await claim(status)) return action;
  if (status !== "executing") return { ...action, status };
  if (actionSessionId !== currentSessionId()) {
    const result = "Session changed before execution";
    await finish("failed", result);
    return { ...action, status: "failed", result };
  }
  let result: string;
  try {
    result = await execute();
  } catch (error) {
    const result = (error as Error).message ?? String(error);
    await finish("failed", result);
    return { ...action, status: "failed", result };
  }
  await finish("approved", result);
  return { ...action, status: "approved", result };
}
