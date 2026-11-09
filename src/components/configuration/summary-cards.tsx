import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/i18n";
import type { SummaryCardsProps } from "./types";

const SummaryCards = memo(function SummaryCards({
  exchangeCount,
  activeExchangeCount,
  stockBrokerCount,
  activeStockBrokerCount,
  walletCount,
  activeWalletCount,
  othersCount,
  preferCurrency,
  preferCurrencyLoading,
}: SummaryCardsProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("config.exchanges")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-semibold">{exchangeCount}</div>
          <p className="text-xs text-muted-foreground">
            {activeExchangeCount} active
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("config.stockBrokers")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-semibold">{stockBrokerCount}</div>
          <p className="text-xs text-muted-foreground">
            {activeStockBrokerCount} active
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("config.wallets")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-semibold">{walletCount}</div>
          <p className="text-xs text-muted-foreground">
            {t("config.activeCount").replace("{n}", String(activeWalletCount))}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("config.customSymbols")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xl font-semibold">{othersCount}</div>
          <p className="text-xs text-muted-foreground">
            {t("config.manualBalanceDesc")}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("config.baseCurrency")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {preferCurrencyLoading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <div className="text-xl font-semibold">{preferCurrency}</div>
          )}
          <p className="text-xs text-muted-foreground">
            {preferCurrencyLoading
              ? "Loading base currency..."
              : t("config.currentQuoteBase")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
});

export { SummaryCards };
