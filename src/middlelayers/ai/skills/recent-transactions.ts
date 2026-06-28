import { defineTool } from "@earendil-works/pi-coding-agent";
import { getBaseCurrency, sObj, sNumber, sString, sOptional } from "../pi-agent";
import { TRANSACTION_HANDLER } from "../../entities/transactions";
import { getAssetType } from "../../datafetch/utils/coins";
import type { ChartToolDetails } from "../pi-agent";

export default defineTool({
  name: "recent_transactions",
  label: "Recent transactions",
  description: "Return the most recent buy/sell/deposit/withdraw transactions across all configured wallets, optionally filtered by symbol or asset type.",
  parameters: sObj({
    limit: sOptional(sNumber("Number of transactions to return (default 20, max 100).")),
    symbol: sOptional(sString("Optional symbol filter, e.g. BTC.")),
    assetType: sOptional(sObj({}, { desc: "Asset type filter." })),
  }),
  execute: async (_toolCallId: string, params: any) => {
    const limit = clampLimit(params.limit);
    const symbol = typeof params.symbol === "string" && params.symbol.trim() ? params.symbol.trim().toUpperCase() : undefined;
    const assetType = params.assetType === "stock" || params.assetType === "crypto" ? params.assetType : undefined;
    const all = await TRANSACTION_HANDLER.listTransactions(symbol);
    const normalizedSymbol = symbol?.toUpperCase();
    const filtered = all.filter(t => {
      if (assetType && getAssetType(t) !== assetType) return false;
      if (normalizedSymbol && t.symbol.toUpperCase() !== normalizedSymbol) return false;
      return true;
    }).sort((a, b) => new Date(b.txnCreatedAt).getTime() - new Date(a.txnCreatedAt).getTime()).slice(0, limit);
    if (filtered.length === 0) return { content: [{ type: "text", text: "No transactions match the filter." }], details: { data: { empty: true } } as ChartToolDetails };
    const totalBuy = filtered.filter(t => t.txnType === "buy").reduce((s, t) => s + t.amount * t.price, 0);
    const totalSell = filtered.filter(t => t.txnType === "sell").reduce((s, t) => s + t.amount * t.price, 0);
    const totalDeposit = filtered.filter(t => t.txnType === "deposit").reduce((s, t) => s + t.amount * t.price, 0);
    const totalWithdraw = filtered.filter(t => t.txnType === "withdraw").reduce((s, t) => s + t.amount * t.price, 0);
    return {
      content: [{ type: "text", text: `Returned ${filtered.length} recent transactions.` }],
      details: { chart: undefined, data: { transactions: filtered.map(t => ({ id: t.id, symbol: t.symbol, assetType: getAssetType(t), wallet: t.wallet, txnType: t.txnType, amount: t.amount, price: t.price, value: t.amount * t.price, txnCreatedAt: t.txnCreatedAt })), totals: { buy: totalBuy, sell: totalSell, deposit: totalDeposit, withdraw: totalWithdraw } } } as ChartToolDetails,
    };
  },
});

function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" && Number.isFinite(raw) ? raw : 20;
  return Math.max(1, Math.min(100, Math.floor(n)));
}
