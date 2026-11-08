import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tag } from "./tag";

describe("Tag", () => {
  it.each(["neutral", "accent", "positive", "negative", "warning", "outline"] as const)(
    "renders the %s tone with the shared tag class",
    (tone) => {
      render(<Tag tone={tone}>{tone}</Tag>);
      const tag = screen.getByText(tone);
      expect(tag).toHaveClass("t3-tag");
      expect(tag).toHaveAttribute("data-tone", tone);
    },
  );

  it("keeps caller layout classes and native attributes", () => {
    render(<Tag tone="accent" className="ml-2" title="Top mover">Top mover</Tag>);
    expect(screen.getByTitle("Top mover")).toHaveClass("t3-tag", "ml-2");
  });
});
