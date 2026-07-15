import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import CoinAnalysis from "@/components/coin-analytics";
import { ChartResizeContext } from "@/App";
import { OverviewLoadingContext } from "@/contexts/overview-loading";
import { DataChangedContext } from "@/contexts/data-changed";
import type {
  CurrencyRateDetail,
  TDateRange,
  Transaction,
} from "@/middlelayers/types";

const mocks = vi.hoisted(() => ({
  listAllowedSymbols: vi.fn(),
  queryTransactionsBySymbolAndDateRange: vi.fn(),
  calculateTotalProfit: vi.fn(),
  queryLastAssetsBySymbol: vi.fn(),
  queryAssetMaxAmountBySymbol: vi.fn(),
  updateTransactionPrice: vi.fn(),
  updateTransactionTxnType: vi.fn(),
  downloadCoinLogos: vi.fn(),
  getImageApiPath: vi.fn(),
  appCacheDir: vi.fn(),
  listWalletAliases: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/middlelayers/charts", () => ({
  listAllowedSymbols: mocks.listAllowedSymbols,
  queryTransactionsBySymbolAndDateRange:
    mocks.queryTransactionsBySymbolAndDateRange,
  calculateTotalProfit: mocks.calculateTotalProfit,
  queryLastAssetsBySymbol: mocks.queryLastAssetsBySymbol,
  queryAssetMaxAmountBySymbol: mocks.queryAssetMaxAmountBySymbol,
  updateTransactionPrice: mocks.updateTransactionPrice,
  updateTransactionTxnType: mocks.updateTransactionTxnType,
}));

vi.mock("@/middlelayers/data", () => ({
  downloadCoinLogos: mocks.downloadCoinLogos,
}));

vi.mock("@/middlelayers/wallet", () => ({
  WalletAnalyzer: class {
    listWalletAliases(walletMd5s: string[]) {
      return mocks.listWalletAliases(walletMd5s);
    }
  },
}));

vi.mock("@/utils/app", () => ({
  getImageApiPath: mocks.getImageApiPath,
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: mocks.appCacheDir,
}));

vi.mock("@/components/ui/use-toast", () => ({
  toast: mocks.toast,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    onOpenChange,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" data-testid="mock-dialog">
        {children}
        <button type="button" onClick={() => onOpenChange(false)}>
          Close
        </button>
      </div>
    ) : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@/components/coins-amount-and-value-change", () => ({
  default: () => <div data-testid="coins-amount-and-value-change-stub" />,
}));

vi.mock("@/components/wallet-assets-percentage", () => ({
  default: () => <div data-testid="wallet-assets-percentage-stub" />,
}));

vi.mock("@/components/common/asset-label", () => ({
  default: ({ asset }: { asset: { symbol: string } }) => (
    <span data-testid="asset-label">{asset.symbol}</span>
  ),
}));

