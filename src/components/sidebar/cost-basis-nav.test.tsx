import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it } from "vitest";
import Sidebar from "./index";

it("offers a cost basis report navigation link", () => {
  render(<MemoryRouter><Sidebar collapsed={false} onToggle={() => {}} isProUser={false} /></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Cost basis" })).toHaveAttribute("href", "/cost-basis");
});
