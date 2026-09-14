import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type OfferTermsKpiTile = {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  valueClassName?: string;
};

export function OfferTermsKpiGrid({ tiles }: { tiles: OfferTermsKpiTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <div className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border [grid-template-columns:repeat(auto-fit,minmax(10.5rem,1fr))]">
      {tiles.map((tile) => (
        <div key={tile.key} className="bg-card px-4 py-3.5">
          <div className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
            {tile.label}
          </div>
          <div
            className={cn(
              "mt-1.5 text-xl font-bold tracking-tight tabular-nums text-foreground",
              tile.valueClassName
            )}
          >
            {tile.value}
          </div>
          {tile.hint ? (
            <div className="mt-1 text-meta tabular-nums text-muted-foreground">{tile.hint}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function OfferTermsDlColumn({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-meta font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <dl className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-ui">
        {children}
      </dl>
    </div>
  );
}

export function OfferTermsDlRow({
  label,
  value,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <>
      <dt className="min-w-0 break-words text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "m-0 min-w-0 break-words text-right font-medium tabular-nums [&>span]:block [&>span]:min-w-0",
          valueClassName
        )}
      >
        {value}
      </dd>
    </>
  );
}