vi.mock("@/components/motion", () => ({
  StaggerContainer: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  FadeUp: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@radix-ui/react-icons", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@radix-ui/react-icons")>();
  return {
    ...actual,
    Pencil2Icon: ({
      onClick,
    }: {
      onClick?: React.MouseEventHandler<HTMLButtonElement>;
    }) => (
      <button
        type="button"
        data-testid="transaction-edit"
        onClick={onClick}
      >
        edit
      </button>
    ),
  };
});

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
  }) => (
    <div>
      {children}
      <button
        type="button"
        data-testid="select-transaction-sell"
        onClick={() => onValueChange?.("sell")}
      >
        select sell
      </button>
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

const usdCurrency = {
  currency: "USD",
  symbol: "$",
  rate: 1,
  alias: "usd",
} as unknown as CurrencyRateDetail;

const dateRange: TDateRange = {
  start: new Date("2024-04-01T00:00:00.000Z"),
  end: new Date("2024-04-30T00:00:00.000Z"),
};

function CoinAnalysisTestTree({
  initialEntries = ["/coins/BTC"],
  currency = usdCurrency,
  onDataChanged,
}: {
  initialEntries?: string[];
  currency?: CurrencyRateDetail;
  onDataChanged?: () => void;
}) {
  return (
    <DataChangedContext.Provider value={0}>
      <ChartResizeContext.Provider
        value={{
          needResize: 0,
          setNeedResize: vi.fn() as React.Dispatch<React.SetStateAction<number>>,
        }}
      >
        <OverviewLoadingContext.Provider value={{ reportLoaded: vi.fn() }}>
          <MemoryRouter initialEntries={initialEntries}>
            <Routes>
              <Route
                path="/coins/:symbol"
                element={
                  <CoinAnalysis
                    currency={currency}
                    dateRange={dateRange}
                    onDataChanged={onDataChanged}
                  />
                }
              />
            </Routes>
          </MemoryRouter>
        </OverviewLoadingContext.Provider>
      </ChartResizeContext.Provider>
    </DataChangedContext.Provider>
  );
}

function renderCoinAnalysis(
  initialEntries: string[] = ["/coins/BTC"],
  currency: CurrencyRateDetail = usdCurrency,
  onDataChanged?: () => void,
) {
  return render(
    <CoinAnalysisTestTree
      initialEntries={initialEntries}
      currency={currency}
      onDataChanged={onDataChanged}
    />,
  );
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mocks.listAllowedSymbols.mockReset();
  mocks.queryTransactionsBySymbolAndDateRange.mockReset();
  mocks.calculateTotalProfit.mockReset();
  mocks.queryLastAssetsBySymbol.mockReset();
  mocks.queryAssetMaxAmountBySymbol.mockReset();
  mocks.updateTransactionPrice.mockReset();
  mocks.updateTransactionTxnType.mockReset();
  mocks.downloadCoinLogos.mockReset();
  mocks.getImageApiPath.mockReset();
  mocks.appCacheDir.mockReset();
  mocks.listWalletAliases.mockReset();
  mocks.toast.mockReset();

  // Default: BTC is at position 0, ETH at position 1. The detail page is
  // mounted with /coins/BTC, so the rank should be #1 once allowSymbols
  // is loaded. /coins/ETH should resolve to #2.
  mocks.listAllowedSymbols.mockResolvedValue([
    { symbol: "BTC", assetType: "crypto" },
    { symbol: "ETH", assetType: "crypto" },
  ]);
  mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([]);
  mocks.calculateTotalProfit.mockResolvedValue({
    total: 0,
    percentage: 0,
    coins: [],
  });
  mocks.queryLastAssetsBySymbol.mockResolvedValue(undefined);
  mocks.queryAssetMaxAmountBySymbol.mockResolvedValue(0);
  mocks.updateTransactionPrice.mockResolvedValue(undefined);
  mocks.updateTransactionTxnType.mockResolvedValue(undefined);
  mocks.downloadCoinLogos.mockResolvedValue(undefined);
  mocks.getImageApiPath.mockResolvedValue("");
  mocks.appCacheDir.mockResolvedValue("/tmp/track3-cache");
  mocks.listWalletAliases.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("CoinAnalysis allowSymbols population", () => {
  it("populates allowSymbols on first mount so the rank is computed", async () => {
    renderCoinAnalysis();

    // The stale-generation check on loadAllowedSymbols used to discard
    // the resolved list when a sibling effect bumped the shared gen ref
    // before listAllowedSymbols() resolved. After the fix, the resolved
    // list must drive the rank display.
    await waitFor(() => {
      expect(mocks.listAllowedSymbols).toHaveBeenCalled();
    });

    await waitFor(() => {
      // rank is rendered as "#1" in the symbol card
      expect(screen.getByText(/#1/)).toBeInTheDocument();
    });

    // The dash fallback indicates allowSymbols never reached the renderer.
    expect(screen.queryByText(/^-$/)).not.toBeInTheDocument();
  });

  it("computes the correct rank for whichever symbol is in the URL", async () => {
    renderCoinAnalysis(["/coins/ETH"]);

    await waitFor(() => {
      expect(mocks.listAllowedSymbols).toHaveBeenCalled();
    });

    // ETH is at position 1 in the allowed-symbols list, so its rank is #2.
    await waitFor(() => {
      expect(screen.getByText(/#2/)).toBeInTheDocument();
    });
  });
});

const transaction: Transaction = {
  id: 42,
  assetID: 7,
  uuid: "refresh-1",
  assetType: "crypto",
  symbol: "BTC",
  wallet: "wallet-1",
  amount: 1,
  price: 100,
  txnType: "buy",
  txnCreatedAt: "2024-04-15T00:00:00.000Z",
};

const secondTransaction: Transaction = {
  ...transaction,
  id: 43,
  assetID: 8,
  amount: 2,
  price: 200,
  txnType: "deposit",
  txnCreatedAt: "2024-04-16T00:00:00.000Z",
};

const hkdCurrency = {
  currency: "HKD",
  symbol: "HK$",
  rate: 7.8,
  alias: "hkd",
} as CurrencyRateDetail;

async function openPriceDialog() {
  await screen.findByText("buy");
  const transactionRow = screen.getByText("buy").closest("tr");
  expect(transactionRow).not.toBeNull();

  const editButtons = within(transactionRow!).getAllByTestId(
    "transaction-edit",
  );
  fireEvent.click(editButtons[1]);

  return screen.findByRole("dialog");
}

async function openTypeDialog() {
  await screen.findByText("buy");
  const transactionRow = screen.getByText("buy").closest("tr");
  expect(transactionRow).not.toBeNull();

  const editButtons = within(transactionRow!).getAllByTestId(
    "transaction-edit",
  );
  fireEvent.click(editButtons[0]);

  return screen.findByRole("dialog");
}

async function openTransactionDialogByType(
  transactionType: string,
  editButtonIndex: number,
) {
  await screen.findByText(transactionType);
  await waitFor(() => {
    expect(mocks.listWalletAliases).toHaveBeenCalled();
  });

  const transactionTypeCell = screen.getByText(transactionType);
  const transactionRow = transactionTypeCell.closest("tr");
  expect(transactionRow).not.toBeNull();

  const editButtons = within(transactionRow!).getAllByTestId(
    "transaction-edit",
  );
  fireEvent.click(editButtons[editButtonIndex]);

  return screen.findByRole("dialog");
}

describe("CoinAnalysis transaction price editing", () => {
  it("keeps dialog state in quote currency when saving unchanged and edited prices", async () => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(["/coins/BTC"], hkdCurrency);

    let dialog = await openPriceDialog();
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(780);

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenNthCalledWith(1, 42, 100);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    dialog = await openPriceDialog();
    const input = within(dialog).getByRole("spinbutton");
    expect(input).toHaveValue(780);
    fireEvent.change(input, { target: { value: "858" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenNthCalledWith(2, 42, 110);
    });
  });

  it("allows a zero quote-currency price", async () => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(["/coins/BTC"], hkdCurrency);

    const dialog = await openPriceDialog();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "0" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 0);
    });
  });

  it("uses the original USD price when the currency rate changes before an unedited save", async () => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    const view = renderCoinAnalysis(["/coins/BTC"], hkdCurrency);

    const dialog = await openPriceDialog();
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(780);

    view.rerender(
      <CoinAnalysisTestTree
        currency={{ ...hkdCurrency, rate: 8.8 }}
      />,
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 100);
    });
  });

  it("uses the opening currency rate when the rate changes after the price is edited", async () => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    const view = renderCoinAnalysis(["/coins/BTC"], hkdCurrency);

    const dialog = await openPriceDialog();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "858" },
    });

    view.rerender(
      <CoinAnalysisTestTree
        currency={{ ...hkdCurrency, rate: 8.8 }}
      />,
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 110);
    });
  });

  it("shows a stable quote value and preserves the exact original price when unedited", async () => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction, price: 1.1 },
    ]);
    renderCoinAnalysis(
      ["/coins/BTC"],
      { ...hkdCurrency, rate: 0.92 },
    );

    const dialog = await openPriceDialog();
    const input = within(dialog).getByRole("spinbutton");
    expect(input).toHaveValue(1.012);
    expect((input as HTMLInputElement).value).toBe("1.012");

    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 1.1);
    });
  });

  it.each([
    ["an empty price", ""],
    ["a negative price", "-1"],
  ])("rejects %s", async (_label, value) => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(["/coins/BTC"], hkdCurrency);

    const dialog = await openPriceDialog();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects a non-finite %s transaction price", async (_label, price) => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction, price },
    ]);
    renderCoinAnalysis(["/coins/BTC"], usdCurrency);

    const dialog = await openPriceDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).not.toHaveBeenCalled();
    });
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("rejects a %s currency rate", async (_label, rate) => {
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(
      ["/coins/BTC"],
      { ...hkdCurrency, rate },
    );

    const dialog = await openPriceDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).not.toHaveBeenCalled();
    });
  });
});

