import { useState } from "react";
import { Pencil1Icon } from "@radix-ui/react-icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sourceDisplayNames } from "@/components/source-display-name";
import { useTranslation } from "@/i18n";

export function AliasRename({ alias, name, fallback, names, index, onRename }: {
  alias?: string;
  name: string;
  fallback: string;
  names: readonly string[];
  index: number;
  onRename: (alias: string) => void;
}) {
  const { t } = useTranslation();
  const renameTitle = t("config.renameSource").replace("{name}", name);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(alias ?? "");
  const trimmed = draft.trim();
  const preview = sourceDisplayNames(names.map((item, i) => ({
    alias: i === index ? trimmed || fallback : item,
  })))[index];

  function save() {
    if (trimmed.length > 40) return;
    onRename(trimmed);
    setOpen(false);
  }

  return <Dialog open={open} onOpenChange={(next) => {
    if (next) setDraft(alias ?? "");
    setOpen(next);
  }}>
    <DialogTrigger asChild>
      <Button type="button" size="icon" variant="ghost" className="t3-alias-rename-trigger h-9 w-9 touch:h-11 touch:w-11 shrink-0"
        aria-label={renameTitle} title={renameTitle}>
        <Pencil1Icon className="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent className="t3-source-editor sm:max-w-[425px]">
      <DialogHeader>
        <DialogTitle>{renameTitle}</DialogTitle>
        <DialogDescription>{t("config.renameDescription")}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2">
        <Label htmlFor={`rename-${index}`}>{t("config.alias")}</Label>
        <Input id={`rename-${index}`} autoFocus autoComplete="off" maxLength={40} value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); save(); } }} />
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t("config.renamePreview").replace("{name}", preview)}
        </p>
        {trimmed.length > 40 && <p role="alert" className="text-sm text-destructive">{t("config.aliasTooLong")}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
        <Button type="button" onClick={save}>{t("common.save")}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
