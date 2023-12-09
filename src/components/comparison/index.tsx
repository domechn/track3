import { useEffect, useMemo, useState } from "react";
import "./index.css";
import { CoinData, CurrencyRateDetail } from "@/middlelayers/types";
import { queryAllDataDates, queryCoinDataByUUID } from "@/middlelayers/charts";
import _ from "lodash";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import { currencyWrapper, prettyNumberToLocaleString } from "@/utils/currency";
import { useWindowSize } from "@/utils/hook";
import { parseDateToTS } from "@/utils/date";
import { ButtonGroup, ButtonGroupItem } from "../ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type ComparisonData = {
  name: string;
  base: number;
  head: number;
};

type QuickCompareType = "7D" | "1M" | "1Q" | "1Y";

const App = ({ currency }: { currency: CurrencyRateDetail }) => {
  const [baseId, setBaseId] = useState<string>("");
  const [dateOptions, setDateOptions] = useState<
    {
      label: string;
      value: string;
    }[]
  >([]);

  const [currentQuickCompare, setCurrentQuickCompare] =
    useState<QuickCompareType | null>(null);

  const windowSize = useWindowSize();

  const baseDate = useMemo(() => {
    return _.find(dateOptions, { value: "" + baseId })?.label;
  }, [dateOptions, baseId]);
  const [headId, setHeadId] = useState<string>("");
  const headDate = useMemo(() => {
    return _.find(dateOptions, { value: "" + headId })?.label;
  }, [dateOptions, headId]);

  const [baseData, setBaseData] = useState<CoinData[]>([]);
  const [headData, setHeadData] = useState<CoinData[]>([]);

  const [data, setData] = useState<ComparisonData[]>([]);

  const [showDetail, setShowDetail] = useState<boolean>(true);

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
        setHeadId(options[0].value);
      }

      // if baseDate is not set, set it to the second latest date
      if (!baseDate && options.length > 0) {
        setBaseId(options[1]?.value || options[0].value);
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
    loadDataByUUID(baseId).then((data) => setBaseData(data));
  }, [baseId]);

  useEffect(() => {
    if (!headId) {
      return;
    }
    loadDataByUUID(headId).then((data) => setHeadData(data));
  }, [headId]);

  // update quick compare data ( baseId and headId )
  useEffect(() => {
    if (!currentQuickCompare) {
      return;
    }

    // set headId to latest
    const latestDate = dateOptions[0];
    setHeadId(latestDate.value);

    // get days from QuickCompareType
    const days = parseDaysQuickCompareType(currentQuickCompare);
    const baseDate = new Date(
      parseDateToTS(latestDate.label) - days * 24 * 60 * 60 * 1000
    );

    // find the closest date
    const closestDate = _(dateOptions)
      .map((d) => ({
        ...d,
        diff: Math.abs(parseDateToTS(d.label) - baseDate.getTime()),
      }))
      .sortBy("diff")
      .first();

    if (!closestDate) {
      return;
    }
    setBaseId(closestDate?.value);
  }, [currentQuickCompare]);

  function parseDaysQuickCompareType(type: QuickCompareType): number {
    switch (type) {
      case "7D":
        return 7;
      case "1M":
        return 30;
      case "1Q":
        return 90;
      case "1Y":
        return 365;
      default:
        return 0;
    }
  }

  async function loadAllSelectDates(): Promise<
    {
      id: string;
      date: string;
    }[]
  > {
    return queryAllDataDates();
  }

  function onBaseSelectChange(id: string) {
    return onSelectChange(id, "base");
  }

  function onHeadSelectChange(id: string) {
    return onSelectChange(id, "head");
  }

  function onSelectChange(id: string, type: "base" | "head") {
    setCurrentQuickCompare(null);
    if (type === "base") {
      setBaseId(id);
    } else {
      setHeadId(id);
    }
  }

  function onViewOrHideClick() {
    setShowDetail(!showDetail);
  }

  function loadData(base: CoinData[], head: CoinData[]): ComparisonData[] {
    const res: ComparisonData[] = [];
    const symbols = _([...base, ...head])
      .map("symbol")
      .uniq()
      .value();

    const others = "Others";

    // add others to last
    symbols.sort((a, b) => {
      if (a === others) {
        return 1;
      }
      if (b === others) {
        return -1;
      }
      // origin order
      return 0;
    });

    // make total value and amount as the first two items
    const baseTotal = _(base).sumBy("value");
    const headTotal = _(head).sumBy("value");
    if (!_(symbols).isEmpty()) {
      res.push({
        name: "Total Value",
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

      if (symbol === others) {
        return;
      }

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

  async function loadDataByUUID(uuid: string): Promise<CoinData[]> {
    // return queryCoinDataById(id);
    const data = await queryCoinDataByUUID(uuid);
    const reversedData = _(data).sortBy("value").reverse().value();

    const res = _(reversedData).value();

    return res;
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
      return "↑ " + prettyNumber(per, false) + "%";
    }

    return "↓ " + -prettyNumber(per, false) + "%";
  }

  function prettyNumber(
    number: number,
    keepDecimal: boolean,
    showRealNumber = true,
    convertCurrency = false
  ): string {
    if (!showRealNumber) {
      return "***";
    }
    if (!number) {
      return "-";
    }
    let convertedNumber = number;
    if (convertCurrency) {
      convertedNumber = currencyWrapper(currency)(number);
    }
    let res = "" + convertedNumber;
    if (!keepDecimal) {
      res = prettyNumberToLocaleString(convertedNumber);
    }
    if (convertCurrency) {
      return `${currency.symbol} ${res}`;
    }
    return res;
  }

  function showColumnVal(
    item: ComparisonData,
    valType: "base" | "head"
  ): string {
    return prettyNumber(
      _(item).get(valType),
      item.name.includes("Amount") || item.name.includes("Price"),
      // don't hide price
      showDetail || item.name.includes("Price"),
      item.name.includes("Price") || item.name.includes("Value")
    );
  }

  function onQuickCompareButtonClick(type: QuickCompareType) {
    setCurrentQuickCompare(type);
  }

  return (
    <>
      <div id="comparison-container" className="comparison-container">
        <div>
          <div className="flex mb-4 items-center justify-end">
            <div className="mr-5">
              <a onClick={onViewOrHideClick}>
                <img
                  className="view-or-hide-icon"
                  src={showDetail ? ViewIcon : HideIcon}
                  alt="view-or-hide"
                  width={25}
                  height={25}
                />
              </a>
            </div>
            <div className="mr-2 text-gray-400 text-m flex items-center">
              Quick Compare
            </div>
            <ButtonGroup
              value={currentQuickCompare || ""}
              onValueChange={(val: string) =>
                onQuickCompareButtonClick(val as QuickCompareType)
              }
            >
              <ButtonGroupItem value="7D">7D</ButtonGroupItem>
              <ButtonGroupItem value="1M">1M</ButtonGroupItem>
              <ButtonGroupItem value="1Q">1Q</ButtonGroupItem>
              <ButtonGroupItem value="1Y">1Y</ButtonGroupItem>
            </ButtonGroup>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-4 mb-5">
          <div className="col-start-2 col-end-4">
            <Select onValueChange={onBaseSelectChange} value={baseId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select Base Date" />
              </SelectTrigger>
              <SelectContent className="overflow-y-auto max-h-[20rem]">
                <SelectGroup>
                  <SelectLabel>Base Dates</SelectLabel>
                  {dateOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="col-end-7 col-span-2">
            <Select onValueChange={onHeadSelectChange} value={headId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select Head Date" />
              </SelectTrigger>
              <SelectContent className="overflow-y-auto max-h-[20rem]">
                <SelectGroup>
                  <SelectLabel>Head Dates</SelectLabel>
                  {dateOptions.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
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
              fontSize: Math.min(18, windowSize.width! / 35) + "px",
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
            <div
              className="comparison-column"
              title={showColumnVal(item, "base")}
            >
              {showColumnVal(item, "base")}
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
              title={prettyComparisonResult(item.base, item.head)}
            >
              {prettyComparisonResult(item.base, item.head)}
            </div>
            <div
              className="comparison-column"
              title={showColumnVal(item, "head")}
            >
              {showColumnVal(item, "head")}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default App;
