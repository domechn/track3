import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Button } from "./button";

it("uses theme background text on the accent button", () => {
  render(<Button variant="accent">Continue</Button>);
  expect(screen.getByRole("button", { name: "Continue" })).toHaveClass("text-background");
});
