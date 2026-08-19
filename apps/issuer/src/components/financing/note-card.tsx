"use client";

import Link from "next/link";
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  LinkIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteListItem } from "@cashsouk/types";
import { NoteStatusBadge } from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import { issuerSettlementPayoutSummaryFromResidualStatus } from "@/notes/lib/settlement-payout-summary-presenter";
import { cn } from "@/lib/utils";
import { FinancingDonut, financingDonutTone } from "./financing-donut";
import { FinancingKpiTile } from "./financing-kpi-strip";
import {
  EM_DASH,
  FINANCING_ARREARS_SURFACE,
  FINANCING_ATTENTION_SURFACE,
  LabelValue,
  displayCell,
  formatDate,
  formatMoney,
} from "./utils";
import {
  isIssuerNoteActionable,
  isIssuerNoteInArrears,
} from "@/lib/issuer-financing-actionable";

function daysPastMaturity(maturityDate: string | null | undefined): number | null {
  if (!maturityDate) return null;
  const maturity = new Date(maturityDate);
  if (Number.isNaN(maturity.getTime())) return null;
  const today = new Date();
  const maturityStart = new Date(
    maturity.getFullYear(),
    maturity.getMonth(),
    maturity.getDate()
  );
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((todayStart.getTime() - maturityStart.getTime()) / 86_400_000);
  return days > 0 ? days : null;
}

function NoteArrearsAlert({ note }: { note: NoteListItem }) {
  const overdueDays = daysPastMaturity(note.maturityDate);
  const overdueClause =
    overdueDays != null
      ? ` Maturity was ${overdueDays} day${overdueDays === 1 ? "" : "s"} ago.`
      : "";

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-status-rejected-text/30 bg-status-rejected-bg px-3 py-3 text-status-rejected-text"
    >
      <ExclamationTriangleIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="min-w-0 space-y-1">
        <p className="text-ui font-semibold leading-6">This invoice is in arrears</p>
        <p className="text-ui leading-5 opacity-90">
          Payment was not received by the due date.{overdueClause} Arrange payment with your
          customer and upload proof.
        </p>
      </div>
    </div>
  );
}

const RISK_TOOLTIP_TEXT = "Risk grade for this invoice";

function riskLetterToneClass(grade: string | null): string {
  if (grade === "A" || grade === "B") return "text-status-success-text";
  if (grade === "C") return "text-status-submitted-text";
  if (grade === "D") return "text-status-action-text";
  if (grade === "E" || grade === "F") return "text-status-rejected-text";
  return "text-foreground";
}

