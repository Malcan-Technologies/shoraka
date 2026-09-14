"use client";

import Link from "next/link";
import { Card, NoteStatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { formatNoteReferenceDisplay, type NoteListItem } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { HOLDINGS_PREVIEW_LIMIT, tenorProgressPercent } from "@/investments/dashboard-presentation";
import {
  getInvestmentMaturityDisplay,
  getInvestmentPositionFacts,
  isInvestorInvestmentCompleted,
} from "@/investments/investment-position-model";
import { sortInvestorInvestments } from "@/investments/sort-investments";

export function InvestorDashboardHoldings({ notes }: { notes: NoteListItem[] }) {
  const sorted = sortInvestorInvestments(notes, "maturity_soonest").slice(0, HOLDINGS_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, notes.length - sorted.length);
  const countLabel = `${notes.length} ${notes.length === 1 ? "note" : "notes"} · sorted by next settlement`;

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-section-title text-primary">My holdings</h2>
          <p className="mt-1 text-ui text-muted-foreground">{countLabel}</p>
        </div>
        <Link href="/investments" className="text-ui font-medium text-primary">
          Open portfolio →
        </Link>
      </div>
      {sorted.length === 0 ? (
        <p className="text-ui text-muted-foreground">You have no holdings yet.</p>
      ) : (
        <Card className="overflow-hidden rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
              <div className="grid grid-cols-[minmax(12rem,2.2fr)_minmax(7.5rem,1fr)_minmax(7rem,1fr)_minmax(0,1.5fr)_minmax(7.5rem,1fr)] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-ui font-semibold text-foreground">
                <span>Issuer / note</span>
                <span className="text-right">Invested</span>
                <span className="text-right">Expected profit</span>
                <span>Tenor progress</span>
                <span className="text-right">Status</span>
              </div>
              {sorted.map((item) => (
                <HoldingRow key={item.id} note={item} />
              ))}
            </div>
          </div>
          {hiddenCount > 0 ? (
            <div className="border-t border-border px-5 py-3">
              <Link href="/investments" className="text-ui font-medium text-primary">
                {hiddenCount === 1
                  ? "1 more in portfolio →"
                  : `${hiddenCount} more in portfolio →`}
              </Link>
            </div>
          ) : null}
        </Card>
      )}
    </section>
  );
}

function HoldingRow({ note }: { note: NoteListItem }) {
  const facts = getInvestmentPositionFacts(note);
  const maturity = getInvestmentMaturityDisplay(note);
  const progress = tenorProgressPercent(note);
  const overdue = maturity.tone === "overdue";
  const settled = isInvestorInvestmentCompleted(note);
  const progressClass = overdue
    ? "bg-status-rejected-text"
    : settled
      ? "bg-status-success-text"
      : "bg-status-active-text";
  const progressLabel = settled
    ? maturity.value !== "—"
      ? `Settled ${maturity.value}`
      : "Settled"
    : overdue
      ? `${maturity.value} ${maturity.unit}`
      : maturity.tone === "today"
        ? "Settles today"
        : maturity.tone === "soon" || maturity.tone === "upcoming"
          ? `Settles in ${maturity.value} ${maturity.value === "1" ? "day" : "days"}`
          : "—";

  return (
    <Link
      href={`/investments/${note.id}`}
      className={cn(
        "grid grid-cols-[minmax(12rem,2.2fr)_minmax(7.5rem,1fr)_minmax(7rem,1fr)_minmax(0,1.5fr)_minmax(7.5rem,1fr)] items-center gap-4 border-b border-border px-5 py-4 last:border-b-0 hover:bg-muted/30",
        overdue && "bg-status-rejected-bg/40"
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-ui font-medium text-foreground">
          {note.issuerName?.trim() || facts.noteLabel}
        </p>
        <p className="text-meta tabular-nums text-muted-foreground">
          {formatNoteReferenceDisplay(note.noteReference)}
        </p>
      </div>
      <p className="text-right text-ui tabular-nums">{formatCurrency(facts.invested)}</p>
      <p
        className={cn(
          "text-right text-ui tabular-nums",
          facts.expectedProfit > 0 ? "text-status-success-text" : "text-muted-foreground"
        )}
      >
        {formatCurrency(facts.expectedProfit)}
      </p>
      <div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", progressClass)}
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
        <p className={cn("mt-1 text-meta", overdue ? "text-status-rejected-text" : "text-muted-foreground")}>
          {progress == null && !settled && !overdue ? "Tenure set at disbursement" : progressLabel}
        </p>
      </div>
      <div className="flex justify-end">
        <NoteStatusBadge note={note} viewer="investor" />
      </div>
    </Link>
  );
}
