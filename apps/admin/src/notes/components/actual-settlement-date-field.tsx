"use client";

import { fieldTooltipContentClassName, InfoTooltip } from "@cashsouk/ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ACTUAL_SETTLEMENT_DATE_HELPER,
  ACTUAL_SETTLEMENT_DATE_LABEL,
  ACTUAL_SETTLEMENT_DATE_TOOLTIP,
  malaysiaTodayForInput,
} from "@/notes/utils/actual-settlement-date";

export function ActualSettlementDateField({
  id,
  value,
  onChange,
  error,
  min,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  min?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="inline-flex items-center gap-1">
        <span>{ACTUAL_SETTLEMENT_DATE_LABEL}</span>
        <InfoTooltip
          content={ACTUAL_SETTLEMENT_DATE_TOOLTIP}
          className={fieldTooltipContentClassName}
        />
      </Label>
      <Input
        id={id}
        type="date"
        value={value}
        min={min}
        max={malaysiaTodayForInput()}
        required
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-meta text-muted-foreground">
        {ACTUAL_SETTLEMENT_DATE_HELPER}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-meta text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
