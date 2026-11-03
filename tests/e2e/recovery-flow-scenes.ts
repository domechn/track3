import { type Page } from "@playwright/test";
import { exerciseRecoveryFile as exerciseSharedRecoveryFile } from "./recovery-flow";

export async function exerciseRecoveryFile(page: Page) {
  await page.addLocatorHandler(page.getByRole("button", { name: "Continue without sync" }),
    async (button) => { await button.click(); });
  await exerciseSharedRecoveryFile(page);
}
