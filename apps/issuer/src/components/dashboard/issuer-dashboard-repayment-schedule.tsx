"use client";

import Link from "next/link";
import { Card, CardContent } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { formatNoteReference, type IssuerDashboardBook } from "@cashsouk/types";
import { cn } from "@/lib/utils";
import { calendarMonthDay, formatCompactThousands, monthShortFromYearMonth } from "./issuer-dashboard-display";

export function IssuerDashboardRepaymentSchedule({
  book,
}: {
  book: IssuerDashboardBook;
}) {
  const months = book.repaymentSchedule;
  const upcoming = book.upcomingRepayments;
  if (months.length === 0 && upcoming.length === 0) return null;

  const maxAmount = Math.max(...months.map((month) => month.amount), 1);

  return (
    <Card className="min-w-0 rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-card-title text-primary">Repayment schedule</h3>
            <p className="mt-0.5 text-meta text-muted-foreground">What you owe, and when</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums tracking-tight">
              {formatCurrency(book.outstandingAmount, { decimals: 0 })}
            </p>
            <p className="text-meta text-muted-foreground">total outstanding</p>
          </div>
        </div>

        {months.length > 0 ? (
          <>
            <div
              className="mt-5 grid items-end gap-3"
              style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, height: 104 }}
            >
              {months.map((month, index) => {
                const height = Math.max(8, Math.round((month.amount / maxAmount) * 100));
                return (
                  <div key={month.yearMonth} className="flex h-full flex-col justify-end gap-2">
                    <div className="text-center text-meta font-semibold tabular-nums">
                      {formatCompactThousands(month.amount)}
                    </div>
                    <div
                      className={cn(
                        "rounded-t-lg",
                        index === 0 ? "bg-status-action-text" : index === months.length - 1 ? "bg-secondary/80" : "bg-primary/80"
                      )}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div
              className="mt-2 grid gap-3 border-t border-border pt-2"
              style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}
            >
              {months.map((month, index) => (
                <div key={`${month.yearMonth}-label`} className="text-center">
                  <p className={cn("text-ui font-medium", index === 0 && "text-status-action-text")}>
                    {monthShortFromYearMonth(month.yearMonth, month.label)}
                  </p>
                  <p className="text-meta text-muted-foreground">
                    {month.count} note{month.count === 1 ? "" : "s"}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {upcoming.length > 0 ? (
          <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
            {upcoming.map((row, index) => {
              const parts = calendarMonthDay(row.dueDate);
              const nearest = index === 0;
              return (
                <div key={`${row.noteId}-${row.dueDate}`} className="flex items-center gap-3">
                  {parts ? (
                    <span
                      className={cn(
                        "w-11 shrink-0 rounded-lg py-1 text-center",
                        nearest ? "bg-status-action-bg" : "bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "block text-meta",
                          nearest ? "text-status-action-text/80" : "text-muted-foreground"
                        )}
                      >
                        {parts.month}
                      </span>
                      <span
                        className={cn(
                          "block text-ui font-semibold tabular-nums",
                          nearest ? "text-status-action-text" : "text-foreground"
                        )}
                      >
                        {parts.day}
                      </span>
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-ui font-medium tabular-nums">
                      {formatNoteReference({ noteReference: row.noteReference, id: row.noteId })}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      {row.paymasterName ? `Paymaster: ${row.paymasterName}` : "Upcoming repayment"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-ui font-semibold tabular-nums">
                      {formatCurrency(row.amount, { decimals: 0 })}
                    </p>
                    {row.profit > 0 ? (
                      <p className="text-meta text-muted-foreground">
                        incl. {formatCurrency(row.profit, { decimals: 0 })} profit
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <Link href="/financing" className="text-ui font-medium text-primary hover:text-accent">
              Full schedule →
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
