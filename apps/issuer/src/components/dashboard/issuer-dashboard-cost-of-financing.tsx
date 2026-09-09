"use client";

import { Card, CardContent } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { IssuerBookCostOfFinancingYtd } from "@cashsouk/types";
import { visibleCostOfFinancingLines } from "./issuer-dashboard-display";

export function IssuerDashboardCostOfFinancing({
  cost,
}: {
  cost: IssuerBookCostOfFinancingYtd;
}) {
  const lines = visibleCostOfFinancingLines(cost);

  return (
    <Card className="min-w-0 rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-card-title text-primary">Cost of financing</h3>
            <p className="mt-0.5 text-meta text-muted-foreground">
              Posted issuer charges in {cost.year}, Malaysia calendar year
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums tracking-tight">
              {formatCurrency(cost.total, { decimals: 0 })}
            </p>
            <p className="text-meta text-muted-foreground">
              {cost.effectivePercent != null
                ? `${cost.effectivePercent.toFixed(1)}% of amount drawn`
                : "YTD total"}
            </p>
          </div>
        </div>
        {lines.length > 0 ? (
          <dl className="mt-5 space-y-3">
            {lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between gap-4">
                <dt className="text-ui text-muted-foreground">{line.label}</dt>
                <dd className="text-ui font-medium tabular-nums">
                  {formatCurrency(line.amount, { decimals: 0 })}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-5 text-ui text-muted-foreground">No posted financing charges this year.</p>
        )}
      </CardContent>
    </Card>
  );
}
