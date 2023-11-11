import { useEffect, useState } from "react";
import WalletAssetsPercentage from "./wallet-assets-percentage";
import WalletAssetsChange from "./wallet-assets-change";
import {
  CurrencyRateDetail,
  WalletAssetsChangeData,
  WalletAssetsPercentageData,
} from "@/middlelayers/types";
import { WALLET_ANALYZER } from "@/middlelayers/charts";
import { Separator } from "./ui/separator";

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const [walletAssetsPercentage, setWalletAssetsPercentage] =
    useState<WalletAssetsPercentageData>([]);

  const [walletAssetsChange, setWalletAssetsChange] =
    useState<WalletAssetsChangeData>([]);

  useEffect(() => {
    loadAllDataAsync();
  }, []);

  async function loadAllDataAsync() {
    console.log("loading all wallet data...");
    const wap = await WALLET_ANALYZER.queryWalletAssetsPercentage();
    setWalletAssetsPercentage(wap);
    const wac = await WALLET_ANALYZER.queryWalletAssetsChange();
    setWalletAssetsChange(wac);
  }

  return (
    <div className='space-y-2'>
      <WalletAssetsPercentage
        data={walletAssetsPercentage}
        currency={currency}
      />
      <WalletAssetsChange data={walletAssetsChange} currency={currency} />
    </div>
  );
};

export default App;
