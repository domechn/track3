import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { CoinData } from "../../middlelayers/types";
import {
  queryAllDataDates,
  queryCoinDataById,
} from "../../middlelayers/charts";
import _ from "lodash";
import Select from "../common/select";

type ComparisonData = {
  name: string;
  base: number;
  head: number;
};

const App = () => {
  const [baseId, setBaseId] = useState<number>(0);
  const [dateOptions, setDateOptions] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  const baseDate = useMemo(() => {
    return _.find(dateOptions, { value: "" + baseId })?.label;
  }, [dateOptions, baseId]);
  const [headId, setHeadId] = useState<number>(0);
  const headDate = useMemo(() => {
    return _.find(dateOptions, { value: "" + headId })?.label;
  }, [dateOptions, headId]);

  const [baseData, setBaseData] = useState<CoinData[]>([]);
  const [headData, setHeadData] = useState<CoinData[]>([]);

  const [data, setData] = useState<ComparisonData[]>([]);

  useEffect(() => {
    loadAllSelectDates().then((data) => {
      const options = _(data)
        .map((d) => ({
          label: d.date,
          value: "" + d.id,
        }))
        .value();

      // if headDate is not set, set it to the latest date
      if (!headDate && options.length > 0) {
        setHeadId(+options[0].value);
      }

      // if baseDate is not set, set it to the second latest date
      if (!baseDate && options.length > 0) {
        setBaseId(+(options[1]?.value || options[0].value));
      }

      setDateOptions(options);
    });
  }, []);

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

  async function loadAllSelectDates(): Promise<
    {
      id: number;
      date: string;
    }[]
  > {
    return queryAllDataDates();
  }

  function onBaseSelectChange(id: number) {
    setBaseId(id);
  }

  function onHeadSelectChange(id: number) {
    setHeadId(id);
  }

  function loadData(base: CoinData[], head: CoinData[]): ComparisonData[] {
    const res: ComparisonData[] = [];
    const symbols = _([...base, ...head])
      .map("symbol")
      .uniq()
      .value();
    // make total value and amount as the first two items
    const baseTotal = _(base).sumBy("value");
    const headTotal = _(head).sumBy("value");
    if (!_(symbols).isEmpty()) {
      res.push({
        name: "USD Total Value",
        base: baseTotal,
        head: headTotal,
      });
    }

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
        <div className="comparison-date-picker">
          <div className="comparison-date-picker-item">
            <Select
              options={dateOptions}
              onSelectChange={(v) => onBaseSelectChange(+v)}
              value={"" + baseId}
              width={150}
            />
          </div>
          <div className="comparison-date-picker-item">
            <Select
              options={dateOptions}
              onSelectChange={(v) => onHeadSelectChange(+v)}
              value={"" + headId}
              width={150}
            />
          </div>
        </div>
        {_(data).isEmpty() ? (
          "No Data"
        ) : (
          <div
            className="comparison-row"
            style={{
              fontWeight: "bold",
              color: "#ededed",
              fontSize: "1.2em",
              backgroundColor: "#777777",
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
            <div className="comparison-column">{baseDate}</div>
            <div
              className="comparison-column"
              style={{
                maxWidth: "200px",
              }}
            >
              Difference
            </div>
            <div className="comparison-column">{headDate}</div>
          </div>
        )}
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
