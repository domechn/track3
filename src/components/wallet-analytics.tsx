import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import { CurrencyRateDetail, TDateRange } from "@/middlelayers/types";

const App = ({
  currency,
  dateRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
}) => {
  return (
    <div className="space-y-2">
      <WalletAssetsPercentage currency={currency} dateRange={dateRange} />
      <WalletAssetsChange currency={currency} dateRange={dateRange} />
    </div>
  );
};

export default App;
