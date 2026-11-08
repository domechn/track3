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

  it("pairs the same sized tile with coin and source labels", () => {
    const { container } = render(<>
      <AssetLabel asset={{ symbol: "BNB", assetType: "crypto" }} size={20} />
      <AssetLabel kind="exchange" type="binance" name="Binance" size={20} />
    </>);

    expect(container.querySelectorAll(".t3-asset-label .t3-asset-icon[data-size='20']")).toHaveLength(2);
    expect(screen.getByText("Binance")).toBeInTheDocument();
  });

  it("keeps a secondary line and stock tag with the name", () => {
    render(<AssetLabel asset={{ symbol: "1211.HK", assetType: "stock" }} secondary="BYD" />);

    expect(screen.getByText("BYD")).toBeInTheDocument();
    expect(screen.getByText("stock")).toBeInTheDocument();
    expect(screen.getByText("stock")).toHaveClass("t3-tag", "t3-asset-tag");
    expect(screen.getByText("stock")).toHaveAttribute("data-tone", "neutral");
  });

  it("uses the visible source name for a missing provider logo", () => {
    const { container } = render(<AssetLabel kind="exchange" type="unknown-provider" name="Mystery Source" size={20} />);
    expect(container.querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "M");
  });
});
