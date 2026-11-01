import { test } from "@playwright/test";
import { exerciseRecoveryFile } from "./recovery-flow";

test("exports encrypted root key and unlocks a later session from the file", async ({ page }) => {
  await exerciseRecoveryFile(page);
});
