import _ from "lodash";
import { CurrencyRateDetail, TDateRange } from "../middlelayers/types";
import ProfitSummary from "./profit-summary";
import Profit from "./profit";

const App = ({
  currency,
  dateRange,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
}) => {
  return (
    <div className="space-y-2">
      <ProfitSummary currency={currency} dateRange={dateRange} />
      <Profit currency={currency} dateRange={dateRange} />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
