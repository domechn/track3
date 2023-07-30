import {
  CurrencyRateDetail,
  WalletAssetsChangeData,
} from "../../middlelayers/types";
import { currencyWrapper } from "../../utils/currency";
import { useWindowSize } from "../../utils/hook";
import "./index.css";

const App = ({
  data,
  currency,
}: {
  data: WalletAssetsChangeData;
  currency: CurrencyRateDetail;
}) => {
  const size = useWindowSize();
  function getArrow(value: number) {
    if (value < 0) {
      return "↓";
    } else if (value > 0) {
      return "↑";
    }
    return "";
  }

  function getChangeClassName(value: number) {
    if (value < 0) {
      return "negative";
    } else if (value > 0) {
      return "positive";
    }
    return "none";
  }

  function getPositiveValue(value: number) {
    if (value < 0) {
      return -value;
    }
    return value;
  }

  return (
    <div>
      <h4>Changes</h4>
      <div className="wallet-assets-change">
        <table
          style={{
            width: (size.width ?? 1000) * 0.8,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  minWidth: 150,
                  width: "50%",
                }}
              >
                Wallet
              </th>
              <th
                style={{
                  minWidth: 100,
                  width: "25%",
                }}
              >
                Percentage
              </th>
              <th
                style={{
                  minWidth: 100,
                  width: "25%",
                }}
              >
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.wallet}>
                <td
                  style={{
                    minWidth: 150,
                    width: "50%",
                  }}
                >
                  <span>
                    {d.walletAlias ??
                      (!d.wallet || d.wallet === "null" ? "main" : d.wallet)}
                  </span>
                </td>
                <td
                  style={{
                    minWidth: 100,
                    width: "25%",
                  }}
                >
                  <span className={getChangeClassName(d.changePercentage)}>
                    {getArrow(d.changePercentage)}
                    {getPositiveValue(d.changePercentage).toFixed(2)}%
                  </span>
                </td>
                <td
                  style={{
                    minWidth: 100,
                    width: "25%",
                  }}
                >
                  <span className={getChangeClassName(d.changeValue)}>
                    {getArrow(d.changeValue)}
                    {currency.symbol}
                    {currencyWrapper(currency)(
                      getPositiveValue(d.changeValue)
                    ).toFixed(2)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;
