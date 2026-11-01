import { useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { queryAllDataDates, queryCoinDataByUUID } from "@/middlelayers/charts";
import { ASSISTANT_APP_ACTION_EVENT, validateActionArgs } from "@/middlelayers/ai/actions";
import { setCurrentComparisonDates, readAssistantComparisonDates, clearAssistantComparisonDates } from "@/middlelayers/ui-state/page-prefs";
import bluebird from "bluebird";
import {
  currencyWrapper,
  prettyNumberKeepNDigitsAfterDecimalPoint,
  prettyNumberToLocaleString,
  prettyPriceNumberToLocaleString,
} from "@/utils/currency";
import { parseDateToTS, timeToDateStr } from "@/utils/date";
import { getImageApiPath } from "@/utils/app";
import { appCacheDir as getAppCacheDir } from "@tauri-apps/api/path";
import { downloadCoinLogos } from "@/middlelayers/data";
import { ButtonGroup, ButtonGroupItem } from "./ui/button-group";
import { positiveNegativeTone } from "@/utils/color";
import { StaggerContainer, FadeUp } from "./motion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import PageLoadingOverlay from "./page-loading-overlay";
import {
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import {
  CalendarIcon,
  EyeClosedIcon,
  EyeOpenIcon,
} from "@radix-ui/react-icons";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { isSameDay } from "date-fns";
import { useTranslation } from "@/i18n";
import ComparisonMoversPanel from "./comparison-movers-panel";

type MetricRow = {
  base: number;
  head: number;
  changePercent: number;
};

type CoinComparison = {
  symbol: string;
  assetType: "crypto" | "stock";
  amount: MetricRow;
  price: MetricRow;
  value: MetricRow;
};

type QuickCompareType = "7D" | "1M" | "1Y" | "YTD" | "ALL";

type DateOption = {
  label: string;
  value: string;
  createdAt?: string;
  snapshotLabel: string;
  displayLabel: string;
};

const App = ({
  currency,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  quoteColor: QuoteColor;
}) => {
  const { t } = useTranslation();
  const [pageLoading, setPageLoading] = useState(true);
  const loadGenRef = useRef(0);

  const [baseId, setBaseId] = useState<string>("");
  const [headId, setHeadId] = useState<string>("");
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]);
  useEffect(() => {
    const base = dateOptions.find((option) => option.value === baseId)?.label;
    const head = dateOptions.find((option) => option.value === headId)?.label;
    if (base && head) setCurrentComparisonDates(base, head);
  }, [baseId, headId, dateOptions]);
  useEffect(() => {
    const applyAssistantDates = () => {
      try {
        const raw = readAssistantComparisonDates();
        if (raw === undefined) return;
        const dates = validateActionArgs("set_comparison_dates", raw);
        const base = dateOptions.find((option) => option.label === dates.base);
        const head = dateOptions.find((option) => option.label === dates.head);
        if (base && head) {
          clearAssistantComparisonDates();
          setCurrentQuickCompare(null);
          setBaseId(base.value);
          setHeadId(head.value);
        }
      } catch {
        clearAssistantComparisonDates();
      }
    };
    applyAssistantDates();
    window.addEventListener(ASSISTANT_APP_ACTION_EVENT, applyAssistantDates);
    return () => window.removeEventListener(ASSISTANT_APP_ACTION_EVENT, applyAssistantDates);
  }, [dateOptions]);
  const [currentQuickCompare, setCurrentQuickCompare] =
    useState<QuickCompareType | null>(null);

  const [baseData, setBaseData] = useState<Asset[]>([]);
  const [headData, setHeadData] = useState<Asset[]>([]);

  const [shouldMaskValue, setShouldMaskValue] = useState<boolean>(false);
  const [logoMap, setLogoMap] = useState<{ [x: string]: string }>({});
  const dataChangedVersion = useDataChangedVersion();
  const downloadedLogosRef = useRef<Set<string>>(new Set());
  const appCacheDirRef = useRef<string>("");

  useEffect(() => {
    if (!baseId || !headId) {
      return;
    }
    setPageLoading(true);
  }, [baseId, headId]);

  const baseDate = useMemo(() => {
    return dateOptions.find((item) => item.value === baseId)?.displayLabel;
  }, [dateOptions, baseId]);

  const headDate = useMemo(() => {
    return dateOptions.find((item) => item.value === headId)?.displayLabel;
  }, [dateOptions, headId]);

  useEffect(() => {
    let cancelled = false;
    const gen = ++loadGenRef.current;

    (async () => {
      const data = await queryAllDataDates();
      if (cancelled || gen !== loadGenRef.current) {
        return;
      }

      const rawOptions = data.map((d) => ({
        label: d.date,
        value: `${d.id}`,
        createdAt: d.createdAt,
      }));
      const dateCounts = rawOptions.reduce(
        (acc, opt) => {
          acc[opt.label] = (acc[opt.label] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      const dateIndexes: Record<string, number> = {};
      const options = rawOptions.map((option) => {
        dateIndexes[option.label] = (dateIndexes[option.label] || 0) + 1;
        const hasMultipleSnapshots = dateCounts[option.label] > 1;
        const snapshotLabel = formatSnapshotLabel(
          option.createdAt,
          dateIndexes[option.label],
        );

        return {
          ...option,
          snapshotLabel,
          displayLabel: hasMultipleSnapshots
            ? `${option.label} ${snapshotLabel}`
            : option.label,
        };
      });

      setDateOptions(options);
      if (options.length === 0) {
        setBaseId("");
        setHeadId("");
        setPageLoading(false);
        return;
      }

      // Seed the initial selection on first load. On subsequent
      // refreshes the user may have picked a specific base/head pair,
      // so we keep their selection rather than snapping to the new
      // latest snapshot.
      setBaseId((prev) => {
        if (prev && options.some((o) => o.value === prev)) {
          return prev;
        }
        return options[1]?.value || options[0].value;
      });
      setHeadId((prev) => {
        if (prev && options.some((o) => o.value === prev)) {
          return prev;
        }
        return options[0].value;
      });
    })().catch(() => {
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
  }, [dataChangedVersion]);

  useEffect(() => {
    if (!baseId || !headId) {
      return;
    }

    let cancelled = false;
    const gen = ++loadGenRef.current;

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
      });

    return () => {
      cancelled = true;
    };
  }, [baseId, headId, dataChangedVersion]);

  const coinComparisons = useMemo((): CoinComparison[] => {
    const buildMap = (items: typeof baseData) =>
      new Map(items.map((asset) => [getAssetLogoKey(asset), asset]));
    const baseMap = buildMap(baseData);
    const headMap = buildMap(headData);
    const assetKeys = Array.from(
      new Set(
        [...baseData, ...headData].map((asset) => getAssetLogoKey(asset)),
      ),
    );

    return assetKeys.map((assetKey) => {
      const baseItem = baseMap.get(assetKey);
      const headItem = headMap.get(assetKey);
      const ref = headItem ?? baseItem;

      const makeRow = (baseVal: number, headVal: number): MetricRow => ({
        base: baseVal,
        head: headVal,
        changePercent: baseVal ? ((headVal - baseVal) / baseVal) * 100 : 0,
      });

      return {
        symbol: ref?.symbol ?? "",
        assetType: ref?.assetType ?? "crypto",
        amount: makeRow(baseItem?.amount || 0, headItem?.amount || 0),
        price: makeRow(baseItem?.price || 0, headItem?.price || 0),
        value: makeRow(baseItem?.value || 0, headItem?.value || 0),
      };
    });
  }, [baseData, headData]);

  const totalValue = useMemo(() => {
    const baseTotal = baseData.reduce((sum, d) => sum + d.value, 0);
    const headTotal = headData.reduce((sum, d) => sum + d.value, 0);
    return {
      base: baseTotal,
      head: headTotal,
      changePercent: baseTotal
        ? ((headTotal - baseTotal) / baseTotal) * 100
        : 0,
    };
  }, [baseData, headData]);

  const symbolsForLogos = useMemo(
    () =>
      coinComparisons
        .filter((coin) => shouldDownloadCryptoLogo(coin))
        .filter(
          (coin, idx, arr) =>
            arr.findIndex(
              (c) => getAssetLogoKey(c) === getAssetLogoKey(coin),
            ) === idx,
        ),
    [coinComparisons],
  );

  useEffect(() => {
    if (symbolsForLogos.length === 0) {
      return;
    }

    let cancelled = false;
    const missingSymbols = symbolsForLogos.filter(
      (asset) => !downloadedLogosRef.current.has(getAssetLogoKey(asset)),
    );

    if (missingSymbols.length > 0) {
      missingSymbols.forEach((asset) =>
        downloadedLogosRef.current.add(getAssetLogoKey(asset)),
      );
      downloadCoinLogos(
        missingSymbols.map((asset) => ({ symbol: asset.symbol, price: 0 })),
      );
    }

    (async () => {
      if (!appCacheDirRef.current) {
        appCacheDirRef.current = await getAppCacheDir();
      }
      const kvs = await bluebird.map(symbolsForLogos, async (asset) => {
        const path = await getImageApiPath(
          appCacheDirRef.current,
          asset.symbol,
        );
        return { [getAssetLogoKey(asset)]: path };
      });

      if (cancelled) {
        return;
      }
      setLogoMap((prev) => ({ ...prev, ...Object.assign({}, ...kvs) }));
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

    const closestDate = dateOptions
      .map((d) => ({
        ...d,
        diff: Math.abs(parseDateToTS(d.label) - targetBaseDate.getTime()),
      }))
      .sort((a, b) => a.diff - b.diff)[0];

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
          (today.getTime() - firstDayOfYear.getTime()) / (24 * 60 * 60 * 1000),
        );
      }
      case "ALL":
        return -1;
      default:
        return 0;
    }
  }

  function onBaseDateChange(id: string) {
    onDateChange(id, "base");
  }

  function onHeadDateChange(id: string) {
    onDateChange(id, "head");
  }

  function onDateChange(id: string, type: "base" | "head") {
    clearAssistantComparisonDates();
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
    return [...data].sort((a, b) => b.value - a.value);
  }

  function prettyNumber(
    number: number,
    type: "price" | "amount" | "value",
    shouldMask = false,
    convertCurrency = false,
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
    type: "price" | "amount" | "value",
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

    const color = positiveNegativeTone(percent, quoteColor);
    if (color === "green") {
      return "text-positive";
    }
    if (color === "red") {
      return "text-negative";
    }
    return "text-muted-foreground";
  }

  function onQuickCompareButtonClick(type: QuickCompareType) {
    clearAssistantComparisonDates();
    setCurrentQuickCompare(type);
  }

  const hasData = coinComparisons.length > 0;

  return (
    <div className="analyze-comparison relative min-h-[400px]" aria-busy={pageLoading}>
      <h1 className="mb-4 text-[26px] font-semibold">{t("comparison.h1")}</h1>
      <StaggerContainer className="space-y-3">
        <FadeUp>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center touch:min-w-0 touch:flex-wrap gap-3">
                  <Button
                    type="button"
                    onClick={onViewOrHideClick}
                    variant="ghost"
                    size="icon"
                    className="touch:h-11 touch:w-11 text-muted-foreground hover:text-foreground h-9 w-9"
                    aria-label={t(shouldMaskValue ? "comparison.showValues" : "comparison.hideValues")}
                    aria-pressed={shouldMaskValue}
                  >
                    {shouldMaskValue ? (
                      <EyeClosedIcon
                        className="h-[22px] w-[22px] text-current"
                        aria-hidden="true"
                      />
                    ) : (
                      <EyeOpenIcon
                        className="h-[22px] w-[22px] text-current"
                        aria-hidden="true"
                      />
                    )}
                  </Button>
                  <div className="flex items-center touch:min-w-0 touch:flex-wrap gap-2">
                    <ComparisonDatePicker
                      label={t("comparison.baseDate")}
                      value={baseId}
                      dateOptions={dateOptions}
                      onChange={onBaseDateChange}
                    />
                    <span className="text-muted-foreground text-sm">vs</span>
                    <ComparisonDatePicker
                      label={t("comparison.headDate")}
                      value={headId}
                      dateOptions={dateOptions}
                      onChange={onHeadDateChange}
                    />
                  </div>
                </div>
                <div className="flex items-center touch:min-w-0 touch:flex-wrap gap-2">
                  <span className="text-muted-foreground text-sm">
                    {t("comparison.quick")}
                  </span>
                  <ButtonGroup
                    value={currentQuickCompare || ""}
                    onValueChange={(val: string) =>
                      onQuickCompareButtonClick(val as QuickCompareType)
                    }
                  >
                    <ButtonGroupItem value="7D">
                      {t("comparison.7D")}
                    </ButtonGroupItem>
                    <ButtonGroupItem value="1M">
                      {t("comparison.1M")}
                    </ButtonGroupItem>
                    <ButtonGroupItem value="1Y">
                      {t("comparison.1Y")}
                    </ButtonGroupItem>
                    <ButtonGroupItem value="YTD">
                      {t("comparison.ytd")}
                    </ButtonGroupItem>
                    <ButtonGroupItem value="ALL">
                      {t("comparison.all")}
                    </ButtonGroupItem>
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
                  {t("common.noData")}
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
                    {t("comparison.totalValue")}
                  </p>
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_minmax(0,1fr)] items-center gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {baseDate}
                      </p>
                      <p
                        className="text-xl font-semibold tracking-tight truncate tabular-nums"
                        title={formatVal(totalValue.base, "value")}
                      >
                        {formatVal(totalValue.base, "value")}
                      </p>
                    </div>
                    <div className="text-center min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {t("common.changeLabel")}
                      </p>
                      <p
                        className={`text-sm font-semibold tabular-nums truncate ${changeClass(totalValue.changePercent)}`}
                      >
                        {formatChangePercent(totalValue.changePercent)}
                      </p>
                      <p
                        className={`text-xs tabular-nums truncate ${changeClass(
                          totalValue.changePercent,
                        )}`}
                        title={formatDeltaValue(
                          totalValue.head - totalValue.base,
                          "value",
                        )}
                      >
                        {formatDeltaValue(
                          totalValue.head - totalValue.base,
                          "value",
                        )}
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {headDate}
                      </p>
                      <p
                        className="text-xl font-semibold tracking-tight truncate tabular-nums"
                        title={formatVal(totalValue.head, "value")}
                      >
                        {formatVal(totalValue.head, "value")}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </FadeUp>

            <FadeUp>
              <Card className="comparison-assets-card">
                <CardContent className="overflow-x-auto pt-5" tabIndex={0} aria-label={t("comparison.perAsset")}>
                  <h2 className="mb-3 text-base font-semibold">{t("comparison.perAsset")}</h2>
                  <table className="comparison-assets-table w-full min-w-[850px] text-sm">
                    <caption className="sr-only">{t("comparison.perAsset")}</caption>
                    <thead><tr className="border-b text-xs text-muted-foreground">
                      <th className="py-3 text-left">{t("cost.asset")}</th>
                      <th className="py-3 text-right">{t("common.amountLabel")} A</th>
                      <th className="py-3 text-right">{t("common.amountLabel")} B</th>
                      <th className="py-3 text-right">{t("common.priceLabel")} A</th>
                      <th className="py-3 text-right">{t("common.priceLabel")} B</th>
                      <th className="py-3 text-right">{t("common.valueLabel")} A</th>
                      <th className="py-3 text-right">{t("common.valueLabel")} B</th>
                      <th className="py-3 text-right">{t("common.changeLabel")}</th>
                    </tr></thead>
                    <tbody>{[...coinComparisons].sort((a, b) =>
                      Math.abs(b.value.head - b.value.base) - Math.abs(a.value.head - a.value.base),
                    ).map((coin) => <tr key={getAssetLogoKey(coin)} className="border-b last:border-b-0">
                      <td className="py-3 font-semibold">{formatAssetLabel(coin)}</td>
                      <td className="py-3 text-right">{formatVal(coin.amount.base, "amount")}</td>
                      <td className="py-3 text-right">{formatVal(coin.amount.head, "amount")}</td>
                      <td className="py-3 text-right">{formatVal(coin.price.base, "price")}</td>
                      <td className="py-3 text-right">{formatVal(coin.price.head, "price")}</td>
                      <td className="py-3 text-right">{formatVal(coin.value.base, "value")}</td>
                      <td className="py-3 text-right">{formatVal(coin.value.head, "value")}</td>
                      <td className={`py-3 text-right ${changeClass(coin.value.changePercent)}`}>
                        {formatDeltaValue(coin.value.head - coin.value.base, "value")}
                        <span className="block text-xs">{formatChangePercent(coin.value.changePercent)}</span>
                      </td>
                    </tr>)}</tbody>
                  </table>
                </CardContent>
              </Card>
            </FadeUp>
            <FadeUp>
              <ComparisonMoversPanel rows={coinComparisons} currency={currency} quoteColor={quoteColor} t={t} shouldMaskValue={shouldMaskValue} />
            </FadeUp>
          </>
        )}
      </StaggerContainer>
      {pageLoading && (
        <PageLoadingOverlay
          title={t("loading.comparison")}
          description={t("loading.comparisonDesc")}
        />
      )}
    </div>
  );
};

