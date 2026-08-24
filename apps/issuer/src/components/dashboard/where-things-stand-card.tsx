"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  STATUS_TOKEN_DOT_CLASS,
  formatMoneyDisplay,
  type StatusToken,
} from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { ApplyForFinancingButton } from "@/components/apply-for-financing-button";
import { useIssuerBookSnapshot } from "@/hooks/use-issuer-book-snapshot";
import { LEFT_ON_CONTRACT_LABEL } from "@cashsouk/types";
import {
  formatRaisingDeadline,
  type FacilityBookSnapshot,
  type IncomingApplicationsSnapshot,
  type InvoiceBookSnapshot,
  type InvoiceLaneBreakdown,
  type InvoiceLaneKey,
  type RaisingNowSnapshot,
} from "@/lib/issuer-book-snapshot";
import { cn } from "@/lib/utils";

const APPLICATIONS_HREF = "/applications";
const FACILITIES_HREF = "/financing?tab=contracts";
const INVOICES_HREF = "/financing?tab=invoices";

const LANE_DOT: Record<InvoiceLaneKey, StatusToken> = {
  servicing: "active",
  raisingNow: "submitted",
  approvedNotListed: "neutral",
  funded: "submitted",
  inReview: "in-progress",
  repaid: "success",
};

function plural(count: number, singular: string, pluralLabel: string): string {
  return `${count} ${count === 1 ? singular : pluralLabel}`;
}

function needsYouLabel(count: number): string {
  return count === 1 ? "1 needs you" : `${count} need you`;
}

function LaneRows({
  lanes,
  showServicing,
  showInReview,
}: {
  lanes: InvoiceLaneBreakdown;
  showServicing: boolean;
  showInReview: boolean;
}) {
  const rows: { key: InvoiceLaneKey; label: string }[] = [];
  if (showServicing && lanes.servicing > 0) {
    rows.push({ key: "servicing", label: plural(lanes.servicing, "servicing", "servicing") });
  }
  if (lanes.raisingNow > 0) {
    rows.push({ key: "raisingNow", label: plural(lanes.raisingNow, "raising now", "raising now") });
  }
  if (lanes.approvedNotListed > 0) {
    rows.push({
      key: "approvedNotListed",
      label: plural(lanes.approvedNotListed, "approved, not listed", "approved, not listed"),
    });
  }
  if (lanes.funded > 0) {
    rows.push({
      key: "funded",
      label: plural(lanes.funded, "funded, awaiting start", "funded, awaiting start"),
    });
  }
  if (showInReview && lanes.inReview > 0) {
    rows.push({
      key: "inReview",
      label: plural(lanes.inReview, "still in review", "still in review"),
    });
  }
  if (lanes.repaid > 0) {
    rows.push({ key: "repaid", label: plural(lanes.repaid, "repaid", "repaid") });
  }
  if (rows.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2">
      {rows.map((row) => (
        <li key={row.key} className="flex items-center gap-2 text-ui leading-6 text-muted-foreground">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_TOKEN_DOT_CLASS[LANE_DOT[row.key]])}
            aria-hidden
          />
          {row.label}
        </li>
      ))}
    </ul>
  );
}

function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={label}
    >
      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function BookLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col rounded-xl border border-border bg-muted/30 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:px-5 md:py-5"
    >
      {children}
    </Link>
  );
}

function IncomingPanel({ incoming }: { incoming: IncomingApplicationsSnapshot }) {
  return (
    <BookLink href={APPLICATIONS_HREF}>
      <p className="text-ui font-medium leading-6 text-muted-foreground">Applications</p>
      <p className="mt-1 text-lg font-semibold tabular-nums leading-7 text-foreground">
        {incoming.openCount} in play
      </p>
      <ul className="mt-4 space-y-2">
        {incoming.needsYouCount > 0 ? (
          <li className="flex items-center gap-2 text-ui leading-6 text-muted-foreground">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_TOKEN_DOT_CLASS.action)} aria-hidden />
            {needsYouLabel(incoming.needsYouCount)}
          </li>
        ) : null}
        {incoming.withCashSoukCount > 0 ? (
          <li className="flex items-center gap-2 text-ui leading-6 text-muted-foreground">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_TOKEN_DOT_CLASS.submitted)} aria-hidden />
            {plural(incoming.withCashSoukCount, "with CashSouk", "with CashSouk")}
          </li>
        ) : null}
        {incoming.draftCount > 0 ? (
          <li className="flex items-center gap-2 text-ui leading-6 text-muted-foreground">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", STATUS_TOKEN_DOT_CLASS.neutral)} aria-hidden />
            {plural(incoming.draftCount, "draft", "drafts")}
          </li>
        ) : null}
      </ul>
    </BookLink>
  );
}

