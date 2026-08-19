"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import { formatCurrency, useOrganization } from "@cashsouk/config";
import {
  formatNoteReferenceDisplay,
  investorActivityTitle,
  investorActivityTypeLabel,
  type InvestorBalanceActivityEntry,
  type NoteListItem,
} from "@cashsouk/types";
import {
  LoadingState,
  PageShell,
  portalPageGutterClassName,
  useHeader,
} from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InvestmentDetailHero } from "@/investments/components/investment-detail-hero";
import { InvestmentReturnBreakdownCard } from "@/investments/components/investment-return-breakdown";
import {
  useInvestorBalanceActivity,
  useInvestorInvestments,
  useMarketplaceNote,
  useOpenInvestmentProspectus,
  useOpenMarketplaceProspectus,
} from "@/investments/hooks/use-marketplace-notes";
import { toast } from "sonner";

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

function getActivityMetadataLines(entry: InvestorBalanceActivityEntry) {
  if (entry.source !== "NOTE_INVESTMENT_RELEASE") return [];

  const metadata = asRecord(entry.metadata);
  if (metadata?.releaseReason !== "SETTLEMENT_PAYOUT") return [];

  const principal = Number(metadata.principal);
  const profitNet = Number(metadata.profitNet);
  const tawidh = Number(metadata.tawidhInvestorShare);
  const lines: string[] = [];

  if (Number.isFinite(principal) && principal > 0) {
    lines.push(`Principal ${formatCurrency(principal)}`);
  }
  if (Number.isFinite(profitNet) && profitNet > 0) {
    lines.push(`Net profit ${formatCurrency(profitNet)}`);
  }
  if (Number.isFinite(tawidh) && tawidh > 0.005) {
    lines.push(`Ta'widh ${formatCurrency(tawidh)}`);
  }

  return lines;
}

function getActivityLabel(entry: InvestorBalanceActivityEntry) {
  return investorActivityTitle(entry.source, asRecord(entry.metadata), entry.related ?? null);
}

