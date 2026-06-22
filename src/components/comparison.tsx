import { useEffect, useMemo, useRef, useState } from "react";
import { useDataChangedVersion } from "@/contexts/data-changed";
import { Asset, CurrencyRateDetail, QuoteColor } from "@/middlelayers/types";
import { queryAllDataDates, queryCoinDataByUUID } from "@/middlelayers/charts";
import _ from "lodash";
import bluebird from "bluebird";
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
import { positiveNegativeColor } from "@/utils/color";
import { StaggerContainer, FadeUp } from "./motion";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import PageLoadingOverlay from "./page-loading-overlay";
import AssetLabel from "./common/asset-label";
import {
  formatAssetLabel,
  getAssetLogoKey,
  resolveAssetLogoSrc,
  shouldDownloadCryptoLogo,
} from "@/utils/assets";
import { CalendarIcon, EyeClosedIcon, EyeOpenIcon } from "@radix-ui/react-icons";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { isSameDay } from "date-fns";
import { useTranslation } from "@/i18n";

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
    return _.find(dateOptions, { value: baseId })?.displayLabel;
  }, [dateOptions, baseId]);

  const headDate = useMemo(() => {
    return _.find(dateOptions, { value: headId })?.displayLabel;
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
      const dateCounts = _.countBy(rawOptions, "label");
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
        if (prev && _(options).some((o) => o.value === prev)) {
          return prev;
        }
        return options[1]?.value || options[0].value;
      });
      setHeadId((prev) => {
        if (prev && _(options).some((o) => o.value === prev)) {
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
    const baseMap = _.keyBy(baseData, (asset) => getAssetLogoKey(asset));
    const headMap = _.keyBy(headData, (asset) => getAssetLogoKey(asset));
    const assetKeys = _([...baseData, ...headData])
      .map((asset) => getAssetLogoKey(asset))
      .uniq()
      .value();

    return assetKeys.map((assetKey) => {
      const baseItem = baseMap[assetKey];
      const headItem = headMap[assetKey];
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
    const baseTotal = _(baseData).sumBy("value");
    const headTotal = _(headData).sumBy("value");
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
      _(coinComparisons)
        .filter((coin) => shouldDownloadCryptoLogo(coin))
        .uniqBy((coin) => getAssetLogoKey(coin))
        .value(),
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
    <div className="relative min-h-[400px]" aria-busy={pageLoading}>
      <h1 className="sr-only">{t("comparison.h1")}</h1>
      <StaggerContainer className="space-y-3">
        <FadeUp>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    onClick={onViewOrHideClick}
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 text-muted-foreground hover:text-foreground sm:h-9 sm:w-9"
                    aria-label={shouldMaskValue ? "show values" : "hide values"}
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
                  <div className="flex items-center gap-2">
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
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">{t("comparison.quick")}</span>
                  <ButtonGroup
                    value={currentQuickCompare || ""}
                    onValueChange={(val: string) =>
                      onQuickCompareButtonClick(val as QuickCompareType)
                    }
                  >
                    <ButtonGroupItem value="7D">{t("comparison.7D")}</ButtonGroupItem>
                    <ButtonGroupItem value="1M">{t("comparison.1M")}</ButtonGroupItem>
                    <ButtonGroupItem value="1Y">{t("comparison.1Y")}</ButtonGroupItem>
                    <ButtonGroupItem value="YTD">{t("comparison.ytd")}</ButtonGroupItem>
                    <ButtonGroupItem value="ALL">{t("comparison.all")}</ButtonGroupItem>
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
                        className="text-xl font-semibold truncate tabular-nums"
                        title={formatVal(totalValue.base, "value")}
                      >
                        {formatVal(totalValue.base, "value")}
                      </p>
                    </div>
                    <div className="text-center min-w-0">
                      <p className="text-xs text-muted-foreground">{t("common.changeLabel")}</p>
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
                        className="text-xl font-semibold truncate tabular-nums"
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
              <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                {coinComparisons.map((coin) => (
                  <CoinCard
                    key={getAssetLogoKey(coin)}
                    coin={coin}
                    logo={resolveAssetLogoSrc(
                      coin,
                      logoMap[getAssetLogoKey(coin)],
                    )}
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
    () => _.find(dateOptions, { value }),
    [dateOptions, value],
  );
  const selectedDate = selectedOption
    ? dateOptionToDate(selectedOption)
    : undefined;
  const optionsByDate = useMemo(
    () => _.groupBy(dateOptions, "label"),
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
          className="w-[150px] justify-start gap-2 px-3 font-normal"
          aria-label={`Choose ${label.toLowerCase()}`}
          disabled={dateOptions.length === 0}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
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
              aria-label={t("comparison.snapshotsAria").replace("{label}", label).replace("{date}", activeDateLabel || "")}
            >
              {activeDateOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={option.value === value ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 justify-start px-2 text-xs font-normal"
                  aria-label={`Select ${option.displayLabel} snapshot`}
                  onClick={() => onSnapshotSelect(option)}
                >
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

  const time = createdAt.match(/[T\s](\d{2}:\d{2}(?::\d{2})?)/)?.[1];
  return time || `Snapshot ${index}`;
}

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
    type: "price" | "amount" | "value",
  ) => string;
  changeClass: (percent: number) => string;
}) {
  const { t } = useTranslation();
  const metrics: {
    label: string;
    type: "amount" | "price" | "value";
    row: MetricRow;
  }[] = [
    { label: t("common.amountLabel"), type: "amount", row: coin.amount },
    { label: t("common.priceLabel"), type: "price", row: coin.price },
    { label: t("common.valueLabel"), type: "value", row: coin.value },
  ];

  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-2 mb-3">
          <img
            src={logo}
            alt={formatAssetLabel(coin)}
            className="w-[18px] h-[18px] rounded-full"
          />
          <AssetLabel asset={coin} labelClassName="text-sm font-medium" />
        </div>

        <div className="grid grid-cols-[56px_minmax(0,1fr)_96px_minmax(0,1fr)] mb-1 gap-2">
          <span className="text-xs text-muted-foreground">{t("common.metricLabel")}</span>
          <span className="text-xs text-muted-foreground truncate">
            {baseDate}
          </span>
          <span className="text-xs text-muted-foreground text-center">
            {t("common.changeLabel")}
          </span>
          <span className="text-xs text-muted-foreground text-right truncate">
            {headDate}
          </span>
        </div>

        <div className="space-y-2">
          {metrics.map((m) => {
            const baseText = formatVal(m.row.base, m.type);
            const headText = formatVal(m.row.head, m.type);
            const diffText = formatDeltaValue(m.row.head - m.row.base, m.type);
            return (
              <div
                key={m.type}
                className="grid grid-cols-[56px_minmax(0,1fr)_128px_minmax(0,1fr)] items-center gap-3 py-0.5"
              >
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <span
                  className="text-sm truncate tabular-nums"
                  title={baseText}
                >
                  {baseText}
                </span>
                <div
                  className="min-w-0 text-center truncate"
                  title={`${formatChangePercent(m.row.changePercent)} (${diffText})`}
                >
                  <span
                    className={`text-xs tabular-nums ${changeClass(m.row.changePercent)}`}
                  >
                    {formatChangePercent(m.row.changePercent)}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums ml-1">
                    ({diffText})
                  </span>
                </div>
                <span
                  className="text-sm text-right truncate tabular-nums"
                  title={headText}
                >
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
