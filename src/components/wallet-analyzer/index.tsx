import { useContext, useEffect, useState } from "react";
import { queryWalletAssetsPercentage } from "../../middlelayers/charts";
import WalletAssetsPercentage from "../wallet-assets-percentage";
import { LoadingContext } from "../../App";
import {
  CurrencyRateDetail,
  WalletAssetsPercentageData,
} from "../../middlelayers/types";

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const { setLoading } = useContext(LoadingContext);
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  useEffect(() => {
    setLoading(true);
    loadAllDataAsync().finally(() => setLoading(false));
  }, []);

  async function loadAllDataAsync() {
    console.log("loading all wallet data...");
    const wap = await queryWalletAssetsPercentage();
    setWalletAssetsPercentage(wap);
  }

  return (
    <>
      <h1>Wallet Analyzer</h1>
      <WalletAssetsPercentage
        data={walletAssetsPercentage}
        currency={currency}
      />
      <hr className="nice-hr" />
    </>
  );
};

export default App;
