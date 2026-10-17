import { describe, expect, it } from "vitest";
import { FullRefreshRequiredError } from "./refresh-error";

describe("refresh errors", () => {
  it("does not retain an embedded secret in its message", () => {
    const error = new FullRefreshRequiredError("Refresh failed: sk-abcdefghijklmnop1234567890");
    expect(error.message).not.toContain("sk-abcdefghijklmnop1234567890");
  });
});
