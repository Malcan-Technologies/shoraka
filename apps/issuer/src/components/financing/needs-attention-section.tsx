"use client";

import * as React from "react";
import { AttentionSnapCarousel } from "@/components/attention-snap-carousel";
import type { AttentionSlideVariant } from "@/components/attention-snap-carousel-utils";

/** Shared “Needs your attention” carousel used on Financing tabs. */
export function FinancingAttentionList({
  attentionCount,
  attentionItems,
  restItems = [],
  carouselVariant = "featured",
  carouselLabel,
  itemLabelPlural,
}: {
  attentionCount: number;
  attentionItems: Array<{ key: string; node: React.ReactNode }>;
  restItems?: Array<{ key: string; node: React.ReactNode }>;
  carouselVariant?: AttentionSlideVariant;
  carouselLabel: string;
  itemLabelPlural?: string;
}) {
  const hasAttention = attentionItems.length > 0;
  const hasRest = restItems.length > 0;

  if (!hasAttention && !hasRest) return null;

  return (
    <div className="space-y-8">
      {hasAttention ? (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">Needs your attention</h2>
            <span className="text-ui text-muted-foreground">
              {attentionCount} to review
            </span>
          </div>
          <AttentionSnapCarousel
            ariaLabel={carouselLabel}
            variant={carouselVariant}
            items={attentionItems}
          />
        </section>
      ) : null}

      {hasRest && itemLabelPlural ? (
        <FinancingListSection
          title={
            hasAttention
              ? `All ${itemLabelPlural}`
              : itemLabelPlural.charAt(0).toUpperCase() + itemLabelPlural.slice(1)
          }
          items={restItems}
        />
      ) : null}
    </div>
  );
}

export function FinancingListSection({
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
        {count != null ? (
          <span className="text-ui text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <React.Fragment key={item.key}>{item.node}</React.Fragment>
        ))}
      </div>
    </section>
  );
}
