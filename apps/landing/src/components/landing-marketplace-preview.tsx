import Link from "next/link";
import { BuildingOffice2Icon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Button, Card, CardContent, SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";
import {
  formatNoteReferenceDisplay,
  formatInvestorReturnRatePercent,
  resolveNetExpectedReturnRatePercent,
  type NoteListItem,
} from "@cashsouk/types";
import { resolveMarketplaceListingDaysLeft } from "@/lib/marketplace-listing-days";
import { resolveMarketplaceDaysToMaturity } from "@cashsouk/types";

function formatCurrency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY", {
    maximumFractionDigits: 0,
  })}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

function resolveFundingPercent(note: NoteListItem) {
  if (note.targetAmount <= 0) return 0;
  return Math.max(0, Math.min(100, (note.fundedAmount / note.targetAmount) * 100));
}

export function LandingMarketplacePreview({
  notes,
  investorListingsHref,
}: {
  notes: NoteListItem[];
  investorListingsHref: string;
}) {
  return (
    <section className="bg-muted/30 py-16 sm:py-20">
      <div className="container mx-auto px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-primary">Investment options</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Invest in verified secured loans
            </h2>
            <p className="text-[17px] leading-7 text-muted-foreground">
              Flexible funding options tailored to your business needs.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild variant="outline" className="h-11 px-6">
              <Link href="/get-started">Interested in investing</Link>
            </Button>
            <Button asChild className="h-11 px-6">
              <Link href={investorListingsHref}>View all listings</Link>
            </Button>
          </div>
        </div>

        {notes.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-[17px] leading-7 text-muted-foreground">
              No active notes are available right now. Check back soon for open listings.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
            {notes.map((note) => {
              const daysLeft = resolveMarketplaceListingDaysLeft(note.listingClosesAt);
              const daysToMaturity = resolveMarketplaceDaysToMaturity(note.maturityDate);
              const fundingPercent = resolveFundingPercent(note);
              const riskRatingForBadge = note.riskRating?.trim() ? note.riskRating : null;
              const netReturn = resolveNetExpectedReturnRatePercent(note);
              return (
                <Card key={note.id} className="flex h-full flex-col rounded-2xl border-border shadow-sm">
                  <CardContent className="flex flex-1 flex-col p-6">
                    <div className="flex min-h-0 flex-1 flex-col gap-5">
                      <div className="shrink-0 space-y-1">
                        <h3 className="line-clamp-2 text-2xl font-semibold leading-snug tracking-tight text-foreground">
                          {textOrDash(formatNoteReferenceDisplay(note.noteReference))}
                        </h3>
                        <div className="flex min-h-[2.75rem] flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <BuildingOffice2Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">{textOrDash(note.issuerIndustry)}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 sm:text-right">
                            <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            <span className="truncate">
                              Product: {textOrDash(note.productName)}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 space-y-2">
                        <div className="flex h-5 items-center justify-end text-sm text-muted-foreground">
                          <span>{daysLeft !== null ? `${daysLeft} day(s) left` : "-"}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground transition-all"
                            style={{ width: `${fundingPercent}%` }}
                          />
                        </div>
                        <div className="flex min-h-10 items-center justify-between gap-2 text-sm font-medium tabular-nums text-foreground">
                          <span className="min-w-0 truncate">
                            Funded {formatCurrency(note.fundedAmount)}
                          </span>
                          <span className="min-w-0 shrink-0 text-right">
                            Goal {formatCurrency(note.targetAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="grid shrink-0 grid-cols-3 gap-3 items-stretch">
                        <div className="flex flex-col text-center">
                          <div className="flex flex-1 flex-col rounded-2xl border bg-muted/20 p-3">
                            <div className="flex min-h-[4.25rem] flex-1 items-center justify-center px-1.5 text-[clamp(1.5rem,4.5vw,2rem)] font-semibold leading-none tabular-nums text-foreground">
                              {formatInvestorReturnRatePercent(netReturn)}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Per annum</div>
                        </div>
                        <div className="flex flex-col text-center">
                          <div className="flex flex-1 flex-col rounded-2xl border bg-muted/20 p-3">
                            <div className="flex min-h-[4.25rem] flex-1 items-center justify-center text-4xl font-semibold leading-none tabular-nums text-foreground">
                              {daysToMaturity ?? "-"}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Days</div>
                        </div>
                        <div className="flex flex-col text-center">
                          <div className="flex flex-1 flex-col rounded-2xl border bg-muted/20 p-3">
                            <SoukscoreRiskRatingBadge
                              riskRating={riskRatingForBadge}
                              className={cn(
                                "flex min-h-[4.25rem] w-full flex-1 items-center justify-center rounded-xl px-2 py-2",
                                "text-4xl font-semibold leading-none tracking-tight"
                              )}
                            />
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">Score</div>
                        </div>
                      </div>

                      <div className="mt-auto shrink-0 border-t border-border pt-4">
                        <Button asChild className="h-11 w-full text-base">
                          <Link href="/get-started">Invest now</Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
