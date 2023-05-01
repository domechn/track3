import "./index.css";

const App = ({data}:{
  data: {
    totalValue: number,
    changePercentage: number,
  }
}) => {
  const baseFontSize = 6;


  function formatTotalValue() {
    return `$${data.totalValue.toLocaleString()}`;
  }

  function formatChangePercentage() {
    return `${data.changePercentage.toLocaleString()}%`;
  }

  function fontCount() {
    return Math.max(data.totalValue.toString().length / 10, 1);
  }

  function totalValueFontSize() {
    const size = baseFontSize / fontCount();
    return `${size}vw`;
  }

  function changePercentageFontSize() {
    const size = baseFontSize / fontCount() / 2.5;
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
