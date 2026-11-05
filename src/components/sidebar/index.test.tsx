import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import Sidebar from "./index";

vi.mock("../use-alert-badge", () => ({ useAlertBadge: () => 0 }));

it("shows a cog for Settings in expanded and collapsed navigation", () => {
  const view = (collapsed: boolean) => <MemoryRouter><Sidebar collapsed={collapsed} onToggle={() => {}} isProUser={false} /></MemoryRouter>;
  const rendered = render(view(false));
  const markup = screen.getByRole("link", { name: "Settings" }).querySelector("svg")?.innerHTML;
  expect(markup).toMatchInlineSnapshot(`"<circle cx="9" cy="9" r="2.5"></circle><path d="M7 1.5h4l.5 2 1.2.7 2-.6 2 3.4-1.5 1.4v1.2l1.5 1.4-2 3.4-2-.6-1.2.7-.5 2H7l-.5-2-1.2-.7-2 .6-2-3.4 1.5-1.4V8.4L1.3 7l2-3.4 2 .6 1.2-.7z"></path>"`);
  rendered.rerender(view(true));
  expect(screen.getByRole("link", { name: "Settings" }).querySelector("svg")?.innerHTML).toBe(markup);
});
