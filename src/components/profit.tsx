import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { calculateTotalProfit } from "@/middlelayers/charts";
import { loadingWrapper } from "@/utils/loading";

const App = ({
  currency,
  // version is used for reloading data
  version,
}: {
  currency: CurrencyRateDetail;
  version: number;
}) => {
  const [profit, setProfit] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    calculateTotalProfit()
      .then((res) => {
        setProfit(res.total);
      })
      .finally(() => setLoading(false));
  }, [version]);

  return (
    <div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium font-bold">
            Profit
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 placeholder">
          {loadingWrapper(
            loading,
            <div className="text-2xl font-bold">
              {currency.symbol +
                prettyNumberToLocaleString(currencyWrapper(currency)(profit))}
            </div>,
            "h-[32px]"
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
