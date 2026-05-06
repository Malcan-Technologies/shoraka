import Link from "next/link";
import {
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import {
  BuildingOffice2Icon,
  DocumentTextIcon,
} from "@heroicons/react/24/solid";
import { Button, cn } from "@cashsouk/ui";

export type InvestmentListingData = {
  title: string;
  sector: string;
  noteRef: string;
  daysLeft: number;
  funded: number;
  goal: number;
  ratePercent: number;
  tenorDays: number;
  score: string;
};

export const DEFAULT_INVESTMENT_LISTING: InvestmentListingData = {
  title: "Invoice financing (Islamic)",
  sector: "Food & Beverages",
  noteRef: "00011",
  daysLeft: 14,
  funded: 3000,
  goal: 24000,
  ratePercent: 15,
  tenorDays: 45,
  score: "A",
};

export function formatRm(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

export function InvestmentListingCard({
  data = DEFAULT_INVESTMENT_LISTING,
  ctaLabel = "Invest now",
  ctaHref = "/get-started",
  showDownloadLink = false,
  ctaClassName,
}: {
  data?: InvestmentListingData;
  ctaLabel?: string;
  ctaHref?: string;
  showDownloadLink?: boolean;
  ctaClassName?: string;
}) {
  const pct =
    data.goal > 0 ? Math.min(100, Math.round((data.funded / data.goal) * 100)) : 0;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-lg font-bold text-foreground">{data.title}</h3>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BuildingOffice2Icon className="size-4 shrink-0 text-primary" aria-hidden />
            {data.sector}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <DocumentTextIcon className="size-4 shrink-0 text-primary" aria-hidden />
            Note: {data.noteRef}
          </span>
        </div>

        <div className="mt-6 space-y-2">
          <div className="flex justify-end text-xs font-medium text-muted-foreground">
            {data.daysLeft} day(s) left
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Funding progress"
            />
          </div>
          <div className="flex items-baseline justify-between gap-3 text-sm font-bold text-foreground">
            <span>Funded {formatRm(data.funded)}</span>
            <span>Goal {formatRm(data.goal)}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 divide-x divide-border py-6">
          <div className="px-2 text-center first:pl-0 last:pr-0">
            <p className="text-xl font-bold tabular-nums text-foreground md:text-2xl">
              {data.ratePercent}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Per annum</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground md:text-2xl">
              {data.tenorDays}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Days</p>
          </div>
          <div className="px-2 text-center">
            <p className="text-xl font-bold tabular-nums text-foreground md:text-2xl">
              {data.score}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Score</p>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "bg-card",
          !showDownloadLink && "rounded-b-2xl"
        )}
      >
        <div className="px-6 pb-6 pt-4 md:px-8 md:pb-6">
          <Button
            asChild
            className={cn(
              "h-11 w-full rounded-xl text-[15px] font-semibold bg-primary text-primary-foreground shadow-brand hover:opacity-95 md:h-12",
              ctaClassName
            )}
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
        {showDownloadLink ? (
          <div className="rounded-b-2xl px-6 pb-5 pt-1 md:px-8">
            <Link
              href="#"
              className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowDownTrayIcon className="size-4 shrink-0" aria-hidden />
              Download info sheet
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}
