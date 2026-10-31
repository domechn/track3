import { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { endOfDay, format, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import { useTranslation } from "@/i18n";

const App = ({
  availableDates,
  value,
  onDateChange,
}: {
  // sort asc
  availableDates: Date[];
  value: DateRange | undefined;
  onDateChange: (selectedTimes: number, date?: DateRange) => void;
}) => {
  const { t } = useTranslation();
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [date, setDate] = useState<DateRange | undefined>(value);
  // whether need to use start or end of selected dates
  const [exact, setExact] = useState<boolean>(true);

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

  function setDataRange(v: DateRange | undefined, exact: boolean) {
    setDate(v);
    setExact(exact);
  }

  function handleSubmitClick() {
    setCalendarOpen(false);

    onDateChange(selectTimes, selectDates);
  }

  return (
    <Popover open={calendarOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button type="button" aria-label={t("datePicker.open")}
          aria-description={value?.from && value.to ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}` : undefined}
          className="t3-date-trigger flex min-h-9 touch:min-h-11 items-center justify-center gap-2 rounded-md border border-border px-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <CalendarIcon aria-hidden="true" className="h-4 w-4" />
          <span className="t3-date-range-display" aria-hidden="true"
            data-range={value?.from && value.to ? `${format(value.from, "MMM d")} – ${format(value.to, "MMM d, yyyy")}` : ""} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="t3-date-popover w-auto touch:w-[calc(100vw-1rem)] max-w-max max-h-[calc(100dvh-1rem)] overflow-auto p-0" align="end" collisionPadding={8}>
        <div className="flex touch:flex-col">
          <Calendar
            mode="range"
            defaultMonth={date?.to}
            selected={date}
            onSelect={(v) => setDataRange(v, false)}
            initialFocus
            disabled={isDayDisabled}
          />
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
        <div className="grid gap-4 grid-cols-4 px-5 py-3">
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
      </PopoverContent>
    </Popover>
  );
};

export default App;
