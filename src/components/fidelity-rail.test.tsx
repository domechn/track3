import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FidelityRail from "./fidelity-rail";

vi.mock("./use-alert-badge", () => ({ useAlertBadge: () => 2 }));
vi.mock("./sync-status-indicator", () => ({ default: () => null }));

it("hides Assistant from non-Pro users and announces unread Goals alerts", () => {
  render(<MemoryRouter><FidelityRail isProUser={false} /></MemoryRouter>);
  expect(screen.queryByRole("link", { name: "Assistant" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Goals & Alerts 2 unread alerts" })).toBeInTheDocument();
});

it("shows Assistant to Pro users", () => {
  render(<MemoryRouter><FidelityRail isProUser /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Assistant" })).toBeInTheDocument();
});
