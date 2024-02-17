import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  return (
    <div className="space-y-2">
      <WalletAssetsPercentage currency={currency} dateRange={dateRange} />
      <WalletAssetsChange
        currency={currency}
        dateRange={dateRange}
        quoteColor={quoteColor}
      />
    </div>
  );
};

export default App;
