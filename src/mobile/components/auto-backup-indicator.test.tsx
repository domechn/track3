import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import AutoBackupIndicator from "@/mobile/components/auto-backup-indicator";
import { isIOS } from "@/utils/platform";

vi.mock("@/utils/platform", () => ({ isIOS: vi.fn(() => true) }));

it("shows backup progress without a hover gesture on iPhone", () => {
  render(<AutoBackupIndicator status="running" />);
  expect(screen.getByRole("status")).toHaveTextContent("Backing up");
  expect(screen.getByRole("status")).toHaveTextContent("automatically");
  vi.mocked(isIOS).mockReturnValue(false);
});
