import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SplitView } from "@/mobile/components/mobile/split-view";

describe("SplitView", () => {
  it("keeps both panes mounted while selection changes", () => {
    const view = render(<SplitView selected={false} master={<button>Snapshots</button>} detail={<button>Snapshot detail</button>} />);
    expect(screen.getByRole("region", { name: "List" })).toHaveAttribute("data-active", "true");
    expect(screen.getByRole("region", { name: "Detail" })).toHaveAttribute("data-active", "false");
    view.rerender(<SplitView selected master={<button>Snapshots</button>} detail={<button>Snapshot detail</button>} />);
    expect(screen.getByRole("region", { name: "List" })).toHaveAttribute("data-active", "false");
    expect(screen.getByRole("region", { name: "Detail" })).toHaveAttribute("data-active", "true");
  });
});
