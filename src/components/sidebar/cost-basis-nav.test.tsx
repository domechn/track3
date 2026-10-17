import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import Sidebar from "./index";

vi.mock("../use-alert-badge", () => ({ useAlertBadge: () => 2 }));

it("offers a cost basis report navigation link", () => {
  render(<MemoryRouter><Sidebar collapsed={false} onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Cost basis" })).toHaveAttribute("href", "/cost-basis");
});

it("keeps the destination in the accessible name when an unread badge is shown", () => {
  render(<MemoryRouter><Sidebar collapsed onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Goals & Alerts 2 unread alerts" })).toHaveAttribute("href", "/goals");
});
