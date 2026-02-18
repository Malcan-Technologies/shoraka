"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";

export function ContractDetailsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  const current = config as Record<string, unknown> | undefined;
  const minContractMonths = (current?.min_contract_months as number) ?? (current?.minContractMonths as number) ?? 6;

  const update = React.useCallback(
    (updates: Record<string, unknown>) => {
      onChange({ ...(current ?? {}), ...updates });
    },
    [config, onChange, current]
  );

  return (
    <div className="grid gap-2 pt-2 min-w-0 text-sm leading-6">
      <div className="grid gap-2">
        <Label htmlFor="min-contract-months" className="text-sm font-medium">
          Minimum contract duration (months)
        </Label>
        <Input
          id="min-contract-months"
          type="number"
          value={minContractMonths}
          onChange={(e) => update({ min_contract_months: parseInt(e.target.value, 10) || 6 })}
          placeholder="e.g. 6"
          className="text-sm leading-6 min-w-0"
        />
      </div>
    </div>
  );
}
