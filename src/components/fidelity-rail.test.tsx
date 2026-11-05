import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import FidelityRail from "./fidelity-rail";

vi.mock("./use-alert-badge", () => ({ useAlertBadge: () => 2 }));
vi.mock("./sync-status-indicator", () => ({ default: () => null }));

it("hides Assistant from non-Pro users and announces unread Goals alerts", () => {
  render(<MemoryRouter><FidelityRail isProUser={false} /></MemoryRouter>);
  expect(screen.queryByRole("link", { name: "Assistant" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Goals & alerts 2 unread alerts" })).toBeInTheDocument();
});

it("shows Assistant to Pro users", () => {
  render(<MemoryRouter><FidelityRail isProUser /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Assistant" })).toBeInTheDocument();
});

it("links the two-peak Track3 mark to Overview", () => {
  render(<MemoryRouter><FidelityRail /></MemoryRouter>);
  const brand = screen.getByRole("link", { name: "Track3" });
  expect(brand).toHaveAttribute("href", "/overview");
  expect(brand.querySelectorAll("polygon")).toHaveLength(2);
});

it("uses the Settings cog in the compact fidelity rail", () => {
  render(<MemoryRouter><FidelityRail isProUser /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Settings" }).querySelector("svg")?.innerHTML)
    .toMatchInlineSnapshot(`"<circle cx="9" cy="9" r="2.5"></circle><path d="M7 1.5h4l.5 2 1.2.7 2-.6 2 3.4-1.5 1.4v1.2l1.5 1.4-2 3.4-2-.6-1.2.7-.5 2H7l-.5-2-1.2-.7-2 .6-2-3.4 1.5-1.4V8.4L1.3 7l2-3.4 2 .6 1.2-.7z"></path>"`);
});
