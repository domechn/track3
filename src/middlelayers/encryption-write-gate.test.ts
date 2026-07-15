import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetEncryptionWriteGateForTests,
  runEncryptionKeyRotation,
  runWithEncryptionWriteGate,
} from "./encryption-write-gate";

describe("encryption write gate", () => {
  beforeEach(() => {
    resetEncryptionWriteGateForTests();
  });

  it("runs sensitive operations one at a time in submission order", async () => {
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = runWithEncryptionWriteGate(async () => {
      events.push("first:start");
      await firstBlocked;
      events.push("first:end");
    });
    const second = runWithEncryptionWriteGate(async () => {
      events.push("second");
    });

    await Promise.resolve();
    expect(events).toEqual(["first:start"]);

    releaseFirst?.();
    await Promise.all([first, second]);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("continues servicing operations after a rejection", async () => {
    const rejected = runWithEncryptionWriteGate(async () => {
      throw new Error("write failed");
    });
    const recovered = runWithEncryptionWriteGate(async () => "completed");

    await expect(rejected).rejects.toThrow("write failed");
    await expect(recovered).resolves.toBe("completed");
  });

  it("poisons queued and future writes after recovery becomes required", async () => {
    const recoveryRequired = {
      code: "recovery_required",
      message: "Restart Track3",
    };
    const rotation = runEncryptionKeyRotation(async () => {
      throw recoveryRequired;
    });
    const queuedOperation = vi.fn(async () => "queued");
    const queued = runWithEncryptionWriteGate(queuedOperation);

    await expect(rotation).rejects.toBe(recoveryRequired);
    await expect(queued).rejects.toThrow("Restart Track3");
    expect(queuedOperation).not.toHaveBeenCalled();

    const futureOperation = vi.fn(async () => "future");
    await expect(runWithEncryptionWriteGate(futureOperation)).rejects.toThrow(
      "Restart Track3",
    );
    expect(futureOperation).not.toHaveBeenCalled();
  });

  it("releases the gate after a structured rollback-safe error", async () => {
    const failed = {
      code: "failed",
      message: "rotation rolled back",
    };
    const rotation = runEncryptionKeyRotation(async () => {
      throw failed;
    });
    const recovered = runWithEncryptionWriteGate(async () => "completed");

    await expect(rotation).rejects.toBe(failed);
    await expect(recovered).resolves.toBe("completed");
  });

  it("does not infer recovery state from an error string", async () => {
    const rotation = runEncryptionKeyRotation(async () => {
      throw new Error("recovery_required: restart Track3");
    });
    const recovered = runWithEncryptionWriteGate(async () => "completed");

    await expect(rotation).rejects.toThrow("recovery_required");
    await expect(recovered).resolves.toBe("completed");
  });
});
