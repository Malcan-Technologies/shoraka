import Link from "next/link";
import {
  ArrowDownTrayIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { formatInvestorReturnRatePercent, formatNoteReferenceDisplay } from "@cashsouk/types";
import { Button, SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";

export type InvestmentListingData = {
  id: string;
  /** Stored note reference; card headline uses formatted display. */
  noteReference: string | null;
  /** Product name (document icon row). */
  productName: string | null;
  sector: string | null;
  daysLeft: number | null;
  funded: number;
  goal: number;
  ratePercent: number | null;
  tenorDays: number | null;
  score: string | null;
};

export function formatRm(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export function InvestmentListingCard({
  data,
  ctaLabel = "Invest now",
  ctaHref = "/get-started",
  showDownloadLink = false,
  ctaClassName,
}: {
  data: InvestmentListingData;
  ctaLabel?: string;
  ctaHref?: string;
  showDownloadLink?: boolean;
  ctaClassName?: string;
}) {
  const pct =
    data.goal > 0 ? Math.min(100, Math.round((data.funded / data.goal) * 100)) : 0;
  const riskRatingForBadge = data.score?.trim() ? data.score : null;

  return (
    <article className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="p-5">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {textOrDash(formatNoteReferenceDisplay(data.noteReference))}
              </h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {textOrDash(data.sector)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">Product: {textOrDash(data.productName)}</span>
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
              aria-label="More note actions"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex justify-end">
              <span className="text-xs text-muted-foreground">
                {data.daysLeft !== null ? `${data.daysLeft} day(s) left` : "-"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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
            <div className="flex items-center justify-between text-xs font-medium text-foreground">
              <span>Funded {formatRm(data.funded)}</span>
              <span>Goal {formatRm(data.goal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="flex min-h-[4.25rem] items-center justify-center px-1.5 text-[clamp(1.5rem,4.5vw,2rem)] font-semibold leading-none tabular-nums text-foreground">
                  {formatInvestorReturnRatePercent(data.ratePercent)}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Per annum</p>
            </div>
            <div className="text-center">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <p className="flex min-h-[4.25rem] items-center justify-center text-4xl font-semibold leading-none tabular-nums text-foreground">
                  {data.tenorDays ?? "-"}
                </p>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Days</p>
            </div>
            <div className="text-center">
              <div className="rounded-2xl border bg-muted/20 p-3">
                <SoukscoreRiskRatingBadge
                  riskRating={riskRatingForBadge}
                  className={cn(
                    "flex min-h-[4.25rem] w-full items-center justify-center rounded-xl px-2 py-2",
                    "text-4xl font-semibold leading-none tracking-tight"
                  )}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">Score</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="px-0 pb-0 pt-0">
              <Button
                asChild
                className={cn(
                  "h-10 w-full rounded-lg text-sm bg-primary text-primary-foreground shadow-brand hover:opacity-95",
                  ctaClassName
                )}
              >
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
            </div>
            {showDownloadLink ? (
              <Link
                href="#"
                className="flex items-center justify-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Download info sheet
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
