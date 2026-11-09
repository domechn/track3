import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import AssetLabel from "@/components/common/asset-label";

describe("AssetLabel", () => {
  it("shows a stock badge for stock assets", () => {
    render(<AssetLabel asset={{ symbol: "AAPL", assetType: "stock" }} />);

    expect(screen.getByText("AAPL")).toBeInTheDocument();
    expect(screen.getByText("stock", { selector: "span" })).toBeInTheDocument();
  });

  it("omits the badge for crypto assets", () => {
    render(<AssetLabel asset={{ symbol: "BTC", assetType: "crypto" }} />);

    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.queryByText("crypto")).not.toBeInTheDocument();
  });
});
