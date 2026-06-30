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
import type { ExchangeSectionProps } from "./types";

const CONFIG_LIST_PAGE_SIZE = 30;

const ExchangeSection = memo(function ExchangeSection({
  exchanges,
  visibleExchanges,
  exchangePage,
  exchangePageCount,
  isPro,
  cexOptions,
  addExchangeDialogOpen,
  addExchangeConfig,
  saveCexConfigLoading,
  onExchangePageChange,
  onAddExchangeDialogOpenChange,
  onAddExchangeConfigChange,
  onAddExchangeFormSubmit,
  onToggleActive,
  onRemove,
  onQuickLook,
}: ExchangeSectionProps) {
  const { t } = useTranslation();

  const paged = visibleExchanges.slice(
    exchangePage * CONFIG_LIST_PAGE_SIZE,
    exchangePage * CONFIG_LIST_PAGE_SIZE + CONFIG_LIST_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("config.exchanges")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("config.exchangeShownTotal")
                .replace("{shown}", String(visibleExchanges.length))
                .replace("{total}", String(exchanges.length))}
            </p>
          </div>

          {/* Add Exchange Dialog */}
          <Dialog
            open={addExchangeDialogOpen}
            onOpenChange={onAddExchangeDialogOpenChange}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4 mr-1" />
                {t("config.addExchange")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("config.addExchange")}</DialogTitle>
                <DialogDescription>
                  Add exchange api key and secret here. Click save when you're
                  done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    {t("config.formType")}
                  </Label>
                  <Select
                    onValueChange={(e) =>
                      onAddExchangeConfigChange({
                        ...(addExchangeConfig || {
                          type: "binance",
                          apiKey: "",
                          secret: "",
                          active: true,
                        }),
                        type: e,
                      })
                    }
                    value={addExchangeConfig?.type ?? ""}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder={t("config.selectCex")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t("config.cex")}</SelectLabel>
                        {cexOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <img
                              className="h-4 w-4 text-muted-foreground inline-block mr-2"
                              src={getWalletLogo(o.value)}
                            />
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="alias" className="text-right">
                    {t("config.formAlias")}
                  </Label>
                  <Input
                    id="alias"
                    autoComplete="off"
                    value={addExchangeConfig?.alias ?? ""}
                    onChange={(e) =>
                      onAddExchangeConfigChange({
                        ...(addExchangeConfig || {
                          type: "binance",
                          apiKey: "",
                          secret: "",
                          active: true,
                        }),
                        alias: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiKey" className="text-right">
                    {t("config.formApiKey")}
                  </Label>
                  <Input
                    id="apiKey"
                    autoComplete="off"
                    value={addExchangeConfig?.apiKey ?? ""}
                    onChange={(e) =>
                      onAddExchangeConfigChange({
                        ...(addExchangeConfig || {
                          type: "binance",
                          apiKey: "",
                          secret: "",
                          active: true,
                        }),
                        apiKey: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiSecret" className="text-right">
                    {t("config.formApiSecret")}
                  </Label>
                  <Input
                    id="apiSecret"
                    value={addExchangeConfig?.secret ?? ""}
                    type="password"
                    onChange={(e) =>
                      onAddExchangeConfigChange({
                        ...(addExchangeConfig || {
                          type: "binance",
                          apiKey: "",
                          secret: "",
                          active: true,
                        }),
                        secret: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                {addExchangeConfig?.type === "okex" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">
                      {t("config.formPassword")}
                    </Label>
                    <Input
                      id="password"
                      value={addExchangeConfig?.password ?? ""}
                      type="password"
                      onChange={(e) =>
                        onAddExchangeConfigChange({
                          ...addExchangeConfig,
                          password: e.target.value,
                        })
                      }
                      className="col-span-3"
                    />
                  </div>
                )}
                {addExchangeConfig?.type === "bitget" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="passphrase" className="text-right">
                      {t("config.formPassphrase")}
                    </Label>
                    <Input
                      id="passphrase"
                      value={addExchangeConfig?.passphrase ?? ""}
                      type="password"
                      onChange={(e) =>
                        onAddExchangeConfigChange({
                          ...addExchangeConfig,
                          passphrase: e.target.value,
                        })
                      }
                      className="col-span-3"
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={onAddExchangeFormSubmit}
                  disabled={saveCexConfigLoading}
                >
                  {saveCexConfigLoading && (
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
        {exchanges.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No exchange found. Add your first CEX API key to start tracking.
          </div>
        ) : (
          <>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[170px]">
                    {t("config.exchange")}
                  </TableHead>
                  <TableHead className="w-[170px]">
                    {t("config.alias")}
                  </TableHead>
                  <TableHead className="w-[220px]">
                    {t("config.apiKey")}
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
                {paged.map((ex, idx) => (
                  <TableRow
                    key={ex.type + idx}
                    className="h-[42px] group align-middle"
                  >
                    <TableCell className="w-[170px]">
                      <div className="flex items-center gap-2 text-sm">
                        <img
                          className="w-[18px] h-[18px] rounded-full"
                          src={getWalletLogo(ex.type)}
                          alt={ex.type}
                        />
                        <span className="truncate">
                          {cexOptions.find((c) => c.value === ex.type)?.label ??
                            ex.type}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[170px] text-sm">
                      {ex.alias || `${ex.type}-${idx + 1}`}
                    </TableCell>
                    <TableCell className="w-[220px] text-xs text-muted-foreground">
                      <p className="truncate">{maskSensitive(ex.apiKey)}</p>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={ex.active}
                          onCheckedChange={() =>
                            onToggleActive(ex.type, ex.apiKey)
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {ex.active
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
                            onClick={() => onQuickLook(ex)}
                            title={t("config.quickLook")}
                          >
                            <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => onRemove(ex.type, ex.apiKey)}
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
            {visibleExchanges.length > CONFIG_LIST_PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onExchangePageChange(Math.max(exchangePage - 1, 0))
                  }
                  disabled={exchangePage <= 0}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {exchangePage + 1} / {exchangePageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onExchangePageChange(
                      Math.min(exchangePage + 1, exchangePageCount - 1),
                    )
                  }
                  disabled={exchangePage >= exchangePageCount - 1}
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

export { ExchangeSection };
