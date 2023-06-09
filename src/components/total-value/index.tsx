import { CurrencyRateDetail } from "../../middlelayers/types";
import { currencyWrapper } from "../../utils/currency";
import { useWindowSize } from "../../utils/hook";
import "./index.css";

const App = ({
  data,
  currency,
}: {
  currency: CurrencyRateDetail;
  data: {
    totalValue: number;
    changePercentage: number;
  };
}) => {
  const baseFontSize = 6;

  const windowSize = useWindowSize();

  function formatTotalValue() {
    return `${currency.symbol}${currencyWrapper(currency)(
      data.totalValue
    ).toLocaleString()}`;
  }

  function formatChangePercentage() {
    return `${data.changePercentage.toLocaleString()}%`;
  }

  function fontCount() {
    return Math.max(data.totalValue.toString().length / 10, 1);
  }

  function totalValueFontSize() {
    const size = baseFontSize / fontCount();
    if (windowSize.width) {
      return `${size + Math.max(0, (1000 - windowSize.width) / 150)}vw`;
    }
    return `${size}vw`;
  }

  function changePercentageFontSize() {
    const size = baseFontSize / fontCount() / 2.5;
    if (windowSize.width) {
      return `${size + Math.max(0, (1000 - windowSize.width) / 300)}vw`;
    }
    return `${size}vw`;
  }

  function changePercentageColorClass() {
    if (data.changePercentage === 0) {
      return "";
    }
    return data.changePercentage > 0 ? "positive" : "negative";
  }

  return (
    <div>
      <div
        className="chartTitle"
        style={{
          marginBottom: 15,
        }}
      >
        Total Value
      </div>
      <div
        style={{
          minHeight: totalValueFontSize(),
        }}
      >
        <span
          className="totalValue"
          style={{
            fontSize: totalValueFontSize(),
            lineHeight: totalValueFontSize(),
          }}
        >
          {formatTotalValue()}
        </span>
        <span
          className={`changePercentage ${changePercentageColorClass()}`}
          style={{
            fontSize: changePercentageFontSize(),
          }}
        >
          {formatChangePercentage()}
        </span>
      </div>
    </div>
  );
};

export default App;