function ComparisonDatePicker({
  label,
  value,
  dateOptions,
  onChange,
}: {
  label: string;
  value: string;
  dateOptions: DateOption[];
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [activeDateLabel, setActiveDateLabel] = useState<string | undefined>();
  const selectedOption = useMemo(
    () => dateOptions.find((item) => item.value === value),
    [dateOptions, value],
  );
  const selectedDate = selectedOption
    ? dateOptionToDate(selectedOption)
    : undefined;
  const optionsByDate = useMemo(
    () =>
      dateOptions.reduce(
        (acc, opt) => {
          (acc[opt.label] = acc[opt.label] || []).push(opt);
          return acc;
        },
        {} as Record<string, typeof dateOptions>,
      ),
    [dateOptions],
  );
  const selectableDates = useMemo(
    () => dateOptions.map(dateOptionToDate),
    [dateOptions],
  );
  const multipleSnapshotDates = useMemo(
    () =>
      Object.values(optionsByDate)
        .filter((options) => options.length > 1)
        .map((options) => dateOptionToDate(options[0])),
    [optionsByDate],
  );
  const activeDateOptions = activeDateLabel
    ? optionsByDate[activeDateLabel] || []
    : [];
  const calendarSelectedDate =
    activeDateOptions.length > 0
      ? dateOptionToDate(activeDateOptions[0])
      : selectedDate;

  useEffect(() => {
    if (open) {
      setActiveDateLabel(selectedOption?.label);
    }
  }, [open, selectedOption?.label]);

  function onDateSelect(date?: Date) {
    if (!date) {
      return;
    }

    const dateSnapshots = dateOptions.filter((option) =>
      isSameDay(dateOptionToDate(option), date),
    );
    if (dateSnapshots.length === 0) {
      return;
    }

    if (dateSnapshots.length > 1) {
      setActiveDateLabel(dateSnapshots[0].label);
      return;
    }

    onChange(dateSnapshots[0].value);
    setOpen(false);
  }

  function onSnapshotSelect(option: DateOption) {
    onChange(option.value);
    setOpen(false);
  }

  function isDayDisabled(day: Date) {
    return !selectableDates.some((date) => isSameDay(date, day));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-[150px] touch:w-[min(150px,100%)] justify-start gap-2 px-3 font-normal"
          disabled={dateOptions.length === 0}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="sr-only">{label}: </span>
          <span className="truncate">
            {selectedOption?.displayLabel || label}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={calendarSelectedDate}
          onSelect={onDateSelect}
          defaultMonth={calendarSelectedDate}
          disabled={isDayDisabled}
          modifiers={{ multipleSnapshots: multipleSnapshotDates }}
          modifiersClassNames={{
            multipleSnapshots: "font-semibold underline underline-offset-4",
          }}
          initialFocus
        />
        {activeDateOptions.length > 1 && (
          <div className="border-t px-3 py-3">
            <div className="mb-2 text-xs text-muted-foreground">
              {t("comparison.snapshots")
                .replace("{count}", String(activeDateOptions.length))
                .replace("{date}", activeDateLabel || "")}
            </div>
            <div
              className="grid gap-1"
              role="group"
              aria-label={t("comparison.snapshotsAria")
                .replace("{label}", label)
                .replace("{date}", activeDateLabel || "")}
            >
              {activeDateOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={option.value === value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 justify-start px-2 text-xs font-normal"
                  onClick={() => onSnapshotSelect(option)}
                >
                  <span className="sr-only">{t("comparison.selectSnapshot").replace("{date}", option.displayLabel)}</span>
                  <span>{option.snapshotLabel}</span>
                  {option.value === value && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {t("comparison.selected")}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function dateOptionToDate(option: DateOption): Date {
  return new Date(parseDateToTS(option.label));
}

function formatSnapshotLabel(createdAt: string | undefined, index: number) {
  if (!createdAt) {
    return `Snapshot ${index}`;
  }

  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return `Snapshot ${index}`;
  }

  const time = timeToDateStr(date, true).split(" ")[1];
  return time || `Snapshot ${index}`;
}

export default App;
