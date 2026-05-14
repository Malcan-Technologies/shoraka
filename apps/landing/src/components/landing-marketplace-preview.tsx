import Link from "next/link";
import { Button, Card, CardContent } from "@cashsouk/ui";
import type { NoteListItem } from "@cashsouk/types";

function formatCurrency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY", {
    maximumFractionDigits: 0,
  })}`;
}

function resolveMarketplaceDaysLeft(maturityDate?: string | null): number | null {
  if (!maturityDate) return null;

  const target = new Date(maturityDate);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const millisRemaining = target.getTime() - Date.now();
  return Math.max(1, Math.ceil(millisRemaining / (1000 * 60 * 60 * 24)));
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
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {notes.map((note) => {
              const daysLeft = resolveMarketplaceDaysLeft(note.maturityDate);
              const fundingPercent = resolveFundingPercent(note);
              return (
                <Card key={note.id} className="rounded-2xl border-border shadow-sm">
                  <CardContent className="space-y-5 p-6">
                    <div className="space-y-1.5">
                      <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                        {textOrDash(note.productName ?? note.title)}
                      </h3>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{textOrDash(note.issuerIndustry)}</span>
                        <span>Note: {textOrDash(note.noteReference)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-end text-sm text-muted-foreground">
                        <span>{daysLeft !== null ? `${daysLeft} day(s) left` : "-"}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{ width: `${fundingPercent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm font-medium text-foreground">
                        <span>Funded {formatCurrency(note.fundedAmount)}</span>
                        <span>Goal {formatCurrency(note.targetAmount)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border">
                      <div className="px-2 py-4 text-center">
                        <div className="text-4xl font-semibold leading-none text-foreground">
                          {note.profitRatePercent !== null ? `${note.profitRatePercent}%` : "-"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Per annum</div>
                      </div>
                      <div className="px-2 py-4 text-center">
                        <div className="text-4xl font-semibold leading-none text-foreground">
                          {daysLeft ?? "-"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Days</div>
                      </div>
                      <div className="px-2 py-4 text-center">
                        <div className="text-4xl font-semibold leading-none text-foreground">
                          {textOrDash(note.riskRating)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">Score</div>
                      </div>
                    </div>

                    <Button asChild className="h-11 w-full text-base">
                      <Link href="/get-started">Invest now</Link>
                    </Button>
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
