import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
} from "@/middlelayers/types";

const App = ({ currency,version }: { currency: CurrencyRateDetail, version: number }) => {

  return (
    <div className="space-y-2">
      <WalletAssetsPercentage
        currency={currency}
        version={version}
      />
      <WalletAssetsChange currency={currency} version={version}/>
    </div>
  );
};

export default App;
