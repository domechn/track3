import AssetLabel from "@/components/common/asset-label";
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
import ConfirmDeleteDialog from "@/components/common/confirm-delete-dialog";
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
import type { WalletSectionProps } from "./types";
import { BackpackIcon } from "@radix-ui/react-icons";
import EmptyState from "@/components/empty-state";
import { AliasRename } from "./alias-rename";
import { sourceAliasFallback } from "@/components/source-display-name";

const CONFIG_LIST_PAGE_SIZE = 8;

const WalletSection = memo(function WalletSection({
  wallets,
  renameNames,
  renameOffset = 0,
  visibleWallets,
  walletPage,
  walletPageCount,
  isPro,
  walletOptions,
  addWalletDialogOpen,
  addWalletConfig,
  saveWalletConfigLoading,
  onWalletPageChange,
  onAddWalletDialogOpenChange,
  onAddWalletConfigChange,
  onAddWalletFormSubmit,
  onToggleActive,
  onRemove,
  onQuickLook,
  onRename,
}: WalletSectionProps) {
  const { t } = useTranslation();

  const paged = visibleWallets.slice(
    walletPage * CONFIG_LIST_PAGE_SIZE,
    walletPage * CONFIG_LIST_PAGE_SIZE + CONFIG_LIST_PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-4 touch:flex-wrap">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("config.wallet")}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {t("config.walletShownTotal")
                .replace("{shown}", String(paged.length))
                .replace("{total}", String(wallets.length))}
            </p>
          </div>

          <Dialog
            open={addWalletDialogOpen}
            onOpenChange={onAddWalletDialogOpenChange}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <PlusIcon className="h-4 w-4 mr-1" />
                {t("config.addWallet")}
              </Button>
            </DialogTrigger>
            <DialogContent className="t3-source-editor sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>{t("config.addWallet")}</DialogTitle>
                <DialogDescription>
                  Add wallet address here. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    {t("config.formType")}
                  </Label>
                  <Select
                    onValueChange={(e) =>
                      onAddWalletConfigChange({
                        ...(addWalletConfig || {
                          type: "btc",
                          address: "",
                          active: true,
                        }),
                        type: e,
                      })
                    }
                    value={addWalletConfig?.type ?? ""}
                  >
                    <SelectTrigger id="name" aria-label={t("config.formType")} className="w-[180px] touch:w-full touch:max-w-[180px]">
                      <SelectValue placeholder={t("config.selectWallet")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>{t("config.walletType")}</SelectLabel>
                        {walletOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <AssetLabel kind="wallet" type={o.value} name={o.label} size={20} />
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
                    value={addWalletConfig?.alias ?? ""}
                    onChange={(e) =>
                      onAddWalletConfigChange({
                        ...(addWalletConfig || {
                          type: "btc",
                          address: "",
                          active: true,
                        }),
                        alias: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="address" className="text-right">
                    {t("config.formAddress")}
                  </Label>
                  <Input
                    id="address"
                    autoComplete="off"
                    value={addWalletConfig?.address ?? ""}
                    onChange={(e) =>
                      onAddWalletConfigChange({
                        ...(addWalletConfig || {
                          type: "btc",
                          address: "",
                          active: true,
                        }),
                        address: e.target.value,
                      })
                    }
                    className="col-span-3"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={onAddWalletFormSubmit}
                  disabled={saveWalletConfigLoading}
                >
                  {saveWalletConfigLoading && (
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
        {wallets.length === 0 ? (
          <EmptyState icon={BackpackIcon} title={t("fidelity.source.empty").replace("{name}", t("config.wallets").toLowerCase())}
            hint={t("fidelity.source.emptyBody")} />
        ) : (
          <>
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">
                    {t("config.wallet")}
                  </TableHead>
                  <TableHead className="w-[170px]">
                    {t("config.alias")}
                  </TableHead>
                  <TableHead className="w-[320px]">
                    {t("config.address")}
                  </TableHead>
                  <TableHead className="w-[120px]">
                    {t("config.status")}
                  </TableHead>
                  <TableHead className="w-[140px] text-right">
                    {t("config.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((w, idx) => (
                  <TableRow
                    key={w.type + w.address + idx}
                    className="h-[42px] group align-middle"
                  >
                    <TableCell className="w-[140px]">
                      <AssetLabel kind="wallet" type={w.type} name={w.type.toUpperCase()} size={24} />
                    </TableCell>
                    <TableCell className="w-[170px] text-sm">
                      <span className="block truncate" title={w.alias || `${w.type}-${idx + 1}`}>
                        {w.alias && w.alias.length > 25 ? <>
                          <span aria-hidden="true">{`${w.alias.slice(0, 10)}…${w.alias.slice(-6)}`}</span>
                          <span className="sr-only">{w.alias}</span>
                        </> : w.alias || `${w.type}-${idx + 1}`}
                      </span>
                    </TableCell>
                    <TableCell className="w-[320px] text-xs text-muted-foreground">
                      <p className="truncate">{w.address}</p>
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={w.active}
                          onCheckedChange={() =>
                            onToggleActive(w.type, w.address)
                          }
                        />
                        <span className="text-xs text-muted-foreground">
                          {w.active ? t("config.active") : t("config.inactive")}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="w-[140px] text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <AliasRename alias={w.alias} name={w.alias || `${w.type}-${idx + 1}`}
                          fallback={sourceAliasFallback("wallet", w.type, w.address)} index={renameOffset + wallets.indexOf(w)}
                          names={renameNames ?? wallets.map((item) => item.alias || sourceAliasFallback("wallet", item.type, item.address))}
                          onRename={(alias) => onRename?.(w.type, w.address, alias)} />
                        {isPro && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => onQuickLook(w)}
                            title={t("config.quickLook")}
                          >
                            <MagnifyingGlassIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                        <ConfirmDeleteDialog
                          trigger={<Button size="icon" variant="ghost" className="h-7 w-7" title={t("common.delete")}>
                            <TrashIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>}
                          title={t("config.removeDialogTitle")}
                          description={t("config.removeDialogDesc")}
                          cancelLabel={t("common.cancel")}
                          actions={[{ label: t("common.delete"), onClick: () => onRemove(w.type, w.address) }]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visibleWallets.length > CONFIG_LIST_PAGE_SIZE && (
              <div data-layout-pager className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("common.prev")}
                  onClick={() =>
                    onWalletPageChange(Math.max(walletPage - 1, 0))
                  }
                  disabled={walletPage <= 0}
                >
                  <ChevronLeftIcon />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {walletPage + 1} / {walletPageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t("common.next")}
                  onClick={() =>
                    onWalletPageChange(
                      Math.min(walletPage + 1, walletPageCount - 1),
                    )
                  }
                  disabled={walletPage >= walletPageCount - 1}
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

export { WalletSection };
