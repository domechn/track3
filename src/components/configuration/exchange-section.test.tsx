import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExchangeSection } from "./exchange-section";
import type { ExchangeRow } from "./types";
import { detectPublicIp } from "@/middlelayers/public-ip";
import { openUrl } from "@tauri-apps/plugin-opener";

vi.mock("@/middlelayers/public-ip", () => ({ detectPublicIp: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

beforeEach(() => {
  vi.mocked(detectPublicIp).mockReset().mockResolvedValue({ address: "8.8.8.8", version: 4 });
  vi.mocked(openUrl).mockResolvedValue(undefined);
});

const mockExchanges: ExchangeRow[] = [
  {
    type: "binance",
    alias: "Main",
    apiKey: "key123",
    secret: "sec123",
    active: true,
  },
  {
    type: "okex",
    alias: undefined,
    apiKey: "key456",
    secret: "sec456",
    password: "pw",
    active: false,
  },
];

const baseProps = {
  exchanges: mockExchanges,
  visibleExchanges: mockExchanges,
  exchangePage: 0,
  exchangePageCount: 1,
  isPro: false,
  cexOptions: [
    { value: "binance", label: "Binance" },
    { value: "okex", label: "OKX" },
  ],
  addExchangeDialogOpen: false,
  addExchangeConfig: undefined,
  saveCexConfigLoading: false,
  onExchangePageChange: vi.fn(),
  onAddExchangeDialogOpenChange: vi.fn(),
  onAddExchangeConfigChange: vi.fn(),
  onAddExchangeFormSubmit: vi.fn(),
  onToggleActive: vi.fn(),
  onRemove: vi.fn(),
  onQuickLook: vi.fn(),
};

describe("ExchangeSection", () => {
  it("looks up the IP only while the exchange form is open and permits saving during loading", async () => {
    let resolve!: (value: { address: string; version: 4 }) => void;
    vi.mocked(detectPublicIp).mockReturnValue(new Promise((done) => { resolve = done; }));
    const save = vi.fn();
    const view = render(<ExchangeSection {...baseProps} onAddExchangeFormSubmit={save} />);
    expect(detectPublicIp).not.toHaveBeenCalled();
    view.rerender(<ExchangeSection {...baseProps} onAddExchangeFormSubmit={save}
      addExchangeDialogOpen addExchangeConfig={{ type: "binance", apiKey: "", secret: "", active: true }} />);
    expect(screen.getByText("Detecting IP…")).toBeInTheDocument();
    expect(detectPublicIp).toHaveBeenCalledOnce();
    const info = screen.getByRole("group", { name: "Your public IP:" });
    expect(info).toHaveAttribute("aria-busy", "true");
    expect(within(info).getByRole("button", { name: "Copy" })).toBeDisabled();
    expect(within(info).getByRole("button", { name: "Refresh" })).toBeDisabled();
    expect(within(info).queryByText(/Add this address/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(save).toHaveBeenCalledOnce();
    resolve({ address: "8.8.8.8", version: 4 });
    await waitFor(() => expect(screen.getByText("8.8.8.8")).toBeInTheDocument());
    expect(info).toHaveAttribute("aria-busy", "false");
    expect(screen.getByText("8.8.8.8")).toHaveClass("select-text");
  });

  it("copies the visible IP, refreshes it, and displays a lookup error", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    vi.mocked(detectPublicIp).mockResolvedValueOnce({ address: "8.8.8.8", version: 4 })
      .mockRejectedValueOnce(new Error("offline"));
    render(<ExchangeSection {...baseProps} addExchangeDialogOpen
      addExchangeConfig={{ type: "binance", apiKey: "", secret: "", active: true }} />);
    await waitFor(() => expect(screen.getByText("8.8.8.8")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(writeText).toHaveBeenCalledWith("8.8.8.8");
    await waitFor(() => expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Copied");
    fireEvent.click(screen.getByRole("button", { name: "How to create a read-only key" }));
    expect(openUrl).toHaveBeenCalledWith("https://track3.dev/docs/");
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Couldn't detect your IP. Check your connection and retry.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Add this address/)).not.toBeInTheDocument();
  });
  it("renders exchange table with rows", () => {
    render(<ExchangeSection {...baseProps} />);

    expect(screen.getByText("Binance")).toBeInTheDocument();
    expect(screen.getByText("OKX")).toBeInTheDocument();
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("shows active/inactive status", () => {
    render(<ExchangeSection {...baseProps} />);

    const activeLabels = screen.getAllByText("Active");
    const inactiveLabels = screen.getAllByText("Inactive");
    expect(activeLabels.length).toBeGreaterThanOrEqual(1);
    expect(inactiveLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty state when no exchanges", () => {
    render(
      <ExchangeSection {...baseProps} exchanges={[]} visibleExchanges={[]} />,
    );

    expect(screen.getByText(/No exchange found/)).toBeInTheDocument();
  });

  it('has an "Add Exchange Configuration" button', () => {
    render(<ExchangeSection {...baseProps} />);

    expect(screen.getByText("Add Exchange Configuration")).toBeInTheDocument();
  });

  it("renders pagination when more than one page", () => {
    const manyExchanges = Array.from({ length: 31 }, (_, i) => ({
      type: "binance",
      alias: `Ex ${i}`,
      apiKey: `key${i}`,
      secret: "sec",
      active: true,
    }));

    render(
      <ExchangeSection
        {...baseProps}
        exchanges={manyExchanges}
        visibleExchanges={manyExchanges}
        exchangePageCount={2}
      />,
    );

    // Should show page indicator
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
  });

  it("requires confirmation before removing an exchange", () => {
    const onRemove = vi.fn();
    render(<ExchangeSection {...baseProps} onRemove={onRemove} />);
    const row = screen.getByText("Main").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
