import { memo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  Link2Icon,
  PlusIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";
import type { OthersSectionProps, OtherDraft } from "./types";

const CONFIG_LIST_PAGE_SIZE = 30;

const OthersSection = memo(function OthersSection({
  others,
  othersPage,
  othersPageCount,
  pagedOthers,
  pagedOthersStartIndex,
  otherAmountDraftMap,
  onAdd,
  onOthersChange,
  onOtherAmountInputChange,
  onCommitOtherAmountInput,
  onOthersPageChange,
  onRemove,
  onOpenAttachModal,
  getAttachDisplayLabel,
}: OthersSectionProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("config.others")}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {t("config.addOtherDesc")}
              </p>
            </div>

            <AddOtherDialog
              t={t}
              onAdd={(draft) => {
                onOthersChange(others.length, "symbol", draft.symbol);
                onOthersChange(others.length, "amount", String(draft.amount));
                if (draft.alias) {
                  onOthersChange(others.length, "alias", draft.alias);
                }
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {others.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No custom symbol yet.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("config.alias")}</TableHead>
                    <TableHead>{t("config.symbol")}</TableHead>
                    <TableHead>{t("config.amount")}</TableHead>
                    <TableHead className="w-[84px] text-right">
                      {t("config.actions")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedOthers.map((o, idx) => {
                    const globalIdx = pagedOthersStartIndex + idx;
                    return (
                      <TableRow
                        key={"other" + globalIdx}
                        className="h-[42px] group align-middle"
                      >
                        <TableCell>
                          <Input
                            type="text"
                            maxLength={100}
                            name="alias"
                            placeholder={t("config.placeholder.alias")}
                            value={o.alias ?? ""}
                            autoComplete="off"
                            onChange={(e) =>
                              onOthersChange(globalIdx, "alias", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            maxLength={50}
                            name="symbol"
                            placeholder={t("config.placeholder.symbol")}
                            value={o.symbol}
                            autoComplete="off"
                            onChange={(e) =>
                              onOthersChange(
                                globalIdx,
                                "symbol",
                                e.target.value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            inputMode="decimal"
                            name="amount"
                            placeholder="0"
                            value={
                              otherAmountDraftMap[globalIdx] ?? `${o.amount}`
                            }
                            onChange={(e) =>
                              onOtherAmountInputChange(
                                globalIdx,
                                e.target.value,
                              )
                            }
                            onBlur={() => onCommitOtherAmountInput(globalIdx)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-1">
                            {o.attachTo ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => onOpenAttachModal(globalIdx)}
                                  >
                                    <Link2Icon className="h-4 w-4 text-primary" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>
                                    {t("config.others.attachedTo")}{" "}
                                    {getAttachDisplayLabel(o.attachTo)}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => onOpenAttachModal(globalIdx)}
                                title={t("config.others.attachTo")}
                              >
                                <Link2Icon className="h-4 w-4 text-muted-foreground/50 hover:text-muted-foreground" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => onRemove(globalIdx)}
                              title={t("common.delete")}
                            >
                              <TrashIcon className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {others.length > CONFIG_LIST_PAGE_SIZE && (
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onOthersPageChange(Math.max(othersPage - 1, 0))
                    }
                    disabled={othersPage <= 0}
                  >
                    <ChevronLeftIcon />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {othersPage + 1} / {othersPageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onOthersPageChange(
                        Math.min(othersPage + 1, othersPageCount - 1),
                      )
                    }
                    disabled={othersPage >= othersPageCount - 1}
                  >
                    <ChevronRightIcon />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
});

// Internal sub-component for the Add Other dialog
function AddOtherDialog({
  t,
  onAdd,
}: {
  t: (key: string) => string;
  onAdd: (val: { symbol: string; amount: number; alias?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OtherDraft>({
    symbol: "",
    amount: 0,
  });
  const [amountDraft, setAmountDraft] = useState("");

  function handleSubmit() {
    if (!draft.symbol) {
      return;
    }
    onAdd({
      ...draft,
      amount: parseAmountInput(amountDraft),
    });
    setDraft({ symbol: "", amount: 0 });
    setAmountDraft("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="h-4 w-4 mr-1" />
          {t("config.addSymbol")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("config.addOther")}</DialogTitle>
          <DialogDescription>
            {t("config.addOtherDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="alias" className="text-right">
              {t("config.formAlias")}
            </Label>
            <Input
              id="alias"
              value={draft.alias ?? ""}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, alias: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="symbol" className="text-right">
              {t("config.formSymbol")}
            </Label>
            <Input
              id="symbol"
              value={draft.symbol}
              autoComplete="off"
              onChange={(e) => setDraft({ ...draft, symbol: e.target.value })}
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              {t("config.formAmount")}
            </Label>
            <Input
              id="amount"
              type="text"
              inputMode="decimal"
              value={amountDraft}
              onChange={(e) => setAmountDraft(e.target.value)}
              onBlur={() =>
                setDraft({
                  ...draft,
                  amount: parseAmountInput(amountDraft),
                })
              }
              className="col-span-3"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" onClick={handleSubmit}>
            {t("config.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseAmountInput(raw: string): number {
  if (!raw.trim()) {
    return 0;
  }
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export { OthersSection };
