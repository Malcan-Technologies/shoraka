"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComRepFieldLabel } from "@cashsouk/ui";
import { scAppendixASelectValues, type OperatorProfileDto } from "@cashsouk/types";

export function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}

export function formatProfileDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const iso = value.slice(0, 10);
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function financialYearLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const year = value.slice(0, 4);
  return year ? `FY${year}` : null;
}

export function emptyCapital(): NonNullable<OperatorProfileDto["shareCapital"]> {
  return {
    id: "",
    ordinaryUnits: null,
    ordinaryAmount: null,
    preferenceUnits: null,
    preferenceAmount: null,
    othersUnits: null,
    othersAmount: null,
    totalPaidUpCapital: null,
    llpMembersCapitalUnits: null,
    llpMembersCapitalAmount: null,
    llpMembersReservesUnits: null,
    llpMembersReservesAmount: null,
    llpSubordinatedLoansUnits: null,
    llpSubordinatedLoansAmount: null,
    totalLlp: null,
  };
}

export function ShorakaField({
  label,
  value,
  onChange,
  disabled,
  type = "text",
  help,
  required = false,
  integer = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  type?: string;
  help?: string;
  required?: boolean;
  integer?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Input
        className="h-11 text-ui"
        type={type}
        inputMode={integer ? "numeric" : undefined}
        value={value}
        onChange={(e) =>
          onChange(integer ? e.target.value.replace(/[^\d]/g, "") : e.target.value)
        }
        disabled={disabled}
      />
    </div>
  );
}

export function ShorakaEnumSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  disabled,
  help,
  required = false,
}: {
  label: string;
  value: T | "";
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  disabled?: boolean;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Select value={value || undefined} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger className="h-11 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {labels[opt]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ShorakaCountrySelect({
  label,
  value,
  onChange,
  disabled,
  help,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Select
        value={value || undefined}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger className="h-11 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {scAppendixASelectValues(value).map((country) => (
            <SelectItem key={country} value={country}>
              {country}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ShorakaYesNo({
  label,
  value,
  onChange,
  disabled,
  help,
  required = false,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  help?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <ComRepFieldLabel label={label} required={required} help={help} />
      <Select
        value={value == null ? undefined : value ? "YES" : "NO"}
        onValueChange={(v) => onChange(v === "YES")}
        disabled={disabled}
      >
        <SelectTrigger className="h-11 text-ui">
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="YES">Yes</SelectItem>
          <SelectItem value="NO">No</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
