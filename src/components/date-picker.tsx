import { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon, ChevronDownIcon, ClockIcon } from "@radix-ui/react-icons";
import { endOfDay, format, isSameDay, isValid, parse, startOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "@/i18n";
import type { CurrencyRateDetail } from "@/middlelayers/types";
import { currencyWrapper } from "@/utils/currency";

const App = ({
  availableDates,
  value,
  onDateChange,
  overviewFidelity = false,
  currency,
}: {
  // sort asc
  availableDates: Date[];
  value: DateRange | undefined;
  onDateChange: (selectedTimes: number, date?: DateRange) => void;
  overviewFidelity?: boolean;
  currency?: CurrencyRateDetail;
}) => {
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [date, setDate] = useState<DateRange | undefined>(value);
  // whether need to use start or end of selected dates
  const [exact, setExact] = useState<boolean>(true);
  const [changePreview, setChangePreview] = useState<{ value: number; percent: number }>();

  function handleOpenChange(open: boolean) {
    if (open) {
      setDate(value);
      setExact(true);
    }
    setCalendarOpen(open);
  }

  const selectDates = useMemo(() => {
    return {
      from: date?.from
        ? exact
          ? date.from
          : startOfDay(date.from)
        : undefined,
      to: date?.to ? (exact ? date.to : endOfDay(date.to)) : undefined,
    };
  }, [date, exact]);

  const selectTimes = useMemo(() => {
    const from = selectDates.from;
    const to = selectDates.to;
    if (!from || !to) {
      return 0;
    }
    const times = availableDates.filter((d) => d >= from && d <= to).length;
    return times;
  }, [availableDates, selectDates]);

  useEffect(() => {
    if (!overviewFidelity || !selectDates.from || !selectDates.to) return;
    let active = true;
    void import("@/middlelayers/charts").then(({ queryPNLChartValue }) =>
      queryPNLChartValue({ start: selectDates.from!, end: selectDates.to! }))
      .then((points) => {
        if (!active) return;
        const first = points[0]?.totalValue;
        const last = points.at(-1)?.totalValue;
        setChangePreview(first !== undefined && last !== undefined && first > 0
          ? { value: last - first, percent: (last / first - 1) * 100 } : undefined);
      }).catch(() => { if (active) setChangePreview(undefined); });
    return () => { active = false; };
  }, [overviewFidelity, selectDates.from?.getTime(), selectDates.to?.getTime()]);

  function isDayDisabled(day: Date) {
    return !availableDates.find((d) => isSameDay(d, day));
  }

  function handlePredefinedTimesClick(pt: number) {
    if (availableDates.length === 0) {
      setDataRange(undefined, true);
      return;
    }

    const ads =
      pt < 0
        ? availableDates
        : availableDates.slice(
            availableDates.length - pt,
            availableDates.length
          );

    setDataRange(
      {
        from: ads[0],
        to: ads[ads.length - 1],
      },
      true
    );
  }
  function handleDayPreset(days: number) {
    if (!availableDates.length) return;
    const latest = availableDates.at(-1)!;
    const selected = days < 0 ? availableDates : availableDates.filter((item) =>
      item.getTime() >= latest.getTime() - days * 86400000);
    setDataRange({ from: selected[0], to: selected.at(-1) }, true);
  }

  function setDataRange(v: DateRange | undefined, exact: boolean) {
    setDate(v);
    setExact(exact);
  }

  function handleSubmitClick() {
    setCalendarOpen(false);

    onDateChange(selectTimes, selectDates);
  }
  const displayRange = value?.from && value.to
    ? overviewFidelity
      ? `${format(value.from, "d MMM")} – ${format(value.to, "d MMM yyyy")}`
      : `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}`
    : "";
  const customRange = date?.from && date.to
    ? `${format(date.from, "d MMM")} – ${format(date.to, "d MMM yyyy")}` : "";
  const selectedSpan = date?.from && date.to ? Math.round((date.to.getTime() - date.from.getTime()) / 86400000) : -1;
  const committedSpan = value?.from && value.to
    ? Math.round((value.to.getTime() - value.from.getTime()) / 86400000) : -1;
  const previewValue = changePreview && currency
    ? `${changePreview.value > 0 ? "+" : changePreview.value < 0 ? "−" : ""}${currency.symbol}${Math.abs(currencyWrapper(currency)(changePreview.value)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${changePreview.percent > 0 ? "+" : changePreview.percent < 0 ? "−" : ""}${Math.abs(changePreview.percent).toFixed(2)}%)`
    : "";
  const commitInput = (field: "from" | "to", input: string) => {
    const parsed = parse(input, "d MMM yyyy", new Date());
    if (isValid(parsed) && !isDayDisabled(parsed)) {
      setDataRange({
        from: field === "from" ? parsed : date?.from ?? parsed,
        to: field === "to" ? parsed : date?.to,
      }, false);
    }
  };

  return (
    <Popover open={calendarOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("datePicker.open")}
          aria-description={displayRange || undefined}
          className="t3-date-trigger flex min-h-9 touch:min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {overviewFidelity ? <ClockIcon aria-hidden="true" className="h-4 w-4" /> : <CalendarIcon aria-hidden="true" className="h-4 w-4" />}
          <span className="t3-date-range-display" aria-hidden="true"
            data-range={displayRange} />
          {overviewFidelity && <ChevronDownIcon aria-hidden="true" className="t3-date-chevron h-3.5 w-3.5" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="t3-date-popover w-auto touch:w-[calc(100vw-1rem)] max-w-max max-h-[calc(100dvh-1rem)] overflow-auto p-0" align="end" collisionPadding={8}>
        <div className="t3-date-layout flex touch:flex-col">
          {overviewFidelity && <div className="t3-fidelity-presets">
            {[
              [t("overview.fidelity.today"), 0], [t("overview.fidelity.sevenDaysLong"), 7],
              [t("overview.fidelity.thirtyDays"), 30], [t("overview.fidelity.ninetyDays"), 90],
              [t("overview.fidelity.oneYear"), 365], [t("overview.fidelity.allTime"), -1],
              [t("overview.fidelity.customRange"), null],
            ].map(([label, days]) => <button key={label} type="button"
              data-active={days === null ? ![0, 7, 30, 90, 365].includes(selectedSpan) : days === selectedSpan}
              onClick={() => { if (typeof days === "number") handleDayPreset(days); }}>{label}
              {value?.from && value.to && days === committedSpan &&
                <small>{t("overview.fidelity.current")}</small>}</button>)}
          </div>}
          <div className="t3-date-main">
            {overviewFidelity && <div className="t3-date-fields">
              <label>{t("overview.fidelity.from")}<input key={`from:${date?.from?.getTime()}`} type="text"
                defaultValue={date?.from ? format(date.from, "d MMM yyyy") : ""}
                onBlur={(event) => commitInput("from", event.currentTarget.value)} /></label>
              <label>{t("overview.fidelity.to")}<input key={`to:${date?.to?.getTime()}`} type="text"
                defaultValue={date?.to ? format(date.to, "d MMM yyyy") : ""}
                onBlur={(event) => commitInput("to", event.currentTarget.value)} /></label>
            </div>}
            <Calendar
              mode="range"
              showOutsideDays={!overviewFidelity}
              defaultMonth={date?.to}
              selected={date}
              onSelect={(v) => setDataRange(v, false)}
              weekStartsOn={overviewFidelity ? 1 : undefined}
              initialFocus
              disabled={isDayDisabled}
            />
          </div>
          <div className="t3-date-presets px-3 py-5 space-y-2">
            <div className="text-muted-foreground text-sm">
              {t("datePicker.predefined")}
            </div>
            <div className="text-xs">
              <button type="button"
                className="block w-full text-left touch:min-h-11 py-3 px-5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
                onClick={() => handlePredefinedTimesClick(10)}
              >
                {t("datePicker.last10")}
              </button>
              <button type="button"
                className="block w-full text-left touch:min-h-11 py-3 px-5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
                onClick={() => handlePredefinedTimesClick(30)}
              >
                {t("datePicker.last30")}
              </button>
              <button type="button"
                className="block w-full text-left touch:min-h-11 py-3 px-5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
                onClick={() => handlePredefinedTimesClick(50)}
              >
                {t("datePicker.last50")}
              </button>
              <button type="button"
                className="block w-full text-left touch:min-h-11 py-3 px-5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
                onClick={() => handlePredefinedTimesClick(100)}
              >
                {t("datePicker.last100")}
              </button>
              <button type="button"
                className="block w-full text-left touch:min-h-11 py-3 px-5 rounded-md hover:bg-accent/60 cursor-pointer transition-colors"
                onClick={() => handlePredefinedTimesClick(-1)}
              >
                {t("datePicker.all")}
              </button>
            </div>
          </div>
        </div>
        <div className="t3-date-legacy-footer grid gap-4 grid-cols-4 px-5 py-3">
          <Button
            variant="ghost"
            className="col-span-1"
            onClick={() => setCalendarOpen(false)}
          >
            {t("common.cancel")}
          </Button>
          <div className="flex space-x-1 col-span-2 justify-end items-center text-xs">
            <div className="text-muted-foreground">
              {t("datePicker.selected")}
            </div>
            <div>
              {selectTimes} {t("common.times")}
            </div>
          </div>
          <Button
            className="col-start-4 col-span-1"
            disabled={selectTimes === 0}
            onClick={handleSubmitClick}
          >
            {t("common.submit")}
          </Button>
        </div>
        {overviewFidelity && <div className="t3-date-fidelity-footer">
          <div className="t3-date-fidelity-actions">
            <span>{customRange} · {selectTimes} {t("overview.fidelity.snapshots")} · <span className="text-gain">{previewValue}</span></span>
            <button type="button" onClick={() => setCalendarOpen(false)}>{t("common.cancel")}</button>
            <Button size="sm" disabled={selectTimes === 0} onClick={handleSubmitClick}>{t("overview.fidelity.apply")}</Button>
          </div>
          {availableDates[0] && <p>{t("overview.fidelity.firstSnapshot")
            .replace("{date}", format(availableDates[0], "d MMM yyyy"))}</p>}
        </div>}
      </PopoverContent>
    </Popover>
  );
};

export default App;
