import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BackupDesign } from "./backup-design";

vi.mock("@/components/backup-restore-list", () => ({ default: () => null }));

it("includes configuration in an export only when selected", () => {
  const setExportConfiguration = vi.fn();
  render(<BackupDesign summary={undefined} exportConfiguration={false} setExportConfiguration={setExportConfiguration}
    onExport={vi.fn(async () => {})} onReviewImport={vi.fn()} onChooseFolder={vi.fn()}
    onClearFolder={vi.fn()} onPreview={vi.fn()} locale="en" />);
  fireEvent.click(screen.getByRole("button", { name: "Configuration" }));
  expect(setExportConfiguration).toHaveBeenCalledWith(true);
});
