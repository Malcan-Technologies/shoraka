"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AttentionCardHeading } from "@/components/attention-type-title";
import type { AttentionFinancingKind } from "@/components/attention-type";

export function FinancingAttentionCardLayout({
  surfaceClassName,
  kind,
  badge,
  headline,
  customer,
  amount,
  meta,
  detail,
  hint,
  product,
  related,
  ctaHref,
  ctaLabel,
  ctaVariant = "default",
}: {
  surfaceClassName: string;
  kind: AttentionFinancingKind;
  badge: ReactNode;
  headline: string;
  customer: string;
  amount: string;
  meta: string;
  detail: string | null;
  hint: string | null;
  product?: ReactNode;
  related?: ReactNode;
  ctaHref: string;
  ctaLabel: string;
  ctaVariant?: "default" | "outline";
}) {
  return (
    <article
      className={cn(
        "flex h-full min-h-[18.5rem] w-full flex-col rounded-2xl border p-6 shadow-sm md:p-8 md:shadow",
        surfaceClassName
      )}
    >
      <div className="flex items-start justify-between gap-3">{badge}</div>
      <AttentionCardHeading kind={kind}>{headline}</AttentionCardHeading>
      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <p className="truncate text-ui text-muted-foreground" title={customer}>
          {customer}
        </p>
        <p className="mt-1 text-section-title tabular-nums tracking-tight">{amount}</p>
        <p className="mt-3 text-ui text-muted-foreground">{meta}</p>
        {detail ? <p className="text-ui text-muted-foreground">{detail}</p> : null}
        {hint ? <p className="mt-2 text-ui text-muted-foreground">{hint}</p> : null}
        {product ? <div className="mt-2 min-w-0">{product}</div> : null}
        {related ? <div className="mt-2 min-w-0">{related}</div> : null}
        <div className="mt-auto pt-6">
          <Button size="lg" variant={ctaVariant} className="w-full" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
