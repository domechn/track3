import { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { endOfDay, isSameDay, startOfDay } from "date-fns";
import { useMemo, useState } from "react";
import _ from "lodash";

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
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [date, setDate] = useState<DateRange | undefined>(value);
  // whether need to use start or end of selected dates
  const [exact, setExact] = useState<boolean>(true);

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
    const times = _(availableDates)
      .filter((d) => d >= from && d <= to)
      .value().length;
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
    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
      <PopoverTrigger asChild>
        <CalendarIcon className="h-6 w-6 font-normal cursor-pointer text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <Calendar
            mode="range"
            defaultMonth={date?.to}
            selected={date}
            onSelect={(v) => setDataRange(v, false)}
            initialFocus
            disabled={isDayDisabled}
          />
          <div className="px-3 py-5 space-y-2">
            <div className="text-muted-foreground text-sm">
              Predefined times
            </div>
            <div className="text-xs">
              <div
                className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePredefinedTimesClick(10)}
              >
                Last 10 Times
              </div>
              <div
                className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePredefinedTimesClick(30)}
              >
                Last 30 Times
              </div>
              <div
                className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePredefinedTimesClick(50)}
              >
                Last 50 Times
              </div>
              <div
                className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePredefinedTimesClick(100)}
              >
                Last 100 Times
              </div>
              <div
                className="py-3 px-5 rounded-md hover:bg-gray-100 cursor-pointer"
                onClick={() => handlePredefinedTimesClick(-1)}
              >
                All
              </div>
            </div>
          </div>
        </div>
        <div className="grid gap-4 grid-cols-4 px-5 py-3">
          <Button
            variant="ghost"
            className="col-span-1"
            onClick={() => setCalendarOpen(false)}
          >
            Cancel
          </Button>
          <div className="flex space-x-1 col-span-2 justify-end items-center text-xs">
            <div className="text-muted-foreground">Selected:</div>
            <div>{selectTimes} times</div>
          </div>
          <Button
            className="col-start-4 col-span-1"
            disabled={selectTimes === 0}
            onClick={handleSubmitClick}
          >
            Submit
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default App;
