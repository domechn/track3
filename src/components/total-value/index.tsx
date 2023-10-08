import { useEffect, useState } from "react";
import { CurrencyRateDetail } from "../../middlelayers/types";
import {
  currencyWrapper,
  prettyNumberToLocaleString,
} from "../../utils/currency";
import { useWindowSize } from "../../utils/hook";
import "./index.css";

const emojiMap = {
  up: "😄",
  down: "😢",
  else: "😑",
};

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

  function changePercentageEmoji() {
    if (data.changePercentage === 0) {
      return emojiMap["else"];
    }
    return data.changePercentage > 0 ? emojiMap["up"] : emojiMap["down"];
  }

  function changePercentageColorClass() {
    if (data.changePercentage === 0) {
      return "";
    }
    return data.changePercentage > 0 ? "positive" : "negative";
  }

  function totalValueStyle() {
    return {
      fontSize: totalValueFontSize(),
      lineHeight: totalValueFontSize(),
    };
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
        onMouseEnter={() => setChangedValueOrPercentage(formatChangeValue())}
        onMouseLeave={() =>
          setChangedValueOrPercentage(formatChangePercentage())
        }
      >
        <span
          className="totalValue"
          style={{
            ...totalValueStyle(),
            marginRight: 5,
          }}
        >
          {changePercentageEmoji()}
        </span>
        <span className="totalValue" style={totalValueStyle()}>
          {formatTotalValue()}
        </span>
        <span
          className={`changePercentage ${changePercentageColorClass()}`}
          style={{
            fontSize: changePercentageFontSize(),
          }}
        >
          {changedValueOrPercentage}
        </span>
      </div>
    </div>
  );
};

export default App;
