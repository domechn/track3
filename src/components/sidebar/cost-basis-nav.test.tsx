import { fireEvent, render, screen } from "@testing-library/react";
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
  expect(screen.getByRole("link", { name: "Goals & alerts 2 unread alerts" })).toHaveAttribute("href", "/goals");
});

it.each(["/wallets", "/comparison"])("shows the visual Goals dot on %s", (route) => {
  render(<MemoryRouter initialEntries={[route]}><Sidebar collapsed onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Goals & alerts 2 unread alerts" }).querySelector("span[aria-hidden='true']")).not.toBeNull();
});

it("lets keyboard users reach and activate the sidebar toggle", () => {
  const onToggle = vi.fn();
  render(<MemoryRouter><Sidebar collapsed onToggle={onToggle} isProUser={false} /></MemoryRouter>);
  const toggle = screen.getByRole("button", { name: "Expand sidebar" });
  expect(toggle).not.toHaveAttribute("tabindex", "-1");
  fireEvent.click(toggle);
  expect(onToggle).toHaveBeenCalledOnce();
});

it("uses the same Goals & alerts wording on Overview", () => {
  render(<MemoryRouter initialEntries={["/overview"]}><Sidebar collapsed={false} onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Goals & alerts 2 unread alerts" })).toHaveAttribute("href", "/goals");
});
