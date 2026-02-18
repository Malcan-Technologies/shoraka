"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";

export interface InvoiceDetailsConfigShape {
  min_invoice_value?: number;
  max_invoice_value?: number;
  max_invoice_maturity_days?: number;
  min_contract_months?: number;
}

function getConfig(config: unknown): InvoiceDetailsConfigShape & { raw: Record<string, unknown> } {
  const c = config as Record<string, unknown> | undefined;
  return {
    min_invoice_value: (c?.min_invoice_value as number) ?? 0,
    max_invoice_value: (c?.max_invoice_value as number) ?? 500000,
    max_invoice_maturity_days: (c?.max_invoice_maturity_days as number) ?? 180,
    min_contract_months: (c?.min_contract_months as number) ?? 6,
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
          value={current.min_invoice_value}
          onChange={(e) => update({ min_invoice_value: parseInt(e.target.value, 10) || 0 })}
          placeholder="e.g. 0"
          className="text-sm leading-6"
        />
      </div>

      <div className="grid gap-2 min-w-0">
        <Label htmlFor="max-invoice-value" className="text-sm font-medium">
          Maximum invoice value (RM)
        </Label>
        <Input
          id="max-invoice-value"
          type="number"
          value={current.max_invoice_value}
          onChange={(e) => update({ max_invoice_value: parseInt(e.target.value, 10) || 500000 })}
          placeholder="e.g. 500000"
          className="text-sm leading-6"
        />
      </div>

      <div className="grid gap-2 min-w-0">
        <Label htmlFor="max-invoice-maturity-days" className="text-sm font-medium">
          Maximum invoice maturity (days)
        </Label>
        <Input
          id="max-invoice-maturity-days"
          type="number"
          value={current.max_invoice_maturity_days}
          onChange={(e) => update({ max_invoice_maturity_days: parseInt(e.target.value, 10) || 180 })}
          placeholder="e.g. 180"
          className="text-sm leading-6"
        />
      </div>

      <div className="grid gap-2 min-w-0">
        <Label htmlFor="min-contract-months" className="text-sm font-medium">
          Minimum contract duration (months)
        </Label>
        <Input
          id="min-contract-months"
          type="number"
          value={current.min_contract_months}
          onChange={(e) => update({ min_contract_months: parseInt(e.target.value, 10) || 6 })}
          placeholder="e.g. 6"
          className="text-sm leading-6"
        />
      </div>
    </div>
  );
}
