import { memo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ReloadIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import { getWalletLogo } from "@/lib/utils";
import { maskSensitive } from "@/utils/attach-to";
import type { StockBrokerSectionProps } from "./types";

const CONFIG_LIST_PAGE_SIZE = 30;

const StockBrokerSection = memo(function StockBrokerSection({
  stockBrokers,
  visibleStockBrokers,
  stockBrokerPage,
  stockBrokerPageCount,
  isPro,
  stockBrokerOptions,
  addStockBrokerDialogOpen,
  addStockBrokerConfig,
  saveStockBrokerConfigLoading,
  onStockBrokerPageChange,
  onAddStockBrokerDialogOpenChange,
  onAddStockBrokerConfigChange,
  onAddStockBrokerFormSubmit,
  onToggleActive,
  onRemove,
  onQuickLook,
}: StockBrokerSectionProps) {
  const { t } = useTranslation();

  const paged = visibleStockBrokers.slice(
    stockBrokerPage * CONFIG_LIST_PAGE_SIZE,
    stockBrokerPage * CONFIG_LIST_PAGE_SIZE + CONFIG_LIST_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("config.stockBrokers")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("config.brokerShownTotal")
                .replace("{shown}", String(visibleStockBrokers.length))
                .replace("{total}", String(stockBrokers.length))}
            </p>
          </div>

          <Dialog
            open={addStockBrokerDialogOpen}
            onOpenChange={onAddStockBrokerDialogOpenChange}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4 mr-1" />
                {t("config.addStockBroker")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("config.addStockBroker")}</DialogTitle>
                <DialogDescription>
                  Add broker credentials here. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stockBrokerType" className="text-right">
                    {t("config.formType")}
                  </Label>
                  <Select
                    onValueChange={(e) =>
                      onAddStockBrokerConfigChange({
                        ...(addStockBrokerConfig || {
                          type: "ibkr",
                          token: "",
                          queryId: "",
                          active: true,
                        }),
                        type: e,
                      })
                    }
                    value={addStockBrokerConfig?.type ?? ""}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t("config.selectBroker")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t("config.broker")}</SelectLabel>
                        {stockBrokerOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stockBrokerAlias" className="text-right">
                    {t("config.formAlias")}
                  </Label>
                  <Input
                    id="stockBrokerAlias"
                    autoComplete="off"
                    value={addStockBrokerConfig?.alias ?? ""}
                    onChange={(e) =>
                      onAddStockBrokerConfigChange({
                        ...(addStockBrokerConfig || {
                          type: "ibkr",
                          token: "",
                          queryId: "",
                          active: true,
                        }),
                        alias: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stockBrokerToken" className="text-right">
                    {t("config.formToken")}
                  </Label>
                  <Input
                    id="stockBrokerToken"
                    type="password"
                    value={addStockBrokerConfig?.token ?? ""}
                    onChange={(e) =>
                      onAddStockBrokerConfigChange({
                        ...(addStockBrokerConfig || {
                          type: "ibkr",
                          token: "",
                          queryId: "",
                          active: true,
                        }),
                        token: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="stockBrokerQueryId" className="text-right">
                    Query ID
                  </Label>
                  <Input
                    id="stockBrokerQueryId"
                    autoComplete="off"
                    value={addStockBrokerConfig?.queryId ?? ""}
                    onChange={(e) =>
                      onAddStockBrokerConfigChange({
                        ...(addStockBrokerConfig || {
                          type: "ibkr",
                          token: "",
                          queryId: "",
                          active: true,
                        }),
                        queryId: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={onAddStockBrokerFormSubmit}
                  disabled={saveStockBrokerConfigLoading}
                >
                  {saveStockBrokerConfigLoading && (
                    <ReloadIcon className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("config.saveChanges")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {stockBrokers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No stock broker found.
          </div>
        ) : (
          <>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">
                    {t("config.broker")}
                  </TableHead>
                  <TableHead className="w-[170px]">
                    {t("config.alias")}
                  </TableHead>
                  <TableHead className="w-[180px]">
                    {t("config.queryId")}
                  </TableHead>
                  <TableHead className="w-[180px]">
                    {t("config.token")}
                  </TableHead>
                  <TableHead className="w-[120px]">
                    {t("config.status")}
                  </TableHead>
                  <TableHead className="w-[84px] text-right">
                    {t("config.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((broker, idx) => (
                  <TableRow
                    key={broker.type + broker.queryId + idx}
                    className="h-[42px] group align-middle"
                  >
                    <TableCell className="w-[170px]">
                      <div className="flex items-center gap-2 text-sm">
                        <img
                          className="w-[18px] h-[18px] rounded-full"
                          src={getWalletLogo(broker.type)}
                          alt={broker.type}
                        />
                        <span className="truncate">
                          {stockBrokerOptions.find(
                            (c) => c.value === broker.type,
                          )?.label ?? broker.type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[170px] text-sm">
                      {broker.alias || `${broker.type}-${idx + 1}`}
                    </TableCell>
                    <TableCell className="w-[180px] text-xs text-muted-foreground">
                      <p className="truncate">{broker.queryId}</p>
                    </TableCell>
                    <TableCell className="w-[180px] text-xs text-muted-foreground">
                      <p className="truncate">{maskSensitive(broker.token)}</p>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={broker.active}
                          onCheckedChange={() =>
                            onToggleActive(broker.type, broker.queryId)
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {broker.active
                            ? t("config.active")
                            : t("config.inactive")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[84px] text-right">
                      <div className="inline-flex w-[64px] items-center justify-end gap-1">
                        {isPro && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => onQuickLook(broker)}
                            title={t("config.quickLook")}
                          >
                            <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onRemove(broker.type, broker.queryId)}
                          title={t("common.delete")}
                        >
                          <TrashIcon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleStockBrokers.length > CONFIG_LIST_PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onStockBrokerPageChange(Math.max(stockBrokerPage - 1, 0))
                  }
                  disabled={stockBrokerPage <= 0}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {stockBrokerPage + 1} / {stockBrokerPageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onStockBrokerPageChange(
                      Math.min(stockBrokerPage + 1, stockBrokerPageCount - 1),
                    )
                  }
                  disabled={stockBrokerPage >= stockBrokerPageCount - 1}
                >
                  <ChevronRightIcon />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
});

export { StockBrokerSection };
