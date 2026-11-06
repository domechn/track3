import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BellIcon } from "@radix-ui/react-icons";
import { expect, it, vi } from "vitest";
import EmptyState from "./empty-state";

it("centres an accessible message and runs its optional action", async () => {
  const onClick = vi.fn();
  const { container } = render(<EmptyState icon={BellIcon} title="No alerts yet"
    hint="Alerts appear after a refresh." action={<button onClick={onClick}>Create rule</button>} />);
  const state = container.querySelector("[data-empty-state]");
  expect(screen.getByRole("heading", { name: "No alerts yet" })).toBeInTheDocument();
  expect(state).toHaveTextContent("Alerts appear after a refresh.");
  expect(state?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  await userEvent.click(screen.getByRole("button", { name: "Create rule" }));
  expect(onClick).toHaveBeenCalledOnce();
});
