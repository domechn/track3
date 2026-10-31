import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";

it("opens a menu and invokes a selected action", async () => {
  const action = vi.fn();
  render(<DropdownMenu>
    <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={action}>Refresh</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>);
  await userEvent.click(screen.getByRole("button", { name: "Actions" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "Refresh" }));
  expect(action).toHaveBeenCalledOnce();
  expect(screen.queryByRole("menuitem", { name: "Refresh" })).not.toBeInTheDocument();
});
