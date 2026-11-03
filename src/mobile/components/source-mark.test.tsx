import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SourceMark from "./source-mark";

describe("SourceMark", () => {
  it("shows exchange initials when a first-run source has no provider", () => {
    render(<SourceMark source={{ sourceId: "cex:0", label: "Binance", kind: "exchange" }} />);
    expect(screen.getByLabelText("Binance")).toHaveTextContent("Bn");
  });

  it("uses provider and source kind when a source has a custom alias", () => {
    render(<>
      <SourceMark source={{ sourceId: "cex:0", label: "My trading account", kind: "exchange", provider: "Binance" }} />
      <SourceMark source={{ sourceId: "btc:0", label: "Cold storage", kind: "wallet", provider: "BTC" }} />
    </>);
    expect(screen.getByLabelText("Binance")).toHaveTextContent("Bn");
    expect(screen.getByLabelText("BTC wallet").querySelector("svg")).toBeTruthy();
  });

  it("shows compact wallet initials in a source-status sheet", () => {
    render(<>
      <SourceMark source={{ sourceId: "btc:0", label: "Ledger cold wallet", kind: "wallet" }} initialsOnly />
      <SourceMark source={{ sourceId: "erc20:0", label: "0x4f…a91c", kind: "wallet" }} initialsOnly />
    </>);
    expect(screen.getByLabelText("Ledger cold wallet wallet")).toHaveTextContent("Lg");
    expect(screen.getByLabelText("0x4f…a91c wallet")).toHaveTextContent("0x");
  });
});
