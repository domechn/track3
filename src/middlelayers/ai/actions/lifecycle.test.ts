import { describe, expect, it, vi } from "vitest";
import { resolveAction, type PendingAction } from "./lifecycle";

const pending: PendingAction = {
  kind: "pending_action", id: "one", toolCallId: "tool-1", name: "blacklist_add",
  args: { symbol: "BTC" }, preview: { before: "Absent", after: "Present" },
  risk: "low", status: "pending", createdAt: "2026-10-17T00:00:00.000Z",
  expiresAt: "2026-10-17T00:05:00.000Z",
};

describe("confirmed action lifecycle", () => {
  it("executes only once after an approved click", async () => {
    const execute = vi.fn(async () => "Done");
    const claim = vi.fn(async () => true);
    const done = vi.fn(async () => {});
    await resolveAction(pending, "approve", "session-a", "session-a", claim, done, execute, new Date("2026-10-17T00:01:00Z"));
    await resolveAction(pending, "approve", "session-a", "session-a", async () => false, done, execute, new Date("2026-10-17T00:01:00Z"));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejects, expires, and invalidates on session change without execution", async () => {
    const execute = vi.fn(async () => "Done");
    const claim = vi.fn(async () => true);
    const done = vi.fn(async () => {});
    expect((await resolveAction(pending, "reject", "a", "a", claim, done, execute, new Date("2026-10-17T00:01:00Z"))).status).toBe("rejected");
    expect((await resolveAction(pending, "approve", "a", "b", claim, done, execute, new Date("2026-10-17T00:01:00Z"))).status).toBe("pending");
    expect((await resolveAction(pending, "approve", "a", "a", claim, done, execute, new Date("2026-10-17T00:06:00Z"))).status).toBe("expired");
    expect(execute).not.toHaveBeenCalled();
  });
  it("cancels execution if the session changes while an approval is being claimed", async () => {
    let active = "a";
    const execute = vi.fn(async () => "Done");
    const finish = vi.fn(async () => {});
    const result = await resolveAction(pending, "approve", "a", () => active,
      async () => { active = "b"; return true; }, finish, execute, new Date("2026-10-17T00:01:00Z"));
    expect(execute).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
  });
  it("does not record a successful write as failed when saving its result fails", async () => {
    const finish = vi.fn(async () => { throw new Error("disk unavailable"); });
    await expect(resolveAction(pending, "approve", "a", "a", async () => true, finish,
      async () => "Done", new Date("2026-10-17T00:01:00Z"))).rejects.toThrow("disk unavailable");
    expect(finish).toHaveBeenCalledTimes(1);
  });
});
