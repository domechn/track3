import _ from "lodash";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "../middlelayers/types";
import AthValue from "./ath-value";
import ProfitSummary from "./profit-summary";
import Profit from "./profit";

const App = ({
  currency,
  dateRange,
  quoteColor,
}: {
  currency: CurrencyRateDetail;
  dateRange: TDateRange;
  quoteColor: QuoteColor;
}) => {
  return (
    <div className="space-y-2">
      <AthValue
        currency={currency}
        dateRange={dateRange}
        quoteColor={quoteColor}
      />
      <ProfitSummary
        currency={currency}
        dateRange={dateRange}
        quoteColor={quoteColor}
      />
      <Profit
        currency={currency}
        dateRange={dateRange}
        quoteColor={quoteColor}
      />
      <div className="mb-2"></div>
    </div>
  );
};

export default App;
