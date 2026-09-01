import Link from "next/link";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { PUBLIC_MARKETPLACE_SIGN_UP_HREF } from "@/lib/public-marketplace";
import { ViewProspectusButton } from "./view-prospectus-button";
import {
  formatInvestorReturnRatePercent,
  formatNoteReferenceDisplay,
  isCompactNoteTimingValueShort,
  type NoteTimingDisplay,
} from "@cashsouk/types";
import { Button, InfoTooltip, ProductNameWithIcon, SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";

export type InvestmentListingData = {
  id: string;
  /** Investor-visible purpose of financing. Card headline prefers this over the note reference. */
  purposeOfFinancing?: string | null;
  contractTitle?: string | null;
  purposeOfContract?: string | null;
  /** Stored note reference; card headline uses formatted display when purpose is missing. */
  noteReference: string | null;
  /** Product name (document icon row). */
  productName: string | null;
  productImageUrl?: string | null;
  sector: string | null;
  daysLeft: number | null;
  funded: number;
  goal: number;
  ratePercent: number | null;
  tenorDays: number | null;
  timing: NoteTimingDisplay;
  score: string | null;
};

export function formatRm(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function contractLine(data: InvestmentListingData) {
  const purpose = data.purposeOfContract?.trim() || "";
  const title = data.contractTitle?.trim() || "";
  if (purpose && title && purpose.toLowerCase() !== title.toLowerCase()) {
    return `${title} · ${purpose}`;
  }
  return purpose || title;
}

export function toInvestmentListingData(note: {
  id: string;
  purposeOfFinancing?: string | null;
  contractTitle?: string | null;
  purposeOfContract?: string | null;
  noteCode?: string | null;
  noteReference?: string | null;
  productName?: string | null;
  productImageUrl?: string | null;
  industry?: string | null;
  sector?: string | null;
  daysLeft: number | null;
  fundedAmount?: number;
  funded?: number;
  goalAmount?: number;
  goal?: number;
  annualReturn?: number | null;
  ratePercent?: number | null;
  tenorDays: number | null;
  timing: NoteTimingDisplay;
  riskScore?: string | null;
  score?: string | null;
}): InvestmentListingData {
  return {
    id: note.id,
    purposeOfFinancing: note.purposeOfFinancing?.trim() || null,
    contractTitle: note.contractTitle?.trim() || null,
    purposeOfContract: note.purposeOfContract?.trim() || null,
    noteReference: (note.noteReference ?? note.noteCode)?.trim() || null,
    productName: note.productName?.trim() || null,
    productImageUrl: note.productImageUrl?.trim() || null,
    sector: (note.sector ?? note.industry)?.trim() || null,
    daysLeft: note.daysLeft,
    funded: note.funded ?? note.fundedAmount ?? 0,
    goal: note.goal ?? note.goalAmount ?? 0,
    ratePercent: note.ratePercent ?? note.annualReturn ?? null,
    tenorDays: note.tenorDays,
    timing: note.timing,
    score: note.score ?? note.riskScore ?? null,
  };
}

export function InvestmentListingCard({
  data,
  ctaLabel = "Invest now",
  ctaHref = PUBLIC_MARKETPLACE_SIGN_UP_HREF,
  showProspectus = false,
  ctaClassName,
}: {
  data: InvestmentListingData;
  ctaLabel?: string;
  ctaHref?: string;
  showProspectus?: boolean;
  ctaClassName?: string;
}) {
  const pct =
    data.goal > 0 ? Math.min(100, Math.round((data.funded / data.goal) * 100)) : 0;
  const riskRatingForBadge = data.score?.trim() ? data.score : null;
  const subtitle = contractLine(data);

  return (
    <article className="flex h-full w-full min-w-0 flex-col rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="min-w-0 space-y-1">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug tracking-tight text-foreground sm:min-h-[3.25rem] sm:text-lg">
              {textOrDash(
                data.purposeOfFinancing?.trim() || formatNoteReferenceDisplay(data.noteReference)
              )}
            </h3>
            <p className="line-clamp-2 min-h-10 text-xs leading-5 text-muted-foreground">
              {subtitle || "\u00a0"}
            </p>
            <div className="flex min-h-5 min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:gap-x-4">
              <span className="inline-flex min-w-0 items-center gap-1">
                <BuildingOffice2Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{textOrDash(data.sector)}</span>
              </span>
              <ProductNameWithIcon
                name={data.productName}
                imageUrl={data.productImageUrl}
                empty="-"
                size="xs"
                className="min-w-0 text-xs leading-5 text-muted-foreground"
                iconClassName="h-3.5 w-3.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex h-5 items-center justify-end">
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
            <div className="flex min-h-5 items-center justify-between gap-2 text-xs font-medium tabular-nums text-foreground">
              <span className="min-w-0 truncate">Funded {formatRm(data.funded)}</span>
              <span className="min-w-0 shrink-0 text-right">Goal {formatRm(data.goal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 items-stretch gap-2 sm:gap-3">
            <div className="min-w-0 text-center">
              <div className="rounded-xl border bg-muted/20 p-2 sm:rounded-2xl sm:p-3">
                <p className="flex min-h-14 items-center justify-center px-0.5 text-xl font-semibold leading-none tabular-nums text-foreground sm:min-h-[4.25rem] sm:px-1.5 sm:text-[clamp(1.5rem,4.5vw,2rem)]">
                  {formatInvestorReturnRatePercent(data.ratePercent)}
                </p>
              </div>
              <p className="mt-1 min-h-4 text-[11px] text-muted-foreground">
                {data.timing.isTenureNote ? "Up to" : "Per annum"}
              </p>
            </div>
            <div className="min-w-0 text-center">
              <div className="rounded-xl border bg-muted/20 p-2 sm:rounded-2xl sm:p-3">
                <p
                  className={cn(
                    "flex min-h-14 items-center justify-center px-0.5 font-semibold leading-tight tabular-nums text-foreground sm:min-h-[4.25rem] sm:px-1",
                    !isCompactNoteTimingValueShort(data.timing.compactValue)
                      ? "text-base sm:text-xl"
                      : "text-2xl leading-none sm:text-4xl"
                  )}
                >
                  {data.timing.compactValue}
                </p>
              </div>
              <p className="mt-1 inline-flex min-h-4 items-center justify-center gap-1 text-meta text-muted-foreground">
                {data.timing.compactLabel}
                {data.timing.tooltip ? (
                  <InfoTooltip content={data.timing.tooltip} iconClassName="h-3.5 w-3.5" />
                ) : null}
              </p>
            </div>
            <div className="min-w-0 text-center">
              <div className="rounded-xl border bg-muted/20 p-2 sm:rounded-2xl sm:p-3">
                <SoukscoreRiskRatingBadge
                  riskRating={riskRatingForBadge}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-center rounded-xl px-1 py-2 sm:min-h-[4.25rem] sm:px-2",
                    "text-2xl font-semibold leading-none tracking-tight sm:text-4xl"
                  )}
                />
              </div>
              <p className="mt-1 min-h-4 text-[11px] text-muted-foreground">Score</p>
            </div>
          </div>

          <div className="mt-auto space-y-2">
            <Button
              asChild
              className={cn(
                "h-10 w-full rounded-lg text-sm bg-primary text-primary-foreground shadow-brand hover:opacity-95",
                ctaClassName
              )}
            >
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
            {showProspectus ? (
              <div className="flex h-7 items-center justify-center">
                <ViewProspectusButton noteId={data.id} variant="link" />
              </div>
            ) : (
              <div className="h-7" aria-hidden />
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
