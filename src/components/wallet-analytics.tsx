import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
} from "@/middlelayers/types";

const App = ({ currency }: { currency: CurrencyRateDetail }) => {

  return (
    <div className="space-y-2">
      <WalletAssetsPercentage
        currency={currency}
      />
      <WalletAssetsChange currency={currency} />
    </div>
  );
};

export default App;
