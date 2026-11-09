import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { SignedInlineText } from "./signed-inline-text";

it("keeps signed money and percent tokens intact inside wrapping prose", () => {
  render(<p><SignedInlineText text="BTC fell −$89,876.63 while SOL gained +14.3%." /></p>);
  expect(screen.getByText("−$89,876.63")).toHaveClass("t3-signed-unit");
  expect(screen.getByText("+14.3%")).toHaveClass("t3-signed-unit");
  expect(screen.getByText("−$89,876.63").firstChild?.nodeType).toBe(Node.TEXT_NODE);
});

