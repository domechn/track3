import { useContext, useEffect, useState } from "react";
import WalletAssetsPercentage from "./wallet-assets-percentage";
import WalletAssetsChange from "./wallet-assets-change";
import { LoadingContext } from "../App";
import {
  CurrencyRateDetail,
  WalletAssetsChangeData,
  WalletAssetsPercentageData,
} from "../middlelayers/types";
import { WALLET_ANALYZER } from "../middlelayers/charts";
import { Separator } from "./ui/separator";

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const { setLoading } = useContext(LoadingContext);
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);

  useEffect(() => {
    setLoading(true);
    loadAllDataAsync().finally(() => setLoading(false));
  }, []);

  async function loadAllDataAsync() {
    console.log("loading all wallet data...");
    const wap = await WALLET_ANALYZER.queryWalletAssetsPercentage();
    setWalletAssetsPercentage(wap);
    const wac = await WALLET_ANALYZER.queryWalletAssetsChange();
    setWalletAssetsChange(wac);
  }

  return (
    <>
      <WalletAssetsPercentage
        data={walletAssetsPercentage}
        currency={currency}
      />
      <Separator className="my-6" />
      <WalletAssetsChange data={walletAssetsChange} currency={currency} />
    </>
  );
};

export default App;