describe("CoinAnalysis transaction mutation notifications", () => {
  it("blocks reopening the same pending price edit and uses the committed price after settlement", async () => {
    const pending = deferred<void>();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionPrice.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis();

    let dialog = await openTransactionDialogByType("buy", 1);
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const pendingRow = screen.getByText("buy").closest("tr");
    expect(pendingRow).not.toBeNull();
    fireEvent.click(
      within(pendingRow!).getAllByTestId("transaction-edit")[1],
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pending.resolve();
    await waitFor(() => {
      expect(screen.getByText("$120.00")).toBeInTheDocument();
    });

    dialog = await openTransactionDialogByType("buy", 1);
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(120);
    expect(mocks.updateTransactionPrice).toHaveBeenCalledTimes(1);
  });

  it("blocks reopening the same pending type edit and uses the committed type after settlement", async () => {
    const pending = deferred<void>();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionTxnType.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis();

    let dialog = await openTransactionDialogByType("buy", 0);
    fireEvent.click(within(dialog).getByTestId("select-transaction-sell"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    const pendingRow = screen.getByText("buy").closest("tr");
    expect(pendingRow).not.toBeNull();
    fireEvent.click(
      within(pendingRow!).getAllByTestId("transaction-edit")[0],
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pending.resolve();
    await waitFor(() => {
      expect(screen.getByText("sell")).toBeInTheDocument();
    });

    dialog = await openTransactionDialogByType("sell", 0);
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(mocks.updateTransactionTxnType).toHaveBeenNthCalledWith(
        2,
        42,
        "sell",
      );
    });
  });

  it("allows another transaction price edit while the first price mutation is pending", async () => {
    const pending = deferred<void>();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
      { ...secondTransaction },
    ]);
    mocks.updateTransactionPrice.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis();

    let dialog = await openTransactionDialogByType("buy", 1);
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    dialog = await openTransactionDialogByType("deposit", 1);
    const save = within(dialog).getByRole("button", { name: "Save" });
    expect(save).not.toBeDisabled();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "250" },
    });
    fireEvent.click(save);

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenNthCalledWith(2, 43, 250);
    });
    pending.resolve();
  });

  it("keeps a newer price edit session open when an older save resolves", async () => {
    const pending = deferred<void>();
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
      { ...secondTransaction },
    ]);
    mocks.updateTransactionPrice.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    let dialog = await openTransactionDialogByType("buy", 1);
    expect(dialog).toHaveAttribute("data-testid", "mock-dialog");
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    dialog = await openTransactionDialogByType("deposit", 1);
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(200);

    pending.resolve();
    await waitFor(() => {
      expect(onDataChanged).toHaveBeenCalledTimes(1);
      expect(screen.getByText("$120.00")).toBeInTheDocument();
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByRole("spinbutton"),
    ).toHaveValue(200);

    fireEvent.change(
      within(screen.getByRole("dialog")).getByRole("spinbutton"),
      { target: { value: "250" } },
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenNthCalledWith(2, 43, 250);
      expect(onDataChanged).toHaveBeenCalledTimes(2);
    });
  });

  it("does not show an old price error or invalidate a newer type edit session", async () => {
    const pending = deferred<void>();
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
      { ...secondTransaction },
    ]);
    mocks.updateTransactionPrice.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    let dialog = await openTransactionDialogByType("buy", 1);
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    dialog = await openTransactionDialogByType("deposit", 0);
    fireEvent.click(within(dialog).getByTestId("select-transaction-sell"));

    pending.reject(new Error("old write failed"));
    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }),
    );

    await waitFor(() => {
      expect(mocks.updateTransactionTxnType).toHaveBeenCalledWith(43, "sell");
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
  });

  it("disables price saving and ignores a double click while the write is pending", async () => {
    const pending = deferred<void>();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionPrice.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis();

    const dialog = await openPriceDialog();
    const save = within(dialog).getByRole("button", { name: "Save" });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(mocks.updateTransactionPrice).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();

    pending.resolve();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("disables type saving and ignores a double click while the write is pending", async () => {
    const pending = deferred<void>();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionTxnType.mockReturnValueOnce(pending.promise);
    renderCoinAnalysis();

    const dialog = await openTypeDialog();
    fireEvent.click(within(dialog).getByTestId("select-transaction-sell"));
    const save = within(dialog).getByRole("button", { name: "Save" });
    fireEvent.click(save);
    fireEvent.click(save);

    expect(mocks.updateTransactionTxnType).toHaveBeenCalledTimes(1);
    expect(save).toBeDisabled();

    pending.resolve();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("updates the local price row and broadcasts after a successful write", async () => {
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    const dialog = await openPriceDialog();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 120);
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("$120.00")).toBeInTheDocument();
    });
  });

  it("updates the local type row and broadcasts after a successful write", async () => {
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    const dialog = await openTypeDialog();
    fireEvent.click(within(dialog).getByTestId("select-transaction-sell"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionTxnType).toHaveBeenCalledWith(42, "sell");
      expect(onDataChanged).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByText("sell")).toBeInTheDocument();
    });
  });

  it("does not broadcast or change the price row after a failed write", async () => {
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionPrice.mockRejectedValueOnce(
      new Error("write failed"),
    );
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    const dialog = await openPriceDialog();
    fireEvent.change(within(dialog).getByRole("spinbutton"), {
      target: { value: "120" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionPrice).toHaveBeenCalledWith(42, 120);
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "Unable to update transaction. Please try again.",
      variant: "destructive",
    });
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain("write failed");
    expect(onDataChanged).not.toHaveBeenCalled();
    expect(screen.getByText("$100.00")).toBeInTheDocument();
  });

  it("does not broadcast or change the type row after a failed write", async () => {
    const onDataChanged = vi.fn();
    mocks.queryTransactionsBySymbolAndDateRange.mockResolvedValue([
      { ...transaction },
    ]);
    mocks.updateTransactionTxnType.mockRejectedValueOnce(
      new Error("write failed"),
    );
    renderCoinAnalysis(["/coins/BTC"], usdCurrency, onDataChanged);

    const dialog = await openTypeDialog();
    fireEvent.click(within(dialog).getByTestId("select-transaction-sell"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(mocks.updateTransactionTxnType).toHaveBeenCalledWith(42, "sell");
    });
    expect(mocks.toast).toHaveBeenCalledWith({
      description: "Unable to update transaction. Please try again.",
      variant: "destructive",
    });
    expect(JSON.stringify(mocks.toast.mock.calls)).not.toContain("write failed");
    expect(onDataChanged).not.toHaveBeenCalled();
    const transactionRow = screen.getByText("$100.00").closest("tr");
    expect(transactionRow).not.toBeNull();
    expect(within(transactionRow!).getByText("buy")).toBeInTheDocument();
  });
});
