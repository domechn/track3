import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdateIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import type { GeneralSettingsProps } from "./types";

const defaultBaseCurrency = "USD";

const querySizeOptions = [
  { value: "10", label: "10" },
  { value: "20", label: "20" },
  { value: "50", label: "50" },
];

const GeneralSettings = memo(function GeneralSettings({
  groupUSD,
  onGroupUSDChange,
  hideInactive,
  onHideInactiveChange,
  querySize,
  onQuerySizeChange,
  preferCurrency,
  preferCurrencyLoading,
  preferCurrencyOptions,
  preferredCurrencyDetail,
  onPreferCurrencyChange,
  refreshCurrencyLoading,
  onUpdateCurrencyRatesClick,
}: GeneralSettingsProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("config.general")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="groupUSD"
            checked={groupUSD}
            onCheckedChange={(v) => onGroupUSDChange(!!v)}
          />
          <Label htmlFor="groupUSD" className="text-sm">
            Group stable coins into USDT (USDC, TUSD, DAI...)
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="hideInactive"
            checked={hideInactive}
            onCheckedChange={(v) => onHideInactiveChange(!!v)}
          />
          <Label htmlFor="hideInactive" className="text-sm">
            Hide inactive exchanges, brokers, and wallets
          </Label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {t("config.countOfResults")}
            </div>
            <Select onValueChange={onQuerySizeChange} value={querySize + ""}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder={t("config.querySize")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>{t("config.size")}</SelectLabel>
                  {querySizeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              {t("config.baseCurrency")}
            </div>
            <div className="flex items-center gap-2">
              {preferCurrencyLoading ? (
                <Skeleton className="h-10 w-[280px]" />
              ) : (
                <Select
                  onValueChange={onPreferCurrencyChange}
                  value={preferCurrency}
                >
                  <SelectTrigger className="w-[280px]">
                    <SelectValue placeholder={t("config.preferCurrency")} />
                  </SelectTrigger>
                  <SelectContent className="overflow-y-auto max-h-[20rem]">
                    <SelectGroup>
                      <SelectLabel>
                        {t("config.preferCurrencyLabel")}
                      </SelectLabel>
                      {preferCurrencyOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={onUpdateCurrencyRatesClick}
                disabled={preferCurrencyLoading || refreshCurrencyLoading}
              >
                <UpdateIcon
                  className={`h-4 w-4 ${
                    refreshCurrencyLoading ? "animate-spin" : ""
                  }`}
                />
              </Button>
            </div>
            <p className="min-h-4 text-xs text-muted-foreground">
              <span
                className={`block transition-opacity duration-250 ${
                  !preferCurrencyLoading &&
                  preferredCurrencyDetail &&
                  preferCurrency !== defaultBaseCurrency
                    ? "opacity-100"
                    : "opacity-0"
                }`}
              >
                {!preferCurrencyLoading &&
                preferredCurrencyDetail &&
                preferCurrency !== defaultBaseCurrency
                  ? `1 ${defaultBaseCurrency} = ${prettyPriceNumberToLocaleString(
                      preferredCurrencyDetail.rate,
                    )} ${preferredCurrencyDetail.currency}`
                  : "\u00A0"}
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

export { GeneralSettings };
