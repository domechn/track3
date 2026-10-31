import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { PageHeader } from "./page-header";

it("exposes breadcrumb, title, description, and actions in the shell header", () => {
  render(<PageHeader breadcrumb="Settings" title="Appearance" description="Choose how Track3 looks"
    actions={<button type="button">Apply</button>} />);
  expect(screen.getByRole("heading", { name: "Appearance", level: 1 })).toBeInTheDocument();
  expect(screen.getByText("Settings")).toBeInTheDocument();
  expect(screen.getByText("Choose how Track3 looks")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
});
