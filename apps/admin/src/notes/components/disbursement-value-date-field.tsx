"use client";

import { fieldTooltipContentClassName, InfoTooltip } from "@cashsouk/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultDisbursementValueDate,
  DISBURSEMENT_VALUE_DATE_HELPER,
  DISBURSEMENT_VALUE_DATE_LABEL,
  DISBURSEMENT_VALUE_DATE_TOOLTIP,
} from "@/notes/utils/disbursement-value-date";

export function DisbursementValueDateField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="inline-flex items-center gap-1">
        <span>{DISBURSEMENT_VALUE_DATE_LABEL}</span>
        <InfoTooltip
          content={DISBURSEMENT_VALUE_DATE_TOOLTIP}
          className={fieldTooltipContentClassName}
        />
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        max={defaultDisbursementValueDate()}
        required
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-meta text-muted-foreground">
        {DISBURSEMENT_VALUE_DATE_HELPER}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-meta text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
