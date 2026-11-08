import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WALLET_LOGS } from "@/middlelayers/constants";
import AssetIcon from "./asset-icon";

vi.mock("@tauri-apps/api/path", () => ({ appCacheDir: vi.fn().mockResolvedValue("/cache") }));
vi.mock("@/utils/app", () => ({ getImageApiPath: vi.fn().mockResolvedValue("") }));

describe("AssetIcon", () => {
  it.each([16, 20, 24, 32] as const)("declares a fixed %ipx box", (size) => {
    const { container } = render(<AssetIcon kind="coin" symbol="BTC" size={size} />);
    const tile = container.querySelector(".t3-asset-icon");
    expect(tile).toHaveAttribute("data-size", String(size));
    expect(tile?.querySelector("img")).toHaveAttribute("width", String(size - 2 * (1 + Math.round(size * .14))));
    expect(tile?.querySelector("img")).toHaveAttribute("height", String(size - 2 * (1 + Math.round(size * .14))));
  });

  it.each(["exchange", "wallet", "broker"] as const)("uses the known %s brand mark", (kind) => {
    const type = kind === "exchange" ? "binance" : kind === "broker" ? "ibkr" : "btc";
    const { container } = render(<AssetIcon kind={kind} type={type} size={24} />);
    expect(container.querySelector(".t3-asset-icon img")).toHaveAttribute("src");
    expect(container.querySelector(".t3-asset-icon-fallback")).toBeNull();
  });

  it("uses the chain brand mark for ETH coins when no cached image is supplied", () => {
    const { container } = render(<AssetIcon kind="coin" symbol="ETH" size={20} />);
    expect(container.querySelector(".t3-asset-icon img")).toHaveAttribute("src");
  });

  it("uses the OKX brand mark for its configured provider name", () => {
    const { container } = render(<AssetIcon kind="exchange" type="okx" size={24} />);
    expect(container.querySelector(".t3-asset-icon img")).toHaveAttribute("src");
  });

  it.each([
    ["broker", "Interactive Brokers"],
    ["exchange", "Gate.io"],
  ] as const)("resolves the displayed %s provider name", (kind, type) => {
    const { container } = render(<AssetIcon kind={kind} type={type} size={24} />);
    expect(container.querySelector(".t3-asset-icon img")).toHaveAttribute("src");
  });

  it("uses ticker initials for stocks and missing or failed logos", () => {
    const { container, rerender } = render(<AssetIcon kind="stock" symbol="1211.HK" size={20} />);
    expect(screen.getByRole("img", { name: "1211.HK" }).querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "1");
    rerender(<AssetIcon kind="coin" symbol="NOVA" src="/bad-logo.png" size={20} />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByRole("img", { name: "NOVA" }).querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "N");
    expect(container.querySelector("img")).toBeNull();
  });

  it("uses one initial in a 16px fallback tile", () => {
    render(<AssetIcon kind="stock" symbol="NVDA" size={16} />);
    expect(screen.getByRole("img", { name: "NVDA" }).querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "N");
  });

  it("uses a generic glyph for custom assets and keeps adjacent labels decorative", () => {
    const { container } = render(<>
      <AssetIcon kind="custom" symbol="Savings" size={32} />
      <AssetIcon kind="coin" symbol="BTC" size={20} decorative quiet />
      <AssetIcon kind="exchange" type="binance" size={20} quiet />
    </>);
    expect(screen.getByRole("img", { name: "Savings" }).querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("[aria-hidden='true'][data-kind='coin']")).toHaveAttribute("data-quiet");
    expect(container.querySelector("[data-kind='exchange']")).not.toHaveAttribute("data-quiet");
  });

  it("keeps fallback initials out of chip text", () => {
    const { container } = render(<AssetIcon kind="wallet" name="Wallet 1" size={20} />);
    expect(container.textContent).toBe("");
    expect(container.querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "W");
  });

  it("uses a cached coin logo when the caller supplies no src", async () => {
    const { getImageApiPath } = await import("@/utils/app");
    vi.mocked(getImageApiPath).mockResolvedValueOnce("/cache/assets/coins/bnb.png");
    const { container } = render(<AssetIcon kind="coin" symbol="BNB" size={20} />);
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", "/cache/assets/coins/bnb.png"));
  });

  it("tries the bundled chain mark when a cached coin logo fails", async () => {
    const { getImageApiPath } = await import("@/utils/app");
    vi.mocked(getImageApiPath).mockResolvedValueOnce("/cache/assets/coins/trx.png");
    const { container } = render(<AssetIcon kind="coin" symbol="TRX" size={20} />);
    await waitFor(() => expect(container.querySelector("img")).toHaveAttribute("src", "/cache/assets/coins/trx.png"));

    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector(".t3-asset-icon img")).toHaveAttribute("src", WALLET_LOGS.trc20);
    expect(container.querySelector(".t3-asset-icon-fallback")).toBeNull();

    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector(".t3-asset-icon-fallback")).toHaveAttribute("data-initials", "T");
  });

  it("shares the cached logo lookup across rows for one coin", async () => {
    const { getImageApiPath } = await import("@/utils/app");
    vi.mocked(getImageApiPath).mockResolvedValue("/cache/assets/coins/ada.png");
    const { container } = render(<>
      <AssetIcon kind="coin" symbol="ADA" size={20} />
      <AssetIcon kind="coin" symbol="ADA" size={20} />
    </>);
    await waitFor(() => expect(container.querySelectorAll("img")).toHaveLength(2));
    expect(vi.mocked(getImageApiPath).mock.calls.filter(([, symbol]) => symbol === "ADA")).toHaveLength(1);
  });
});