export default function InvestmentDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { setTitle } = useHeader();
  const { activeOrganization } = useOrganization();
  const orgId = activeOrganization?.id;
  const investmentsQuery = useInvestorInvestments(orgId);
  const openInvestmentProspectus = useOpenInvestmentProspectus();
  const openMarketplaceProspectus = useOpenMarketplaceProspectus();

  const investedNote = React.useMemo(
    () => investmentsQuery.data?.notes.find((entry) => entry.id === noteId) ?? null,
    [investmentsQuery.data?.notes, noteId]
  );

  const shouldFetchMarketplace =
    Boolean(noteId) &&
    (investmentsQuery.isError || (investmentsQuery.isSuccess && !investedNote));

  const marketplaceQuery = useMarketplaceNote(noteId, { enabled: shouldFetchMarketplace });
  const activityQuery = useInvestorBalanceActivity(
    { page: 1, pageSize: 100, investorOrganizationId: activeOrganization?.id },
    { enabled: Boolean(investedNote) && Boolean(activeOrganization?.id) }
  );

  const note: NoteListItem | null = investedNote ?? marketplaceQuery.data ?? null;
  const isInvestedView = Boolean(investedNote);

  const positionLoading =
    !note &&
    (investmentsQuery.isPending ||
      (shouldFetchMarketplace && !marketplaceQuery.isSuccess && !marketplaceQuery.isError));

  React.useEffect(() => {
    setTitle("");
    return () => setTitle("");
  }, [setTitle]);

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
  const hasSettledBreakdown = React.useMemo(() => {
    if (!investedNote?.investorRepaymentSummary) return false;
    const summary = investedNote.investorRepaymentSummary;
    return (
      summary.receivedPayoutAmount > 0.005 ||
      summary.receivedProfitGrossAmount > 0.005 ||
      summary.receivedProfitNetAmount > 0.005 ||
      summary.receivedTawidhCompensationAmount > 0.005 ||
      (summary.receivedSettlementEvents?.length ?? 0) > 0
    );
  }, [investedNote]);

  const backHref = !note ? "/investments" : isInvestedView ? "/investments" : "/marketplace";
  const backLabel = !note
    ? "Back"
    : isInvestedView
      ? "Back to Portfolio"
      : "Back to marketplace";

  if (!note && !positionLoading) {
    const investmentMessage =
      investmentsQuery.error instanceof Error ? investmentsQuery.error.message : null;
    const marketplaceMessage =
      marketplaceQuery.error instanceof Error ? marketplaceQuery.error.message : null;
    const message = marketplaceMessage ?? investmentMessage ?? "Note not found";
    return (
      <div className={cn(portalPageGutterClassName, "space-y-6")}>
        <PageShell title="Investment" breadcrumb={<Link href="/investments">{backLabel}</Link>}>
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-ui text-destructive">
            {message}
          </div>
        </PageShell>
      </div>
    );
  }

  return (
    <div className={cn(portalPageGutterClassName, "space-y-6")}>
      <PageShell
        title={note ? formatNoteReferenceDisplay(note.noteReference) || "Investment" : "Investment"}
        description={
          note
            ? [note.issuerName?.trim() || "Issuer", note.issuerIndustry?.trim()]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
        breadcrumb={
          <Link href={backHref} className="inline-flex items-center gap-1.5">
            <ArrowLeftIcon className="h-4 w-4" />
            {backLabel}
          </Link>
        }
        action={
          note ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => {
                const investmentId = investedNote?.investorInvestmentId;
                const open = investmentId
                  ? () => openInvestmentProspectus(investmentId)
                  : () => openMarketplaceProspectus(note.id);
                void open().catch((err) =>
                  toast.error(err instanceof Error ? err.message : "Prospectus unavailable")
                );
              }}
            >
              View prospectus
            </Button>
          ) : null
        }
      >
        {positionLoading ? (
          <LoadingState variant="cards" rows={2} />
        ) : note ? (
          <InvestmentDetailHero
            note={note}
            investmentDate={investmentDate ?? note.updatedAt}
            isInvestedView={isInvestedView}
          />
        ) : null}

        {isInvestedView && investedNote && hasSettledBreakdown ? (
          <InvestmentReturnBreakdownCard note={investedNote} />
        ) : null}

        {isInvestedView ? (
          <section className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm md:p-5">
            <h2 className="text-section-title">Recent note activity</h2>
            {activityQuery.isPending ? (
              <LoadingState variant="table" rows={4} />
            ) : noteActivity.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border">
                <div className="hidden grid-cols-[minmax(0,1.2fr)_10rem_11rem] gap-4 border-b border-border bg-muted/40 px-4 py-3 text-ui font-medium text-muted-foreground md:grid">
                  <div>Transaction</div>
                  <div>Amount</div>
                  <div>Time</div>
                </div>
                <div className="divide-y divide-border">
                  {noteActivity.map((entry) => {
                    const metadataLines = getActivityMetadataLines(entry);
                    return (
                      <div
                        key={entry.id}
                        className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_10rem_11rem] md:items-center md:gap-4"
                      >
                        <div>
                          <div className="font-medium text-foreground">{getActivityLabel(entry)}</div>
                          <div className="mt-1 text-meta text-muted-foreground">
                            {investorActivityTypeLabel(entry.source, asRecord(entry.metadata))}
                          </div>
                          {metadataLines.length > 0 ? (
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-meta text-muted-foreground">
                              {metadataLines.map((line) => (
                                <span key={line}>{line}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div
                          className={cn(
                            "font-medium tabular-nums",
                            entry.direction === "IN"
                              ? "text-status-success-text"
                              : "text-status-rejected-text"
                          )}
                        >
                          {formatSignedCurrency(entry.direction, entry.amount)}
                        </div>
                        <div className="text-ui text-muted-foreground">
                          {formatDateTime(entry.postedAt)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-8 text-center text-ui text-muted-foreground">
                No note-specific balance activity has been recorded yet.
              </div>
            )}
          </section>
        ) : null}
      </PageShell>
    </div>
  );
}
