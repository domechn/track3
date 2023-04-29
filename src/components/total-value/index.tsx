import { useEffect, useState } from "react";
import "./index.css";

const App = () => {
  const baseFontSize = 6;
  const [totalValue, setTotalValue] = useState(0);
  const [changePercentage, setChangePercentage] = useState(0);

  useEffect(() => {
    setTotalValue(1242394389594);
    setChangePercentage(-9.221);
  }, []);

  function formatTotalValue() {
    return `$${totalValue.toLocaleString()}`;
  }

  function formatChangePercentage() {
    return `${changePercentage}%`;
  }

  function fontCount() {
    return Math.max(totalValue.toString().length / 5, 1);
  }

  function totalValueFontSize() {
    const size = baseFontSize / fontCount();
    return `${size}vw`;
  }

  function changePercentageFontSize() {
    const size = baseFontSize / fontCount() / 3;
    return `${size}vw`;
  }

  function changePercentageColorClass() {
    if (changePercentage === 0) {
      return "";
    }
    return changePercentage > 0 ? "positive" : "negative";
  }

  return (
    <div>
      <div className="chartTitle" style={{
        marginBottom: 15,
      }}>Total Value</div>
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
