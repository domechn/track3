import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import AutoBackupIndicator from "./auto-backup-indicator";

it("renders nothing while idle", () => {
  const { container } = render(<AutoBackupIndicator status="idle" />);
  expect(container).toBeEmptyDOMElement();
});

it("marks the indicator as running", () => {
  render(<AutoBackupIndicator status="running" />);
  expect(screen.getByRole("status")).toHaveAccessibleName("Backing up data");
  expect(screen.getByRole("status")).toHaveAttribute("data-state", "running");
});
