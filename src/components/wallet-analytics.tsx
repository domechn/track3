import WalletAssetsPercentage from "@/components/wallet-assets-percentage";
import WalletAssetsChange from "@/components/wallet-assets-change";
import {
  CurrencyRateDetail,
  QuoteColor,
  TDateRange,
} from "@/middlelayers/types";
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
        <WalletAssetsPercentage currency={currency} dateRange={dateRange} />
      </FadeUp>
      <FadeUp>
        <WalletAssetsChange
          currency={currency}
          dateRange={dateRange}
          quoteColor={quoteColor}
        />
      </FadeUp>
    </StaggerContainer>
  );
};

export default App;
