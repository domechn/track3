import _ from "lodash";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "../middlelayers/types";
import AthValue from "./ath-value";
import ProfitSummary from "./profit-summary";
import ProfitMetrics from "./profit-metrics";
import Profit from "./profit";
import { StaggerContainer, FadeUp } from "./motion";

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
    <StaggerContainer className="space-y-3">
      <FadeUp>
        <AthValue
          currency={currency}
          dateRange={dateRange}
          quoteColor={quoteColor}
        />
      </FadeUp>
      <FadeUp>
        <ProfitMetrics
          currency={currency}
          dateRange={dateRange}
          quoteColor={quoteColor}
        />
      </FadeUp>
      <FadeUp>
        <ProfitSummary
          currency={currency}
          dateRange={dateRange}
          quoteColor={quoteColor}
        />
      </FadeUp>
      <FadeUp>
        <Profit
          currency={currency}
          dateRange={dateRange}
          quoteColor={quoteColor}
          showCoinsProfitPercentage={true}
        />
      </FadeUp>
    </StaggerContainer>
  );
};

export default App;
