import { fireEvent, render, screen } from "@testing-library/react";
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

it.each([false, true])("gives History filters a distinct footer icon when collapsed is %s", (collapsed) => {
  render(<MemoryRouter initialEntries={["/history"]}>
    <Sidebar collapsed={collapsed} onToggle={() => {}} isProUser={false} recordsToolsOpen={false} />
  </MemoryRouter>);
  const footer = screen.getByRole("link", { name: "Settings" }).parentElement!;
  const filters = screen.getByRole("button", { name: "History filters" });
  const settings = screen.getByRole("link", { name: "Settings" });
  const cogPath = "M7 1.5h4l.5 2 1.2.7 2-.6 2 3.4-1.5 1.4v1.2l1.5 1.4-2 3.4-2-.6-1.2.7-.5 2H7l-.5-2-1.2-.7-2 .6-2-3.4 1.5-1.4V8.4L1.3 7l2-3.4 2 .6 1.2-.7z";
  const slidersPath = "M2.5 5h2m4 0h7M2.5 13h8m4 0h1";
  expect(footer.querySelectorAll(`path[d="${cogPath}"]`)).toHaveLength(1);
  expect(footer.querySelectorAll(`path[d="${slidersPath}"]`)).toHaveLength(1);
  expect(filters.querySelector("svg")?.innerHTML).not.toBe(settings.querySelector("svg")?.innerHTML);
  expect(footer.children[0]).toContainElement(filters);
  expect(footer.children[1]).toContainElement(settings);
  expect(filters).toHaveAttribute("aria-controls", "t3-records-toolbar-panel");
  expect(filters).toHaveAttribute("aria-expanded", "false");
  expect(filters).toHaveAttribute("aria-pressed", "false");
  expect(filters).toHaveClass("focus-visible:ring-2");
  if (!collapsed) expect(filters).toHaveTextContent("History filters");
});

it("reports the History filters panel state and dispatches its toggle", () => {
  const toggle = vi.fn();
  window.addEventListener("records-controls-toggle", toggle);
  const view = (open: boolean) => <MemoryRouter initialEntries={["/history"]}>
    <Sidebar collapsed onToggle={() => {}} isProUser={false} recordsToolsOpen={open} />
  </MemoryRouter>;
  const rendered = render(view(false));
  const filters = screen.getByRole("button", { name: "History filters" });
  fireEvent.click(filters);
  expect(toggle).toHaveBeenCalledOnce();
  rendered.rerender(view(true));
  expect(filters).toHaveAttribute("aria-expanded", "true");
  expect(filters).toHaveAttribute("aria-pressed", "true");
  window.removeEventListener("records-controls-toggle", toggle);
});
