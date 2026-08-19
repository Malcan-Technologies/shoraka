"use client";

import * as React from "react";

export function InvestmentListSection({
  title,
  count,
  items,
}: {
  title: string;
  count?: number;
  items: Array<{ key: string; node: React.ReactNode }>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {count != null ? <span className="text-ui text-muted-foreground">{count}</span> : null}
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <React.Fragment key={item.key}>{item.node}</React.Fragment>
        ))}
      </div>
    </section>
  );
}