function FacilityPanel({ book }: { book: FacilityBookSnapshot }) {
  const statusBit =
    book.closedCount > 0 && book.activeCount === 0
      ? plural(book.closedCount, "closed", "closed")
      : plural(book.activeCount, "active", "active");
  const showMeter = book.approvedAmount != null && book.approvedAmount > 0;
  const used =
    book.utilizedAmount != null
      ? book.utilizedAmount
      : book.availableAmount != null && book.approvedAmount != null
        ? Math.max(0, book.approvedAmount - book.availableAmount)
        : 0;

  return (
    <BookLink href={FACILITIES_HREF}>
      <p className="text-ui font-medium leading-6 text-muted-foreground">Facilities</p>
      <p className="mt-1 text-lg font-semibold tabular-nums leading-7 text-foreground">
        {plural(book.facilityCount, "facility", "facilities")} · {statusBit}
      </p>
      {showMeter && book.approvedAmount != null ? (
        <div className="mt-4 space-y-2">
          <Meter
            value={used}
            max={book.approvedAmount}
            label={
              book.availableAmount != null
                ? `${formatMoneyDisplay(book.availableAmount)} left of ${formatMoneyDisplay(book.approvedAmount)} approved`
                : `${formatMoneyDisplay(used)} drawn of ${formatMoneyDisplay(book.approvedAmount)} approved`
            }
          />
          <p className="text-ui leading-6 text-muted-foreground">
            {book.availableAmount != null
              ? `${formatMoneyDisplay(book.availableAmount)} left to draw`
              : `${formatMoneyDisplay(used)} drawn`}
          </p>
          {book.pendingAmount != null && book.pendingAmount > 0 ? (
            <p className="text-ui leading-6 text-muted-foreground">
              {formatMoneyDisplay(book.pendingAmount)} reserved
            </p>
          ) : null}
          {book.lifetimeRemainingAmount != null ? (
            <p className="text-ui leading-6 text-muted-foreground">
              {LEFT_ON_CONTRACT_LABEL}: {formatMoneyDisplay(book.lifetimeRemainingAmount)}
              {book.lifetimeCapAmount != null
                ? ` of ${formatMoneyDisplay(book.lifetimeCapAmount)}`
                : ""}
            </p>
          ) : null}
          {book.repaidAmount != null && book.repaidAmount > 0 ? (
            <p className="text-ui leading-6 text-muted-foreground">
              {formatMoneyDisplay(book.repaidAmount)} repaid and released
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-4 text-ui font-medium leading-6 text-foreground">
        {book.invoices.total > 0
          ? `${plural(book.invoices.total, "invoice", "invoices")} currently drawn`
          : book.invoices.repaid > 0
            ? "Nothing currently drawn"
            : "No invoices drawn yet"}
      </p>
      <LaneRows lanes={book.invoices} showServicing showInReview />
    </BookLink>
  );
}

function InvoicePanel({ book }: { book: InvoiceBookSnapshot }) {
  return (
    <BookLink href={INVOICES_HREF}>
      <p className="text-ui font-medium leading-6 text-muted-foreground">Standalone invoices</p>
      <p className="mt-1 text-lg font-semibold tabular-nums leading-7 text-foreground">
        {plural(book.invoices.total, "invoice", "invoices")}
      </p>
      <LaneRows lanes={book.invoices} showServicing showInReview />
    </BookLink>
  );
}

function MoneyInPlay({
  outstanding,
  raising,
}: {
  outstanding: number | null;
  raising: RaisingNowSnapshot | null;
}) {
  const showOutstanding = outstanding != null && outstanding > 0;
  if (!showOutstanding && !raising) return null;
  const deadline = raising ? formatRaisingDeadline(raising.nearestDeadline) : null;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4",
        showOutstanding && raising ? "lg:grid-cols-2" : null
      )}
    >
      {showOutstanding && outstanding != null ? (
        <div className="rounded-xl border border-border bg-muted/30 px-4 py-4 md:px-5">
          <p className="text-ui font-medium leading-6 text-muted-foreground">Outstanding</p>
          <p className="mt-1 text-lg font-semibold tabular-nums leading-7 text-foreground">
            {formatMoneyDisplay(outstanding)}
          </p>
          <p className="mt-1 text-ui leading-6 text-muted-foreground">Live notes currently servicing</p>
        </div>
      ) : null}
      {raising ? (
        <Link
          href={INVOICES_HREF}
          className="rounded-xl border border-border bg-muted/30 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:px-5"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-ui font-medium leading-6 text-muted-foreground">Raising now</p>
            <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          <p className="mt-1 text-lg font-semibold tabular-nums leading-7 text-foreground">
            {formatMoneyDisplay(raising.fundedAmount)}
            <span className="text-ui font-medium text-muted-foreground">
              {" "}
              of {formatMoneyDisplay(raising.targetAmount)}
            </span>
          </p>
          <div className="mt-3">
            <Meter
              value={raising.fundedAmount}
              max={raising.targetAmount}
              label={`${formatMoneyDisplay(raising.fundedAmount)} of ${formatMoneyDisplay(raising.targetAmount)} raised`}
            />
          </div>
          <p className="mt-2 text-ui leading-6 text-muted-foreground">
            {plural(raising.noteCount, "note", "notes")}
            {deadline ? ` · ${deadline}` : ""}
          </p>
        </Link>
      ) : null}
    </div>
  );
}

function TrackRecord({
  successRate,
  pastFinancing,
  completedNotes,
}: {
  successRate: number | null;
  pastFinancing: number | null;
  completedNotes: number | null;
}) {
  const parts: string[] = [];
  if (successRate != null) parts.push(`${successRate}% disbursed`);
  if (pastFinancing != null && pastFinancing > 0) {
    parts.push(`${formatMoneyDisplay(pastFinancing)} repaid`);
  }
  if (completedNotes != null && completedNotes > 0) {
    parts.push(plural(completedNotes, "note completed", "notes completed"));
  }
  if (parts.length === 0) return null;

  return (
    <div className="flex items-start gap-2 text-ui leading-6 text-muted-foreground">
      <p className="min-w-0">{parts.join(" · ")}</p>
      {successRate != null ? (
        <InfoTooltip
          content="Share of financing raises that reached disbursement."
          iconClassName="h-4 w-4"
        />
      ) : null}
    </div>
  );
}

export function WhereThingsStandCard({
  organizationId,
  className,
}: {
  organizationId?: string;
  className?: string;
}) {
  const { snapshot, overview, isLoading } = useIssuerBookSnapshot(organizationId);
  const showIncoming = snapshot.incoming.openCount > 0;
  const panels = [
    showIncoming ? "incoming" : null,
    snapshot.facilityBook ? "facility" : null,
    snapshot.invoiceBook ? "invoice" : null,
  ].filter(Boolean);
  const hasBooks = snapshot.facilityBook != null || snapshot.invoiceBook != null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
          Your financing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-0">
        {isLoading ? (
          <p className="py-4 text-body leading-7 text-muted-foreground">Loading…</p>
        ) : snapshot.isEmpty &&
          overview.activeFinancingAmount == null &&
          overview.pastFinancingAmount == null &&
          overview.successRatePercent == null ? (
          <p className="py-2 text-body leading-7 text-muted-foreground">
            No applications yet.{" "}
            <ApplyForFinancingButton
              variant="link"
              showIcon={false}
              className="inline h-auto p-0 text-ui font-medium leading-7"
            />
          </p>
        ) : (
          <>
            {panels.length > 0 ? (
              <div
                className={cn(
                  "grid grid-cols-1 gap-4",
                  panels.length === 2 && "lg:grid-cols-2",
                  panels.length >= 3 && "lg:grid-cols-3"
                )}
              >
                {showIncoming ? <IncomingPanel incoming={snapshot.incoming} /> : null}
                {snapshot.facilityBook ? <FacilityPanel book={snapshot.facilityBook} /> : null}
                {snapshot.invoiceBook ? <InvoicePanel book={snapshot.invoiceBook} /> : null}
              </div>
            ) : null}

            {snapshot.draftsOnly && !hasBooks ? (
              <p className="text-ui leading-6 text-muted-foreground">
                Facilities and invoices appear after approval.
              </p>
            ) : null}

            {!snapshot.draftsOnly || hasBooks ? (
              <MoneyInPlay
                outstanding={overview.activeFinancingAmount}
                raising={snapshot.raisingNow}
              />
            ) : null}

            <TrackRecord
              successRate={overview.successRatePercent}
              pastFinancing={overview.pastFinancingAmount}
              completedNotes={overview.completedNotesCount}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
