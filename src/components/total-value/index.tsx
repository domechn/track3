import { useEffect, useState } from "react";
import { CurrencyRateDetail } from "../../middlelayers/types";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
} from "../../utils/currency";
import "./index.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const App = ({
  data,
  currency,
  children,
}: {
  currency: CurrencyRateDetail;
  data: {
    totalValue: number;
    changePercentage: number;
  };
  children: React.ReactNode;
}) => {
  const [changedValueOrPercentage, setChangedValueOrPercentage] = useState("");

  useEffect(() => {
    setChangedValueOrPercentage(formatChangePercentage());
  }, [data]);

  function formatTotalValue() {
    return (
      currency.symbol +
      prettyNumberToLocaleString(currencyWrapper(currency)(data.totalValue))
    );
  }

  function getUpOrDown(val: number) {
    const p = val > 0 ? "+" : val === 0 ? "" : "-";
    return p;
  }

  function formatChangePercentage() {
    let val = data.changePercentage;
    const p = getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return `${p}${prettyNumberToLocaleString(val)}%`;
  }

  function formatChangeValue() {
    let val =
      (data.changePercentage * currencyWrapper(currency)(data.totalValue)) /
      100;
    const symbol = currency.symbol;
    const p = getUpOrDown(val);
    if (val < 0) {
      val = -val;
    }
    return p + symbol + prettyNumberToLocaleString(val);
  }

  function fontCount() {
    return Math.max(data.totalValue.toString().length / 10, 1);
  }

  function changePercentageColorClass() {
    if (data.changePercentage === 0) {
      return "text-gray-500";
    }
    return data.changePercentage > 0 ? "text-green-500" : "text-red-500";
  }

  return (
    <div>
      <Card
        onMouseEnter={() => setChangedValueOrPercentage(formatChangeValue())}
        onMouseLeave={() =>
          setChangedValueOrPercentage(formatChangePercentage())
        }
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatTotalValue()}</div>
          <p className="text-xs text-muted-foreground">
            <span className={changePercentageColorClass()}>
              {changedValueOrPercentage}
            </span>{" "}
            from last time
          </p>
          {children}
        </CardContent>
      </Card>
    </div>
  );
};

export default App;
