let pendingSensitiveWrite: Promise<void> = Promise.resolve();
let recoveryRequired = false;

export type RotationCommandError = {
  code: "failed" | "recovery_required";
  message: string;
};

const RECOVERY_REQUIRED_MESSAGE =
  "Encryption key recovery is required. Restart Track3 before making further changes.";

export function isRotationCommandError(
  error: unknown,
): error is RotationCommandError {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const candidate = error as Record<string, unknown>;
  return (
    (candidate.code === "failed" || candidate.code === "recovery_required") &&
    typeof candidate.message === "string"
  );
}

export function isRecoveryRequiredRotationError(
  error: unknown,
): error is RotationCommandError & { code: "recovery_required" } {
  return isRotationCommandError(error) && error.code === "recovery_required";
}

export function runWithEncryptionWriteGate<T>(
  operation: () => Promise<T>,
): Promise<T> {
  const result = pendingSensitiveWrite.then(() => {
    if (recoveryRequired) {
      throw new Error(RECOVERY_REQUIRED_MESSAGE);
    }
    return operation();
  });
  pendingSensitiveWrite = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export function runEncryptionKeyRotation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  return runWithEncryptionWriteGate(async () => {
    try {
      return await operation();
    } catch (error) {
      if (isRecoveryRequiredRotationError(error)) {
        recoveryRequired = true;
      }
      throw error;
    }
  });
}

export function resetEncryptionWriteGateForTests(): void {
  pendingSensitiveWrite = Promise.resolve();
  recoveryRequired = false;
}
