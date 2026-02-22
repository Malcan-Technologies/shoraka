"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";
import { formatMoney } from "../../components/money";
import { MoneyInput } from "../../components/money-input";

export interface InvoiceDetailsConfigShape {
  min_invoice_value?: string | null;
  max_invoice_value?: string | null;
}

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
    <div className="grid gap-6 pt-2 text-sm leading-6 min-w-0">
      {/* MIN */}
      <div className="grid gap-2 min-w-0">
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
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no minimum limit.
        </p>
      </div>

      {/* MAX */}
      <div className="grid gap-2 min-w-0">
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
        />
        <p className="text-xs text-muted-foreground">
          Leave blank for no maximum limit.
        </p>
      </div>
    </div>
  );
}
