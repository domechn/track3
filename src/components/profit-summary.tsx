import { calculateTotalProfit } from "@/middlelayers/charts";
import { CurrencyRateDetail } from "@/middlelayers/types";
import { listAllFirstAndLastDays } from "@/utils/date";
import bluebird from "bluebird";
import { useEffect, useState } from "react";

const App = ({
  startDate,
  endDate,
  currency,
}: {
  startDate?: Date;
  endDate?: Date;
  currency: CurrencyRateDetail;
}) => {
  if (!startDate || !endDate) {
    return <div>No Data</div>;
  }

  const [profits, setProfits] = useState<
    {
      total: number;
      percentage: number;
      monthFirstDate: Date;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  useEffect(() => {
    loadAllMonthlyProfits(startDate, endDate).then(() => {
      setInitialLoaded(true);
    });
  }, [startDate, endDate]);

  async function loadAllMonthlyProfits(start: Date, end: Date) {
    updateLoading(true);
    try {
      const dates = listAllFirstAndLastDays(start, end);

      const profits = await bluebird.map(dates, async (date) => {
        const { total, percentage } = await calculateTotalProfit({
          start: date.firstDay,
          end: date.lastDay,
        });

        return { total, percentage, monthFirstDate: date.firstDay };
      });

      setProfits(profits);
    } finally {
      updateLoading(false);
    }
  }

  function updateLoading(val: boolean) {
    if (initialLoaded) {
      return;
    }

    setLoading(val);
  }

  return (
    <div>
      {profits.map((p) => (
        <div key={p.monthFirstDate.toISOString()}>
          <div>{p.monthFirstDate.toISOString()}</div>
          <div>{p.total}</div>
          <div>{p.percentage}</div>
        </div>
      ))}
    </div>
  );
};

export default App;