function SettlementSummaryBlock({ note }: { note: NoteListItem }) {
  if (!note.settlementSummary) return null;

  const preset = note.issuerResidualPayout
    ? issuerSettlementPayoutSummaryFromResidualStatus(note.issuerResidualPayout)
    : {
        tone: "emerald" as const,
        blurb: "Posted settlement allocation below.",
      };
  const isAmber = preset.tone === "amber";
  const labelMuted = isAmber
    ? "text-amber-800 dark:text-amber-200/90"
    : "text-emerald-800 dark:text-emerald-200/90";

  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        isAmber
          ? "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100"
          : "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/35 dark:text-emerald-100"
      )}
    >
      <p className="text-xs leading-relaxed opacity-90">{preset.blurb}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div>
          <div className={labelMuted}>Total received</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.grossReceiptAmount)}
          </div>
        </div>
        <div>
          <div className={labelMuted}>Investors</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.investorPoolAmount)}
          </div>
        </div>
        <div>
          <div className={labelMuted}>Platform fee</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.operatingAccountAmount)}
          </div>
        </div>
        <div>
          <div className={labelMuted}>{"Ta'widh"}</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.tawidhAccountAmount)}
          </div>
        </div>
        <div>
          <div className={labelMuted}>Gharamah</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.gharamahAccountAmount)}
          </div>
        </div>
        <div>
          <div className={labelMuted}>Issuer residual</div>
          <div className="font-semibold tabular-nums">
            {formatCurrency(note.settlementSummary.issuerResidualAmount)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardNoteCard({ note }: { note: NoteListItem }) {
  const progress = Math.max(0, Math.min(100, note.fundingPercent));
  const noteRef = displayCell(note.noteReference);
  const grade = note.riskRating?.trim() ? note.riskRating.trim().toUpperCase() : null;
  const donutTone = financingDonutTone(note);
  const inArrears = isIssuerNoteInArrears(note);
  const needsAttention = isIssuerNoteActionable(note);

  return (
    <article
      className={cn(
        "min-w-0 max-w-full rounded-2xl border p-4 shadow-sm md:p-5",
        inArrears
          ? FINANCING_ARREARS_SURFACE
          : needsAttention
            ? FINANCING_ATTENTION_SURFACE
            : "border-border bg-card"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <DocumentTextIcon
              className={cn(
                "h-5 w-5 shrink-0",
                inArrears ? "text-status-rejected-text" : "text-muted-foreground"
              )}
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
              <p className="min-w-0 max-w-full truncate leading-5">
                <span className="text-sm font-normal leading-5 text-foreground">Invoice: </span>
                <Link
                  href={`/financing/notes/${note.id}`}
                  className="text-sm font-semibold leading-5 text-foreground underline-offset-4 hover:underline"
                >
                  {noteRef !== EM_DASH ? noteRef : displayCell(note.title)}
                </Link>
              </p>
              <NoteStatusBadge note={note} className="shrink-0" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant={inArrears ? "default" : "outline"}
              className="rounded-xl"
              asChild
            >
              <Link href={`/financing/notes/${note.id}`}>
                {inArrears ? "Report repayment" : "View details"}
              </Link>
            </Button>
          </div>
        </div>

        {inArrears ? <NoteArrearsAlert note={note} /> : null}

        <p className="truncate text-ui leading-6 text-muted-foreground">{note.title}</p>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
          <div className="flex shrink-0 items-center justify-center sm:w-[11rem] sm:justify-start">
            <FinancingDonut
              size="lg"
              centerLabel="Funded"
              percent={progress}
              tone={donutTone}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <FinancingKpiTile label="Funded" value={formatMoney(note.fundedAmount)} />
              <FinancingKpiTile label="Target" value={formatMoney(note.targetAmount)} />
              <FinancingKpiTile
                label="Risk"
                labelExtra={
                  <InfoTooltip
                    content={RISK_TOOLTIP_TEXT}
                    iconClassName="h-3.5 w-3.5 shrink-0"
                  />
                }
                value={grade ?? EM_DASH}
                valueClassName={riskLetterToneClass(grade)}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-x-6 gap-y-2 md:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <LabelValue label="Paymaster">{displayCell(note.paymasterName)}</LabelValue>
                <LabelValue label="Product">
                  {displayCell(note.productName ?? note.productCategory)}
                </LabelValue>
                {note.sourceInvoiceId ? (
                  <p className="text-ui leading-7 text-foreground">
                    <span className="font-normal text-muted-foreground">Invoice: </span>
                    <Link
                      href={`/financing/invoices/${note.sourceInvoiceId}`}
                      className="inline-flex min-w-0 max-w-full items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
                    >
                      <span className="min-w-0 truncate">View invoice</span>
                      <LinkIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    </Link>
                  </p>
                ) : null}
                {note.sourceApplicationId ? (
                  <p className="text-ui leading-7 text-foreground">
                    <span className="font-normal text-muted-foreground">Application: </span>
                    <Link
                      href={`/applications/${note.sourceApplicationId}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      View application
                    </Link>
                  </p>
                ) : null}
              </div>
              <div className="min-w-0 space-y-2">
                <LabelValue label="Maturity date">{formatDate(note.maturityDate)}</LabelValue>
              </div>
            </div>
          </div>
        </div>

        <SettlementSummaryBlock note={note} />
      </div>
    </article>
  );
}
