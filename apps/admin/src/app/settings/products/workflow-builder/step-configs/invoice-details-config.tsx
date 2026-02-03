"use client";

import * as React from "react";
import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";

const DEFAULT_MAX_FINANCING_RATE_PERCENT = 80;

function getMaxFinancingRatePercent(config: unknown): number {
  const c = config as Record<string, unknown> | undefined;
  const v = c?.max_financing_rate_percent;
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100) return v;
  return DEFAULT_MAX_FINANCING_RATE_PERCENT;
}

export function InvoiceDetailsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  const base = (config as Record<string, unknown>) ?? {};
  const maxFinancingRatePercent = getMaxFinancingRatePercent(config);

  React.useEffect(() => {
    const c = config as Record<string, unknown> | undefined;
    if (c && c.max_financing_rate_percent === undefined) {
      onChange({ ...c, max_financing_rate_percent: DEFAULT_MAX_FINANCING_RATE_PERCENT });
    }
  }, [config, onChange]);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (raw === "") {
      onChange({ ...base, max_financing_rate_percent: DEFAULT_MAX_FINANCING_RATE_PERCENT });
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) {
      onChange({ ...base, max_financing_rate_percent: n });
    }
  };

  return (
    <div className="grid gap-2 pt-2 min-w-0 text-sm leading-6">
      <div className="grid gap-2">
        <Label htmlFor="invoice-max-financing-rate" className="text-sm font-medium">Max financing rate (%)</Label>
        <Input
          id="invoice-max-financing-rate"
          type="number"
          min={0}
          max={100}
          step={1}
          value={maxFinancingRatePercent}
          onChange={handleRateChange}
          className="text-sm leading-6 w-full max-w-[6rem]"
        />
      </div>
    </div>
  );
}
