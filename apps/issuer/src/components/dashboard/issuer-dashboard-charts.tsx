"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import type { IssuerBookOutstandingPoint } from "@cashsouk/types";
import { chartMonthLabel } from "./issuer-dashboard-display";

export function IssuerDashboardOutstandingChart({
  points,
}: {
  points: IssuerBookOutstandingPoint[];
}) {
  if (points.length < 2) return null;
  const limit = points.find((point) => point.limit != null)?.limit ?? null;
  const chartData = points.map((point) => ({
    date: point.date,
    drawn: point.drawn,
    label: chartMonthLabel(point.date),
  }));

  return (
    <Card className="min-w-0 rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-card-title text-primary">Outstanding over time</h3>
            <p className="mt-0.5 text-meta text-muted-foreground">Drawn balance at month end, last 12 months</p>
          </div>
          <div className="flex gap-3.5 text-meta text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Drawn
            </span>
            {limit != null ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-secondary" />
                Limit
              </span>
            ) : null}
          </div>
        </div>
        <div className="mt-4 h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="issFillDrawn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              {limit != null ? (
                <ReferenceLine y={limit} stroke="hsl(var(--secondary))" strokeDasharray="5 4" />
              ) : null}
              <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, { decimals: 0 })}
                contentStyle={{ fontSize: 12 }}
              />
              <Area
                type="monotone"
                dataKey="drawn"
                stroke="hsl(var(--primary))"
                strokeWidth={2.2}
                fill="url(#issFillDrawn)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
