"use client";

import { Label } from "../../../../../components/ui/label";
import { Input } from "../../../../../components/ui/input";

const DEFAULT_MAX_FINANCING_RATE_PERCENT = 80;

function getMaxFinancingRatePercent(config: unknown): number {
  const c = config as Record<string, unknown> | undefined;
  const v = c?.maxFinancingRatePercent;
  if (typeof v === "number" && !Number.isNaN(v) && v >= 0 && v <= 100) return v;
  return DEFAULT_MAX_FINANCING_RATE_PERCENT;
}

export function InvoiceDetailsConfig({ config, onChange }: { config: unknown; onChange: (config: unknown) => void }) {
  const base = (config as Record<string, unknown>) ?? {};
  const maxFinancingRatePercent = getMaxFinancingRatePercent(config);

  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.trim();
    if (raw === "") {
      onChange({ ...base, maxFinancingRatePercent: DEFAULT_MAX_FINANCING_RATE_PERCENT });
      return;
    }
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) {
      onChange({ ...base, maxFinancingRatePercent: n });
    }
  };

  return (
    <div className="grid gap-2 pt-2">
      <div className="grid gap-2">
        <Label htmlFor="invoice-max-financing-rate">Max financing rate (%)</Label>
        <Input
          id="invoice-max-financing-rate"
          type="number"
          min={0}
          max={100}
          step={1}
          value={maxFinancingRatePercent}
          onChange={handleRateChange}
          className="text-sm w-24"
        />
      </div>
    </div>
  );
}
