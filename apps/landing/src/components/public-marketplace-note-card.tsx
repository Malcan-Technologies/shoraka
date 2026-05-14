"use client";

import Link from "next/link";
import {
  ArrowDownTrayIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";
import { formatNoteReferenceDisplay } from "@cashsouk/types";
import { Button, SoukscoreRiskRatingBadge, cn } from "@cashsouk/ui";

export type PublicMarketplaceNote = {
  id: string;
  noteCode: string | null;
  issuerName: string | null;
  /** Human-readable listing title (search). Card headline uses note reference. */
  noteTitle: string | null;
  /** Product name (document icon row). */
  productName: string | null;
  industry: string | null;
  fundedAmount: number;
  goalAmount: number;
  annualReturn: number | null;
  tenorDays: number | null;
  riskScore: string | null;
  daysLeft: number | null;
  investable: boolean;
  isFeatured?: boolean;
  featuredRank?: number;
};

const MARKETPLACE_ACTION_BUTTON_CLASS =
  "bg-primary text-primary-foreground shadow-brand hover:opacity-95";

function currency(amount: number) {
  return `RM ${amount.toLocaleString("en-MY")}`;
}

function textOrDash(value?: string | null) {
  return value && value.trim().length > 0 ? value : "-";
}

export function PublicMarketplaceNoteCard({ note }: { note: PublicMarketplaceNote }) {
  const progressDenominator = note.goalAmount > 0 ? note.goalAmount : 0;
  const fundingProgress =
    progressDenominator > 0
      ? Math.min(100, Math.round((note.fundedAmount / progressDenominator) * 100))
      : 0;
  const riskRatingForBadge = note.riskScore?.trim() ? note.riskScore : null;

  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-2xl border border-border bg-card shadow-sm",
        note.isFeatured && "border-border bg-card"
      )}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 items-start gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight text-foreground">
                {textOrDash(formatNoteReferenceDisplay(note.noteCode))}
              </h3>
              <div className="flex min-h-[2.75rem] flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1">
                <span className="inline-flex items-center gap-1">
                  <BuildingOffice2Icon className="h-3.5 w-3.5 shrink-0" />
                  {textOrDash(note.industry)}
                </span>
                <span className="inline-flex min-w-0 items-center gap-1">
                  <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Product: {textOrDash(note.productName)}</span>
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-primary"
              aria-label="More note actions"
            >
              <EllipsisVerticalIcon className="h-4 w-4" />
            </Button>
          </div>

          <div className="shrink-0 space-y-2">
            <div className="flex h-5 items-center justify-end">
              <span className="text-xs text-muted-foreground">
                {note.daysLeft !== null ? `${note.daysLeft} day(s) left` : "-"}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${fundingProgress}%` }}
              />
            </div>
            <div className="flex min-h-10 items-center justify-between gap-2 text-xs font-medium tabular-nums text-foreground">
              <span className="min-w-0 truncate">Funded {currency(note.fundedAmount)}</span>
              <span className="min-w-0 shrink-0 text-right">Goal {currency(note.goalAmount)}</span>
            </div>
          </div>

          <div className="grid shrink-0 grid-cols-3 gap-3 items-stretch">
            <div className="flex flex-col text-center">
              <div className="flex flex-1 flex-col rounded-2xl border bg-muted/20 p-3">
                <div className="flex min-h-[4.25rem] flex-1 items-center justify-center text-4xl font-semibold leading-none tabular-nums text-foreground">
                  {note.annualReturn !== null ? `${note.annualReturn}%` : "-"}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Per annum</div>
            </div>
            <div className="flex flex-col text-center">
              <div className="flex flex-1 flex-col rounded-2xl border bg-muted/20 p-3">
                <div className="flex min-h-[4.25rem] flex-1 items-center justify-center text-4xl font-semibold leading-none tabular-nums text-foreground">
                  {note.tenorDays ?? "-"}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">Days</div>
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
              <div className="mt-1 text-[11px] text-muted-foreground">Score</div>
            </div>
          </div>

          <div className="mt-auto shrink-0 space-y-2 border-t border-border pt-4">
            <Button
              asChild={note.investable}
              variant="default"
              className={cn("h-10 w-full rounded-lg text-sm", MARKETPLACE_ACTION_BUTTON_CLASS)}
              disabled={!note.investable}
            >
              {note.investable ? (
                <Link href="/get-started">Invest now</Link>
              ) : (
                <span>Fully allocated</span>
              )}
            </Button>
            <Button
              variant="ghost"
              className="h-7 w-full gap-1 text-xs text-muted-foreground hover:bg-transparent hover:text-primary"
            >
              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
              Download info sheet
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
