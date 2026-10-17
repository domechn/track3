import { redactSecrets } from "./security/redact";

export class FullRefreshRequiredError extends Error {
  name = "FullRefreshRequiredError";

  constructor(message?: string) {
    super(message === undefined ? undefined : redactSecrets(message));
  }
}
