import type { ChangeEvent } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ClockIcon } from "@radix-ui/react-icons";
import { useTranslation } from "@/i18n";

export function FidelityDateInput({ value, label, placeholder, disabled, invalid, describedBy, onChange }: {
  value: string;
  label: string;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const { locale } = useTranslation();
  return <label className="fidelity-date-input">
    <span aria-hidden="true"><ClockIcon />{value
      ? format(new Date(`${value}T00:00:00`), "d MMM yyyy", locale === "zh" ? { locale: zhCN } : undefined) : placeholder}</span>
    <input type="date" aria-label={label} aria-invalid={invalid}
      aria-describedby={describedBy} value={value} disabled={disabled} onChange={onChange} />
  </label>;
}
