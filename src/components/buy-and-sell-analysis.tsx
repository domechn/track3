import { loadAllAssetActionsBySymbol } from "@/middlelayers/charts";
import { useEffect } from "react";
import { useParams } from "react-router-dom";

const App = ({}) => {
  const { symbol } = useParams();

  useEffect(() => {
    if (symbol) {
      loadAllAssetActionsBySymbol(symbol).then((res) => {
        console.log(res);
      });
    }
  }, [symbol]);

  return <div>Buy and Sell: {symbol}</div>;
};

export default App;
