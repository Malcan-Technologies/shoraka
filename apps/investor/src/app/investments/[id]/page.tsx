"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type {
  InvestorBalanceActivityEntry,
  MarketplaceNoteDetail,
  NoteListItem,
} from "@cashsouk/types";
import { Badge, Card, CardContent, CardHeader, CardTitle, Skeleton, useHeader } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvestmentPositionCard } from "@/investments/components/investment-position-card";
import {
  useInvestorBalanceActivity,
  useInvestorInvestments,
  useMarketplaceNote,
} from "@/investments/hooks/use-marketplace-notes";

function formatEnumLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSignedCurrency(direction: "IN" | "OUT", amount: number) {
  const prefix = direction === "IN" ? "+" : "-";
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getActivityLabel(entry: InvestorBalanceActivityEntry) {
  if (entry.source === "NOTE_INVESTMENT_COMMIT") return "Investment";
  if (entry.source === "NOTE_INVESTMENT_RELEASE") {
    const metadata = asRecord(entry.metadata);
    if (metadata?.releaseReason === "SETTLEMENT_PAYOUT") return "Repayment";
    return "Release";
  }
  if (entry.source === "MANUAL_TOPUP") return "Top up";
  return formatEnumLabel(entry.source);
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-28 rounded-xl" />
        <Skeleton className="h-5 w-40 rounded-md" />
      </div>
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <Skeleton className="h-72 w-full rounded-3xl" />
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
      <Skeleton className="h-80 w-full rounded-3xl" />
    </div>
  );
}

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { setTitle } = useHeader();
  const marketplaceQuery = useMarketplaceNote(noteId);
  const investmentsQuery = useInvestorInvestments();
  const activityQuery = useInvestorBalanceActivity({ page: 1, pageSize: 100 });

  const investedNote = React.useMemo(
    () => investmentsQuery.data?.notes.find((entry) => entry.id === noteId) ?? null,
    [investmentsQuery.data?.notes, noteId]
  );
  const marketplaceNote = marketplaceQuery.data ?? null;
  const note: NoteListItem | MarketplaceNoteDetail | null = investedNote ?? marketplaceNote;
  const isInvestedView = Boolean(investedNote);

  React.useEffect(() => {
    setTitle(note?.noteReference ?? "Investment Detail");
  }, [note?.noteReference, setTitle]);

  const noteActivity = React.useMemo(
    () => (activityQuery.data?.entries ?? []).filter((entry) => entry.noteId === noteId),
    [activityQuery.data?.entries, noteId]
  );
  const investmentDate = React.useMemo(() => {
    const commitDates = noteActivity
      .filter((entry) => entry.source === "NOTE_INVESTMENT_COMMIT")
      .map((entry) => entry.postedAt)
      .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
    return commitDates[0] ?? null;
  }, [noteActivity]);

  if (marketplaceQuery.isLoading || investmentsQuery.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-6 bg-white p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1240px]">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  if (!note) {
    const message =
      marketplaceQuery.error instanceof Error ? marketplaceQuery.error.message : "Note not found";
    return (
      <div className="flex flex-1 flex-col gap-6 bg-white p-4 md:p-8">
        <div className="mx-auto w-full max-w-[1240px] rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {message}
        </div>
      </div>
    );
  }

  const backHref = isInvestedView ? "/investments" : "/marketplace";
  const detailFooterRows = [
    {
      label: "Maturity date",
      value: formatDate(note.maturityDate),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6 bg-white p-4 md:p-8">
      <div className="mx-auto w-full max-w-[1240px] space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button asChild variant="ghost" className="-ml-3 w-fit gap-2 text-muted-foreground">
            <Link href={backHref}>
              <ArrowLeftIcon className="h-4 w-4" />
              {isInvestedView ? "Back to investments" : "Back to marketplace"}
            </Link>
          </Button>
        </div>

        <InvestmentPositionCard
          note={note}
          investmentDateValue={investmentDate ?? note.updatedAt}
          showDetailLink={false}
          footerRows={detailFooterRows}
        />

        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold">
                {isInvestedView ? "Recent note activity" : "Marketplace details"}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {isInvestedView
                  ? "Real investor balance entries linked to this note."
                  : "The key fields below reflect the current published marketplace listing."}
              </p>
            </div>
            <Badge
              variant="secondary"
              className="w-fit rounded-full border-transparent bg-primary text-primary-foreground px-2.5 py-1 text-xs font-medium"
            >
              {isInvestedView
                ? `${noteActivity.length} entries`
                : formatEnumLabel(note.listingStatus)}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {isInvestedView ? (
              activityQuery.isLoading ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Loading note activity...
                </div>
              ) : noteActivity.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  <div className="hidden grid-cols-[minmax(0,1.2fr)_140px_180px] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 md:grid">
                    <div>Transaction type</div>
                    <div>Amount</div>
                    <div>Time</div>
                  </div>
                  <div className="divide-y divide-slate-200">
                    {noteActivity.map((entry) => (
                      <div
                        key={entry.id}
                        className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_140px_180px] md:items-center md:gap-4"
                      >
                        <div>
                          <div className="font-medium text-slate-900">
                            {getActivityLabel(entry)}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {formatEnumLabel(entry.source)}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "font-medium",
                            entry.direction === "IN" ? "text-emerald-700" : "text-slate-900"
                          )}
                        >
                          {formatSignedCurrency(entry.direction, entry.amount)}
                        </div>
                        <div className="text-sm text-slate-500">
                          {formatDateTime(entry.postedAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No note-specific balance activity has been recorded yet.
                </div>
              )
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-sm text-muted-foreground">Note reference</div>
                  <div className="mt-1 font-semibold text-foreground">{note.noteReference}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-sm text-muted-foreground">Paymaster</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {note.paymasterName ?? "—"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-sm text-muted-foreground">Target amount</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {formatCurrency(note.targetAmount)}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="text-sm text-muted-foreground">Published date</div>
                  <div className="mt-1 font-semibold text-foreground">
                    {formatDate(note.publishedAt)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
