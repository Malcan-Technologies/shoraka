"use client";

import * as React from "react";

/** Shared “Needs your attention” + rest sections used on Financing tabs. */
export function FinancingAttentionList({
  attentionCount,
  itemLabelPlural,
  attentionOnPage,
  restOnPage,
}: {
  attentionCount: number;
  itemLabelPlural: string;
  attentionOnPage: React.ReactNode[];
  restOnPage: React.ReactNode[];
}) {
  const hasAttentionOnPage = attentionOnPage.length > 0;
  const hasRestOnPage = restOnPage.length > 0;

  return (
    <div className="space-y-8">
      {hasAttentionOnPage ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Needs your attention</h2>
            <span className="text-ui text-muted-foreground">
              {attentionCount} {attentionCount === 1 ? "item" : "items"}
            </span>
          </div>
          <div className="space-y-4">{attentionOnPage}</div>
        </section>
      ) : null}

      {hasRestOnPage ? (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">
            {hasAttentionOnPage
              ? `All ${itemLabelPlural}`
              : itemLabelPlural.charAt(0).toUpperCase() + itemLabelPlural.slice(1)}
          </h2>
          <div className="space-y-4">{restOnPage}</div>
        </section>
      ) : null}
    </div>
  );
}
