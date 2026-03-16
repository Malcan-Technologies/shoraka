"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "../../../../../components/ui/input";
import { Label } from "../../../../../components/ui/label";
import { INPUT_CLASS, FIELD_GAP, SECTION_GAP } from "../product-form-input-styles";
import { formatMoney } from "../../components/money";
import { MoneyInput } from "../../components/money-input";

export interface InvoiceDetailsConfigShape {
  min_invoice_value?: string | null;
  max_invoice_value?: string | null;
  min_financing_ratio_percent?: number | null;
  max_financing_ratio_percent?: number | null;
}

const DEFAULT_MIN_RATIO = 60;
const DEFAULT_MAX_RATIO = 80;

function getConfig(
  config: unknown
): InvoiceDetailsConfigShape & { raw: Record<string, unknown> } {
  const c = config as Record<string, unknown> | undefined;

  return {
    min_invoice_value:
      typeof c?.min_invoice_value === "string"
        ? c.min_invoice_value
        : typeof c?.min_invoice_value === "number"
          ? formatMoney(c.min_invoice_value)
          : null,

    max_invoice_value:
      typeof c?.max_invoice_value === "string"
        ? c.max_invoice_value
        : typeof c?.max_invoice_value === "number"
          ? formatMoney(c.max_invoice_value)
          : null,

    min_financing_ratio_percent:
      typeof c?.min_financing_ratio_percent === "number"
        ? c.min_financing_ratio_percent
        : typeof c?.min_financing_ratio_percent === "string"
          ? parseInt(c.min_financing_ratio_percent, 10)
          : null,

    max_financing_ratio_percent:
      typeof c?.max_financing_ratio_percent === "number"
        ? c.max_financing_ratio_percent
        : typeof c?.max_financing_ratio_percent === "string"
          ? parseInt(c.max_financing_ratio_percent, 10)
          : null,

    raw: c ?? {},
  };
}

export function InvoiceDetailsConfig({
  config,
  onChange,
}: {
  config: unknown;
  onChange: (config: unknown) => void;
}) {
  const current = getConfig(config);

  const update = React.useCallback(
    (updates: Partial<InvoiceDetailsConfigShape>) => {
      const next = { ...current.raw, ...updates } as Record<string, unknown>;
      onChange(next);
    },
    [config, onChange, current]
  );

  return (
    <div className={cn("grid pt-2 text-sm leading-6 min-w-0", SECTION_GAP)}>
      {/* MIN */}
      <div className={cn("grid min-w-0", FIELD_GAP)}>
        <Label className="text-sm font-medium">
          Minimum financing amount (RM)
        </Label>
        <MoneyInput
          value={current.min_invoice_value ?? ""}
          onValueChange={(v) =>
            update({ min_invoice_value: v || null })
          }
          placeholder="Leave blank for no minimum"
          maxIntDigits={12}
          allowEmpty
          inputClassName={INPUT_CLASS}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no minimum limit.
        </p>
      </div>

      {/* MAX */}
      <div className={cn("grid min-w-0", FIELD_GAP)}>
        <Label className="text-sm font-medium">
          Maximum financing amount (RM)
        </Label>
        <MoneyInput
          value={current.max_invoice_value ?? ""}
          onValueChange={(v) =>
            update({ max_invoice_value: v || null })
          }
          placeholder="Leave blank for no maximum"
          maxIntDigits={12}
          allowEmpty
          inputClassName={INPUT_CLASS}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no maximum limit.
        </p>
      </div>

      {/* MIN / MAX FINANCING RATIO — text inputs to avoid stepper bugs */}
      <div className={cn("grid grid-cols-2", SECTION_GAP)}>
        <div className={cn("grid min-w-0", FIELD_GAP)}>
          <Label className="text-sm font-medium">
            Min financing ratio (%)
          </Label>
          <Input
            type="text"
            inputMode="numeric"
            value={current.min_financing_ratio_percent ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === "" ? null : parseInt(v, 10);
              update({ min_financing_ratio_percent: num != null && !Number.isNaN(num) ? num : null });
            }}
            placeholder={String(DEFAULT_MIN_RATIO)}
            maxLength={3}
            className={INPUT_CLASS}
          />
        </div>
        <div className={cn("grid min-w-0", FIELD_GAP)}>
          <Label className="text-sm font-medium">
            Max financing ratio (%)
          </Label>
          <Input
            type="text"
            inputMode="numeric"
            value={current.max_financing_ratio_percent ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              const num = v === "" ? null : parseInt(v, 10);
              update({ max_financing_ratio_percent: num != null && !Number.isNaN(num) ? num : null });
            }}
            placeholder={String(DEFAULT_MAX_RATIO)}
            maxLength={3}
            className={INPUT_CLASS}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Used for issuer and admin invoice financing ratio limits. Defaults to 60–80% if blank.
      </p>
    </div>
  );
}
