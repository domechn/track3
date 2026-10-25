import { memo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/mobile/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/mobile/components/ui/switch";
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
import { Skeleton } from "@/mobile/components/ui/skeleton";
import { UpdateIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/mobile/i18n";
import { prettyPriceNumberToLocaleString } from "@/utils/currency";
import type { GeneralSettingsProps } from "@/components/configuration/types";
import { isIOS } from "@/utils/platform";
import { InsetGroup, ListRow } from "@/mobile/components/mobile";
import { ModalPage } from "@/mobile/components/mobile/overlays";

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
  const mobile = isIOS();
  const [picker, setPicker] = useState<"size" | "currency">();

  if (mobile) return <div className="ios-d3-mobile-general">
    <InsetGroup>
      <ListRow trailing={<Switch id="groupUSD" checked={groupUSD} onCheckedChange={onGroupUSDChange} aria-label={t("config.groupStablecoins")} />}>{t("config.groupStablecoins")}</ListRow>
      <ListRow trailing={<Switch id="hideInactive" checked={hideInactive} onCheckedChange={onHideInactiveChange} aria-label={t("config.hideInactiveSources")} />}>{t("config.hideInactiveSources")}</ListRow>
      <ListRow onClick={() => setPicker("size")} value={String(querySize)}>{t("config.mobile.countOfResults")}</ListRow>
      <ListRow onClick={() => setPicker("currency")} value={preferCurrencyLoading ? <Skeleton className="h-4 w-12" /> : preferCurrency}>{t("config.mobile.baseCurrency")}</ListRow>
    </InsetGroup>
    <Button size="sm" variant="ghost" className="mt-2 min-h-11 text-primary" onClick={onUpdateCurrencyRatesClick} disabled={preferCurrencyLoading || refreshCurrencyLoading}>
      <UpdateIcon className={`mr-2 h-4 w-4 ${refreshCurrencyLoading ? "animate-spin" : ""}`} />{t("config.updateCurrencyRates")}
    </Button>
    {preferredCurrencyDetail && preferCurrency !== defaultBaseCurrency && <p className="px-3 text-xs text-muted-foreground">
      {`1 ${defaultBaseCurrency} = ${prettyPriceNumberToLocaleString(preferredCurrencyDetail.rate)} ${preferredCurrencyDetail.currency}`}
    </p>}
    {picker && <ModalPage title={t(picker === "size" ? "config.mobile.countOfResults" : "config.mobile.baseCurrency")} onDismiss={() => setPicker(undefined)}>
      <div className="ios-d3-picker-page">
        <button className="ios-d3-picker-back" onClick={() => setPicker(undefined)}>{t("common.back")}</button>
        <h2>{t(picker === "size" ? "config.mobile.countOfResults" : "config.mobile.baseCurrency")}</h2>
        <div className="ios-d3-picker-group">{(picker === "size" ? querySizeOptions : preferCurrencyOptions).map((option) =>
          <button key={option.value} onClick={() => {
            if (picker === "size") onQuerySizeChange(option.value);
            else onPreferCurrencyChange(option.value);
            setPicker(undefined);
          }}>{option.label}<span aria-hidden="true">{(picker === "size" ? String(querySize) : preferCurrency) === option.value ? "✓" : ""}</span></button>)}</div>
      </div>
    </ModalPage>}
  </div>;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {t("config.general")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={mobile ? "ios-d3-currency-toggle flex items-center" : "flex items-center space-x-2"}>
          {mobile ? <Switch id="groupUSD" checked={groupUSD} onCheckedChange={onGroupUSDChange} /> : <Checkbox
            id="groupUSD"
            checked={groupUSD}
            onCheckedChange={(v) => onGroupUSDChange(!!v)}
          />}
          <Label htmlFor="groupUSD" className="text-sm touch:flex touch:min-h-11 touch:items-center">
            {t("config.groupStablecoins")}
          </Label>
        </div>
        <div className={mobile ? "ios-d3-currency-toggle flex items-center" : "flex items-center space-x-2"}>
          {mobile ? <Switch id="hideInactive" checked={hideInactive} onCheckedChange={onHideInactiveChange} /> : <Checkbox
            id="hideInactive"
            checked={hideInactive}
            onCheckedChange={(v) => onHideInactiveChange(!!v)}
          />}
          <Label htmlFor="hideInactive" className="text-sm touch:flex touch:min-h-11 touch:items-center">
            {t("config.hideInactiveSources")}
          </Label>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 touch:min-w-0">
            <div className="text-sm font-medium text-muted-foreground">
              {t("config.countOfResults")}
            </div>
            <Select onValueChange={onQuerySizeChange} value={querySize + ""}>
              <SelectTrigger aria-label={t("config.countOfResults")} className="w-[130px]">
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
          <div className="space-y-2 touch:min-w-0">
            <div className="text-sm font-medium text-muted-foreground">
              {t("config.baseCurrency")}
            </div>
            <div className="flex items-center gap-2 touch:min-w-0">
              {preferCurrencyLoading ? (
                <Skeleton className="h-10 w-[280px]" />
              ) : (
                <Select
                  onValueChange={onPreferCurrencyChange}
                  value={preferCurrency}
                >
                  <SelectTrigger aria-label={t("config.baseCurrency")} className="w-[280px] touch:min-w-0 touch:w-full touch:max-w-[280px]">
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
                className="h-8 w-8 touch:h-11 touch:w-11 shrink-0"
                aria-label={t("config.updateCurrencyRates")}
                onClick={onUpdateCurrencyRatesClick}
                disabled={preferCurrencyLoading || refreshCurrencyLoading}
              >
                <UpdateIcon
                  className={`h-4 w-4 ${
                    refreshCurrencyLoading ? "animate-spin motion-reduce:animate-none" : ""
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
