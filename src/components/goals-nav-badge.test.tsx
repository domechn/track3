import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { MainNav } from "./index/main-nav";
import Sidebar from "./sidebar";

vi.mock("./use-alert-badge", () => ({ useAlertBadge: () => 3 }));

it("announces unread alerts in the main navigation without reading a bare count", () => {
  render(<MemoryRouter><MainNav /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Goals & Alerts 3 unread alerts" })).toBeInTheDocument();
  expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
});

it("announces unread alerts in the collapsed sidebar", () => {
  render(<MemoryRouter><Sidebar collapsed onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Goals & Alerts 3 unread alerts" })).toBeInTheDocument();
  expect(screen.getByText("3")).toHaveAttribute("aria-hidden", "true");
});
