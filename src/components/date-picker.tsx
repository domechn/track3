import { DateRange } from "react-day-picker";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar } from "./ui/calendar";
import { CalendarIcon } from "@radix-ui/react-icons";
import { endOfDay, isSameDay } from "date-fns";
import { useEffect, useState } from "react";
import { getAvailableDays } from "@/middlelayers/charts";
import _ from "lodash";

const App = ({
  value,
  onDateChange,
}: {
  value: DateRange | undefined;
  onDateChange: (selectedTimes: number, date?: DateRange) => void;
}) => {
  const [calendarOpen, setCalendarOpen] = useState<boolean>(false);
  const [availableDays, setAvailableDays] = useState<Date[]>([]);
  const [selectTimes, setSelectTimes] = useState<number>(0);
  const [date, setDate] = useState<DateRange | undefined>(value);

  useEffect(() => {
    getAvailableDays().then((days) => {
      setAvailableDays(days);
    });
  }, []);

  useEffect(() => {
    handleDateSelect(availableDays, date);
  }, [availableDays, date]);

  function isDayDisabled(day: Date) {
    return !availableDays.find((d) => isSameDay(d, day));
  }

  function handleDateSelect(availableDays: Date[], dateRange?: DateRange) {
    if (!dateRange || !dateRange.from || !dateRange.to) {
      setSelectTimes(0);
      return;
    }

    const from = dateRange.from;
    const to = endOfDay(dateRange.to);
    const times = _(availableDays)
      .filter((d) => d >= from && d <= to)
      .value().length;

    setSelectTimes(times);
  }

  function handlePredefinedTimesClick(pt: number) {
    if (availableDays.length === 0) {
      setDataRange(undefined);
      return;
    }

    const ads =
      pt < 0
        ? availableDays
        : availableDays.slice(availableDays.length - pt, availableDays.length);

    setDataRange({
      from: ads[0],
      to: ads[ads.length - 1],
    });
  }

  function setDataRange(v: DateRange | undefined) {
    setDate(v);
  }

  function handleSubmitClick() {
    setCalendarOpen(false);

    onDateChange(selectTimes, date);
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
            onSelect={setDate}
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
