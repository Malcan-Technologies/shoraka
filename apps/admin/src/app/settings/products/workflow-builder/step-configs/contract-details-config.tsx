"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { INPUT_CLASS, FIELD_GAP } from "../product-form-input-styles";

export function ContractDetailsConfig({
  config,
  onChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
}) {
  const current = config as Record<string, unknown> | undefined;

  // store as string while editing
  const value =
    typeof current?.min_contract_months === "number"
      ? String(current.min_contract_months)
      : typeof current?.min_contract_months === "string"
        ? current.min_contract_months
        : "";

  const monthsNumber = value ? Number(value) : null;

  const years =
    monthsNumber != null
      ? (monthsNumber / 12).toFixed(1)
      : null;

  const update = React.useCallback(
    (raw: string) => {
      onChange({
        ...(current ?? {}),
        min_contract_months: raw, // keep as string
      });
    },
    [current, onChange]
  );

  return (
    <div className={cn("grid pt-2 min-w-0 text-sm leading-6", FIELD_GAP)}>
      <div className={cn("grid", FIELD_GAP)}>
        <Label className="text-sm font-medium">
          Minimum contract duration (months)
        </Label>

        <Input
          type="text"
          inputMode="numeric"
          maxLength={3} // limit to 3 digits
          value={value}
          onChange={(e) => {
            const raw = e.target.value;

            // allow empty
            if (raw === "") {
              update("");
              return;
            }

            // digits only
            if (!/^\d+$/.test(raw)) return;

            update(raw);
          }}
          onBlur={(e) => {
            const raw = e.target.value;

            if (raw === "") return;

            const normalized = String(Number(raw));
            update(normalized);
          }}
          placeholder="e.g. 6"
          className={cn(INPUT_CLASS, "min-w-0")}
        />
        {monthsNumber != null && (
          <p className="text-xs text-muted-foreground">
            ≈ {years} years
          </p>
        )}
      </div>
    </div>
  );
}