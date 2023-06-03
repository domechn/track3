import { useEffect, useState } from "react";
import "./index.css";
import { CoinData } from "../../middlelayers/types";
import { queryCoinDataById } from "../../middlelayers/charts";
import _ from "lodash";

type ComparisonData = {
  name: string;
  base: number;
  head: number;
};

const App = () => {
  const [baseId, setBaseId] = useState<number>(2);
  const [headId, setHeadId] = useState<number>(66);

  const [baseData, setBaseData] = useState<CoinData[]>([]);
  const [headData, setHeadData] = useState<CoinData[]>([]);

  const [data, setData] = useState<ComparisonData[]>([]);

  useEffect(() => {
    setData(loadData(baseData, headData));
  }, [baseData, headData]);

  useEffect(() => {
    if (!baseId) {
      return;
    }
    loadDataById(baseId).then((data) => setBaseData(data));
  }, [baseId]);

  useEffect(() => {
    if (!headId) {
      return;
    }
    loadDataById(headId).then((data) => setHeadData(data));
  }, [headId]);

  function loadData(base: CoinData[], head: CoinData[]): ComparisonData[] {
    const res: ComparisonData[] = [];
    const symbols = _([...base, ...head])
      .map("symbol")
      .uniq()
      .value();
    // make total value and amount as the first two items
    const baseTotal = _(base).sumBy("value");
    const headTotal = _(head).sumBy("value");
    res.push({
      name: "USD Total Value",
      base: baseTotal,
      head: headTotal,
    });

    _(symbols).forEach((symbol) => {
      const baseItem = _.find(base, { symbol });
      const headItem = _.find(head, { symbol });

      res.push({
        name: symbol + " Value",
        base: baseItem?.value || 0,
        head: headItem?.value || 0,
      });
      res.push({
        name: symbol + " Amount",
        base: baseItem?.amount || 0,
        head: headItem?.amount || 0,
      });
      res.push({
        name: symbol + " Price",
        base: baseItem?.price || 0,
        head: headItem?.price || 0,
      });
    });

    return res;
  }

  async function loadDataById(id: number): Promise<CoinData[]> {
    // return queryCoinDataById(id);
    const data = await queryCoinDataById(id);

    return data;
  }

  function getComparisonResultNumber(base: number, head: number): number {
    if (!base || !head) return 0;
    return ((head - base) / base) * 100;
  }

  function prettyComparisonResult(base: number, head: number): string {
    const per = getComparisonResultNumber(base, head);

    if (per === 0) {
      return "-";
    }

    if (per > 0) {
      return "+" + prettyNumber(per, false) + "%";
    }

    return prettyNumber(per, false) + "%";
  }

  function prettyNumber(number: number, keepDecimal: boolean): string {
    if (!number) {
      return "-";
    }
    if (keepDecimal) {
      return "" + number;
    }
    return number.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return (
    <>
      <h1>Comparison</h1>

      <div id="comparison-container" className="comparison-container">
        <div
          className="comparison-row"
          style={{
            fontWeight: "bold",
            color: "#5b5b5b",
            fontSize: "1.2em",
          }}
        >
          <div
            className="comparison-column"
            style={{
              width: "20%",
            }}
          >
            Name
          </div>
          <div className="comparison-column">2022-01-01</div>
          <div
            className="comparison-column"
            style={{
              maxWidth: "200px",
            }}
          >
            Difference
          </div>
          <div className="comparison-column">2022-02-01</div>
        </div>
        {data.map((item, index) => (
          <div className="comparison-row" key={"comparison" + index}>
            <div
              className="comparison-column"
              style={{
                width: "20%",
              }}
            >
              {item.name}
            </div>
            <div className="comparison-column">
              {prettyNumber(
                item.base,
                item.name.includes("Amount") || item.name.includes("Price")
              )}
            </div>
            <div
              className="comparison-column"
              style={{
                color:
                  getComparisonResultNumber(item.base, item.head) === 0
                    ? ""
                    : getComparisonResultNumber(item.base, item.head) > 0
                    ? "green"
                    : "red",
                maxWidth: "200px",
              }}
            >
              {prettyComparisonResult(item.base, item.head)}
            </div>
            <div className="comparison-column">
              {prettyNumber(
                item.head,
                item.name.includes("Amount") || item.name.includes("Price")
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
