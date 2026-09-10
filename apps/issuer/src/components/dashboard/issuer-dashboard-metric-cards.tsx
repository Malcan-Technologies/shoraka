"use client";

import { Card, CardContent, StatusBadge } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { formatNoteDateEnMy } from "@cashsouk/types";
import type { IssuerDashboardBook } from "@cashsouk/types";
import { hasFacilityLimit } from "./issuer-dashboard-display";

function daysLabel(days: number): { label: string; status: "action" | "rejected" | "success" } {
  if (days < 0) return { label: `${Math.abs(days)} days overdue`, status: "rejected" };
  if (days === 0) return { label: "Due today", status: "action" };
  return { label: `${days} day${days === 1 ? "" : "s"}`, status: "action" };
}

export function IssuerDashboardMetricCards({
  book,
  onTimePercent,
  pastDueCount,
}: {
  book: IssuerDashboardBook;
  onTimePercent: number | null;
  pastDueCount: number | null;
}) {
  const next = book.nextRepayment;
  const showLimit = hasFacilityLimit({
    availableLimit: book.availableLimit,
    approvedLimit: book.approvedLimit,
  });
  const drawnPct = book.drawnPercent != null ? Math.max(0, Math.min(100, Math.round(book.drawnPercent))) : 0;
  const onTrack = (onTimePercent == null || onTimePercent >= 100) && (pastDueCount == null || pastDueCount === 0);
  const nextDays =
    next && next.daysRemaining != null ? daysLabel(next.daysRemaining) : null;
  const dueLabel = next ? formatNoteDateEnMy(next.dueDate) : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/10 to-card shadow-sm">
        <CardContent className="p-5">
          <p className="text-ui font-medium text-primary">Outstanding financing</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {formatCurrency(book.outstandingAmount, { decimals: 0 })}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {book.liveNoteCount === 0
              ? "No live notes"
              : `${book.liveNoteCount} live note${book.liveNoteCount === 1 ? "" : "s"} · principal + profit due`}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui font-medium text-muted-foreground">Next repayment</span>
            {nextDays ? <StatusBadge label={nextDays.label} status={nextDays.status} size="sm" /> : null}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
            {next ? formatCurrency(next.amount, { decimals: 0 }) : "—"}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {next
              ? [dueLabel ? `due ${dueLabel}` : null, next.paymasterName ? `Paymaster: ${next.paymasterName}` : null]
                  .filter(Boolean)
                  .join(" · ")
              : "No upcoming repayment"}
          </p>
        </CardContent>
      </Card>

      {showLimit ? (
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-5">
            <p className="text-ui font-medium text-muted-foreground">Available limit</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">
              {formatCurrency(book.availableLimit ?? 0, { decimals: 0 })}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${drawnPct}%` }} />
            </div>
            <p className="mt-1.5 text-meta text-muted-foreground">
              {book.drawnPercent != null && book.approvedLimit != null
                ? `${drawnPct}% of ${formatCurrency(book.approvedLimit, { decimals: 0 })} drawn`
                : "Facility available to draw"}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-ui font-medium text-muted-foreground">Repayment record</span>
            {onTimePercent != null ? (
              <StatusBadge label={onTrack ? "On track" : "Needs attention"} status={onTrack ? "success" : "action"} size="sm" />
            ) : null}
          </div>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums tracking-tight ${
              onTimePercent != null && onTrack ? "text-status-success-text" : ""
            }`}
          >
            {onTimePercent != null ? `${Math.round(onTimePercent)}%` : "—"}
          </p>
          <p className="mt-1 text-meta text-muted-foreground">
            {pastDueCount == null
              ? "On-time repayment share"
              : pastDueCount === 0
                ? "0 past due"
                : `${pastDueCount} past due`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
