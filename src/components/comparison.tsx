import { useEffect, useMemo, useRef, useState } from "react";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { queryAllDataDates, queryCoinDataByUUID } from "@/middlelayers/charts";
import _ from "lodash";
import bluebird from "bluebird";
import ViewIcon from "@/assets/icons/view-icon.png";
import HideIcon from "@/assets/icons/hide-icon.png";
import UnknownLogo from "@/assets/icons/unknown-logo.svg";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { parseDateToTS } from "@/utils/date";
import { getImageApiPath } from "@/utils/app";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { downloadCoinLogos } from "@/middlelayers/data";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { positiveNegativeColor } from "@/utils/color";
import { StaggerContainer, FadeUp } from "./motion";
import { Card, CardContent } from "./ui/card";

type MetricRow = {
  base: number;
  head: number;
  changePercent: number;
};

type CoinComparison = {
  symbol: string;
  amount: MetricRow;
  price: MetricRow;
  value: MetricRow;
};

type QuickCompareType = "7D" | "1M" | "1Y" | "YTD" | "ALL";

type DateOption = {
  label: string;
  value: string;
};

const App = ({
  currency,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const [pageLoading, setPageLoading] = useState(true);
  const loadGenRef = useRef(0);

  const [baseId, setBaseId] = useState<string>("");
  const [headId, setHeadId] = useState<string>("");
  const [prevSelection, setPrevSelection] = useState({
    baseId: "",
    headId: "",
  });
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  const [currentQuickCompare, setCurrentQuickCompare] =
    useState<QuickCompareType | null>(null);

  const [baseData, setBaseData] = useState<Asset[]>([]);
  const [headData, setHeadData] = useState<Asset[]>([]);

  const [shouldMaskValue, setShouldMaskValue] = useState<boolean>(false);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const downloadedLogosRef = useRef<Set<string>>(new Set());
  const appCacheDirRef = useRef<string>("");

  if (prevSelection.baseId !== baseId || prevSelection.headId !== headId) {
    setPrevSelection({ baseId, headId });
    setPageLoading(true);
  }

  const baseDate = useMemo(() => {
    return _.find(dateOptions, { value: baseId })?.label;
  }, [dateOptions, baseId]);

  const headDate = useMemo(() => {
    return _.find(dateOptions, { value: headId })?.label;
  }, [dateOptions, headId]);

  useEffect(() => {
    let cancelled = false;
    const gen = ++loadGenRef.current;

    (async () => {
      const data = await queryAllDataDates();
      if (cancelled || gen !== loadGenRef.current) {
        return;
      }

      const options = _(data)
        .map((d) => ({
          label: d.date,
          value: `${d.id}`,
        }))
        .value();

      setDateOptions(options);
      if (options.length === 0) {
        setBaseId("");
        setHeadId("");
        setPageLoading(false);
        return;
      }

      setHeadId(options[0].value);
      setBaseId(options[1]?.value || options[0].value);
    })()
      .catch(() => {
        if (!cancelled && gen === loadGenRef.current) {
          setDateOptions([]);
          setBaseData([]);
          setHeadData([]);
          setPageLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!baseId || !headId) {
      return;
    }

    let cancelled = false;
    const gen = ++loadGenRef.current;

    const fallback = setTimeout(() => {
      if (!cancelled && gen === loadGenRef.current) {
        setPageLoading(false);
      }
    }, 8000);

    Promise.all([loadDataByUUID(baseId), loadDataByUUID(headId)])
      .then(([nextBaseData, nextHeadData]) => {
        if (cancelled || gen !== loadGenRef.current) {
          return;
        }
        setBaseData(nextBaseData);
        setHeadData(nextHeadData);
        setPageLoading(false);
      })
      .catch(() => {
        if (!cancelled && gen === loadGenRef.current) {
          setBaseData([]);
          setHeadData([]);
          setPageLoading(false);
        }
      })
      .finally(() => clearTimeout(fallback));

    return () => {
      cancelled = true;
      clearTimeout(fallback);
    };
  }, [baseId, headId]);

  const coinComparisons = useMemo((): CoinComparison[] => {
    const baseMap = _.keyBy(baseData, "symbol");
    const headMap = _.keyBy(headData, "symbol");
    const symbols = _([...baseData, ...headData])
      .map("symbol")
      .uniq()
      .value();

    return symbols.map((symbol) => {
      const baseItem = baseMap[symbol];
      const headItem = headMap[symbol];

      const makeRow = (baseVal: number, headVal: number): MetricRow => ({
        base: baseVal,
        head: headVal,
        changePercent: baseVal ? ((headVal - baseVal) / baseVal) * 100 : 0,
      });

      return {
        symbol,
        amount: makeRow(baseItem?.amount || 0, headItem?.amount || 0),
        price: makeRow(baseItem?.price || 0, headItem?.price || 0),
        value: makeRow(baseItem?.value || 0, headItem?.value || 0),
      };
    });
  }, [baseData, headData]);

  const totalValue = useMemo(() => {
    const baseTotal = _(baseData).sumBy("value");
    const headTotal = _(headData).sumBy("value");
    return {
      base: baseTotal,
      head: headTotal,
      changePercent: baseTotal ? ((headTotal - baseTotal) / baseTotal) * 100 : 0,
    };
  }, [baseData, headData]);

  const symbolsForLogos = useMemo(
    () => _(coinComparisons).map("symbol").uniq().value(),
    [coinComparisons]
  );

  useEffect(() => {
    if (symbolsForLogos.length === 0) {
      return;
    }

    let cancelled = false;
    const missingSymbols = symbolsForLogos.filter(
      (s) => !downloadedLogosRef.current.has(s)
    );

    if (missingSymbols.length > 0) {
      missingSymbols.forEach((s) => downloadedLogosRef.current.add(s));
      downloadCoinLogos(missingSymbols.map((symbol) => ({ symbol, price: 0 })));
    }

    (async () => {
      if (!appCacheDirRef.current) {
        appCacheDirRef.current = await getAppCacheDir();
      }
      const kvs = await bluebird.map(symbolsForLogos, async (s) => {
        const path = await getImageApiPath(appCacheDirRef.current, s);
        return { [s]: path };
      });

      if (cancelled) {
        return;
      }
      setLogoMap((prev) => ({ ...prev, ..._.assign({}, ...kvs) }));
    })();

    return () => {
      cancelled = true;
    };
  }, [symbolsForLogos]);

  useEffect(() => {
    if (!currentQuickCompare || dateOptions.length === 0) {
      return;
    }

    const latestDate = dateOptions[0];
    setHeadId(latestDate.value);

    const days = parseDaysQuickCompareType(currentQuickCompare);
    const targetBaseDate =
      days >= 0
        ? new Date(parseDateToTS(latestDate.label) - days * 24 * 60 * 60 * 1000)
        : new Date(0);

    const closestDate = _(dateOptions)
      .map((d) => ({
        ...d,
        diff: Math.abs(parseDateToTS(d.label) - targetBaseDate.getTime()),
      }))
      .sortBy("diff")
      .first();

    if (closestDate) {
      setBaseId(closestDate.value);
    }
  }, [currentQuickCompare, dateOptions]);

  function parseDaysQuickCompareType(type: QuickCompareType): number {
    switch (type) {
      case "7D":
        return 7;
      case "1M":
        return 30;
      case "1Y":
        return 365;
      case "YTD": {
        const today = new Date();
        const year = today.getFullYear();
        const firstDayOfYear = new Date(year, 0, 1);
        return Math.floor(
          (today.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000)
        );
      }
      case "ALL":
        return -1;
      default:
        return 0;
    }
  }

  function onBaseSelectChange(id: string) {
    onSelectChange(id, "base");
  }

  function onHeadSelectChange(id: string) {
    onSelectChange(id, "head");
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
    setShouldMaskValue((prev) => !prev);
  }

  async function loadDataByUUID(uuid: string): Promise<Asset[]> {
    const data = await queryCoinDataByUUID(uuid);
    return _(data).sortBy("value").reverse().value();
  }

  function prettyNumber(
    number: number,
    type: "price" | "amount" | "value",
    shouldMask = false,
    convertCurrency = false
  ): string {
    if (shouldMask) {
      return "***";
    }
    if (!number) {
      return "-";
    }

    let convertedNumber = number;
    if (convertCurrency) {
      convertedNumber = currencyWrapper(currency)(number);
    }

    let res = `${convertedNumber}`;
    if (type === "price") {
      res = prettyPriceNumberToLocaleString(convertedNumber);
    } else if (type === "amount") {
      res = `${prettyNumberKeepNDigitsAfterDecimalPoint(convertedNumber, 8)}`;
    } else if (type === "value") {
      res = prettyNumberToLocaleString(convertedNumber);
    }

    if (convertCurrency) {
      return `${currency.symbol} ${res}`;
    }
    return res;
  }

  function formatVal(val: number, type: "price" | "amount" | "value"): string {
    const shouldMask = shouldMaskValue && type !== "price";
    const shouldConvertCurrency = type === "price" || type === "value";
    return prettyNumber(val, type, shouldMask, shouldConvertCurrency);
  }

  function formatChangePercent(percent: number): string {
    const absStr = prettyNumberToLocaleString(Math.abs(percent));
    if (absStr === "0.00" || absStr === "-0.00") {
      return "-";
    }
    const prefix = percent > 0 ? "↑ " : "↓ ";
    return prefix + absStr + "%";
  }

  function formatDeltaValue(
    diff: number,
    type: "price" | "amount" | "value"
  ): string {
    const prefix = diff > 0 ? "+" : diff < 0 ? "-" : "";
    const abs = Math.abs(diff);
    const raw = formatVal(abs, type);
    if (raw === "-") {
      return "-";
    }
    if (prefix === "") {
      return raw;
    }
    return `${prefix}${raw}`;
  }

  function changeClass(percent: number): string {
    const absStr = prettyNumberToLocaleString(Math.abs(percent));
    if (absStr === "0.00" || absStr === "-0.00") {
      return "text-muted-foreground";
    }

    const color = positiveNegativeColor(percent, quoteColor);
    if (color === "green") {
      return "text-emerald-500";
    }
    if (color === "red") {
      return "text-rose-500";
    }
    return "text-muted-foreground";
  }

  function onQuickCompareButtonClick(type: QuickCompareType) {
    setCurrentQuickCompare(type);
  }

  const hasData = coinComparisons.length > 0;

  return (
    <div className="relative min-h-[400px]">
      <StaggerContainer className="space-y-3">
        <FadeUp>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onViewOrHideClick}
                    className="cursor-pointer"
                    aria-label={shouldMaskValue ? "show values" : "hide values"}
                  >
                    <img
                      src={shouldMaskValue ? HideIcon : ViewIcon}
                      alt="view-or-hide"
                      width={22}
                      height={22}
                    />
                  </button>
                  <div className="flex items-center gap-2">
                    <Select onValueChange={onBaseSelectChange} value={baseId}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Base Date" />
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
                    <span className="text-muted-foreground text-sm">vs</span>
                    <Select onValueChange={onHeadSelectChange} value={headId}>
                      <SelectTrigger className="w-[150px]">
                        <SelectValue placeholder="Head Date" />
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
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Quick</span>
                  <ButtonGroup
                    value={currentQuickCompare || ""}
                    onValueChange={(val: string) =>
                      onQuickCompareButtonClick(val as QuickCompareType)
                    }
                  >
                    <ButtonGroupItem value="7D">7D</ButtonGroupItem>
                    <ButtonGroupItem value="1M">1M</ButtonGroupItem>
                    <ButtonGroupItem value="1Y">1Y</ButtonGroupItem>
                    <ButtonGroupItem value="YTD">YTD</ButtonGroupItem>
                    <ButtonGroupItem value="ALL">ALL</ButtonGroupItem>
                  </ButtonGroup>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeUp>

        {!hasData && !pageLoading && (
          <FadeUp>
            <Card>
              <CardContent className="pt-5">
                <div className="text-lg text-muted-foreground text-center py-8">
                  No Data
                </div>
              </CardContent>
            </Card>
          </FadeUp>
        )}

        {hasData && (
          <>
            <FadeUp>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="text-sm font-medium text-muted-foreground mb-3">
                    Total Value
                  </p>
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{baseDate}</p>
                      <p className="text-xl font-semibold truncate tabular-nums" title={formatVal(totalValue.base, "value")}>
                        {formatVal(totalValue.base, "value")}
                      </p>
                    </div>
                    <div className="text-center min-w-0">
                      <p className="text-xs text-muted-foreground">Change</p>
                      <p className={`text-sm font-semibold tabular-nums truncate ${changeClass(totalValue.changePercent)}`}>
                        {formatChangePercent(totalValue.changePercent)}
                      </p>
                      <p
                        className={`text-xs tabular-nums truncate ${changeClass(
                          totalValue.changePercent
                        )}`}
                        title={formatDeltaValue(
                          totalValue.head - totalValue.base,
                          "value"
                        )}
                      >
                        {formatDeltaValue(totalValue.head - totalValue.base, "value")}
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-xs text-muted-foreground truncate">{headDate}</p>
                      <p className="text-xl font-semibold truncate tabular-nums" title={formatVal(totalValue.head, "value")}>
                        {formatVal(totalValue.head, "value")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeUp>

            <FadeUp>
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {coinComparisons.map((coin) => (
                  <CoinCard
                    key={coin.symbol}
                    coin={coin}
                    logo={logoMap[coin.symbol] || UnknownLogo}
                    baseDate={baseDate}
                    headDate={headDate}
                    formatVal={formatVal}
                    formatChangePercent={formatChangePercent}
                    formatDeltaValue={formatDeltaValue}
                    changeClass={changeClass}
                  />
                ))}
              </div>
            </FadeUp>
          </>
        )}
      </StaggerContainer>
      <div
        className={`absolute inset-0 z-10 backdrop-blur-md bg-background/60 rounded-lg transition-opacity duration-500 ${
          pageLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
    </div>
  );
};

function CoinCard({
  coin,
  logo,
  baseDate,
  headDate,
  formatVal,
  formatChangePercent,
  formatDeltaValue,
  changeClass,
}: {
  coin: CoinComparison;
  logo: string;
  baseDate?: string;
  headDate?: string;
  formatVal: (val: number, type: "price" | "amount" | "value") => string;
  formatChangePercent: (percent: number) => string;
  formatDeltaValue: (
    diff: number,
    type: "price" | "amount" | "value"
  ) => string;
  changeClass: (percent: number) => string;
}) {
  const metrics: { label: string; type: "amount" | "price" | "value"; row: MetricRow }[] = [
    { label: "Amount", type: "amount", row: coin.amount },
    { label: "Price", type: "price", row: coin.price },
    { label: "Value", type: "value", row: coin.value },
  ];

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <img
            src={logo}
            alt={coin.symbol}
            className="w-[18px] h-[18px] rounded-full"
          />
          <span className="text-sm font-medium">{coin.symbol}</span>
        </div>

        <div className="grid grid-cols-[56px_minmax(0,1fr)_96px_minmax(0,1fr)] mb-1 gap-2">
          <span className="text-xs text-muted-foreground">Metric</span>
          <span className="text-xs text-muted-foreground truncate">{baseDate}</span>
          <span className="text-xs text-muted-foreground text-center">Change</span>
          <span className="text-xs text-muted-foreground text-right truncate">{headDate}</span>
        </div>

        <div className="space-y-2">
          {metrics.map((m) => {
            const baseText = formatVal(m.row.base, m.type);
            const headText = formatVal(m.row.head, m.type);
            const diffText = formatDeltaValue(m.row.head - m.row.base, m.type);
            return (
              <div key={m.type} className="grid grid-cols-[56px_minmax(0,1fr)_128px_minmax(0,1fr)] items-center gap-3 py-0.5">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <span className="text-sm truncate tabular-nums" title={baseText}>
                  {baseText}
                </span>
                <div className="min-w-0 text-center truncate" title={`${formatChangePercent(m.row.changePercent)} (${diffText})`}>
                  <span className={`text-xs tabular-nums ${changeClass(m.row.changePercent)}`}>
                    {formatChangePercent(m.row.changePercent)}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
                    ({diffText})
                  </span>
                </div>
                <span className="text-sm text-right truncate tabular-nums" title={headText}>
                  {headText}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default App;
