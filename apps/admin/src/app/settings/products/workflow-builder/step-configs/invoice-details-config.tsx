"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";

export interface InvoiceDetailsConfigShape {
  min_invoice_value?: number;
}

function getConfig(config: unknown): InvoiceDetailsConfigShape & { raw: Record<string, unknown> } {
  const c = config as Record<string, unknown> | undefined;
  return {
    min_invoice_value: (c?.min_invoice_value as number) ?? 0,
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
    <div className="grid gap-4 pt-2 text-sm leading-6 min-w-0">
      <div className="grid gap-2 min-w-0">
        <Label htmlFor="min-invoice-value" className="text-sm font-medium">
          Minimum invoice value (RM)
        </Label>
        <Input
          id="min-invoice-value"
          type="number"
          inputMode="numeric"
          min="0"
          max="999999999999"
          value={current.min_invoice_value}
          onChange={(e) => {
            const val = e.target.value.trim();
            if (val === '') return;
            const parsed = parseInt(val, 10);
            if (!Number.isNaN(parsed) && parsed >= 0 && String(parsed).length <= 12) {
              update({ min_invoice_value: parsed });
            }
          }}
          placeholder="e.g. 0"
          className="text-sm leading-6"
        />
      </div>
    </div>
  );
}
