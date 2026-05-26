"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronRightIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import {
  useHeader,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  NoteStatusBadge,
  NOTE_STATUS_BADGE_TONE_CLASS,
  SoukscoreRiskRatingBadge,
  Progress,
  parseMoney,
} from "@cashsouk/ui";
import { InfoTooltip } from "@cashsouk/ui/info-tooltip";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useIssuerNote,
  useIssuerNotePaymentInstructions,
  useSubmitIssuerPayment,
  useViewIssuerShorakaCertificate,
} from "@/notes/hooks/use-issuer-notes";
import { LedgerPanel } from "@/notes/components/ledger-panel";
import {
  getActiveSettlementLateFees,
  getIssuerReceiptCap,
  getIssuerRemainingReceiptCapacity,
  getOpenReceiptsTotal,
  getRepaymentReceiptsBySource,
  getSettlementCapReceiptsTotal,
  noteSettlementAmountDue,
  REPAYMENT_RECEIPT_SOURCE_ORDER,
} from "@/notes/lib/repayment-capacity";
import {
  isSoukscoreRiskRating,
  mapNoteSettlementToPoolSummary,
  NotePaymentSource,
  NotePaymentStatus,
  WithdrawalStatus,
  WithdrawalType,
  type NoteDetail,
  type NoteSettlementPoolSummary,
} from "@cashsouk/types";
import { issuerMainContentClassName, issuerPageGutterClassName } from "@/lib/issuer-layout";
import { cn } from "@/lib/utils";

const MONEY_TOLERANCE = 0.005;

const RISK_TOOLTIP_TEXT = "SoukScore grade for this invoice note";

const REPAYMENT_POOL_RECEIVED_TOOLTIP =
  "Paymaster direct payments and your on-behalf confirmations (after admin records them).";

const SETTLEMENT_PAYMENT_INTRO_TOOLTIP =
  "The invoice settlement amount is the repayment cap; any Ta'widh or Gharamah is allocated from that receipt in admin settlement, not added on top. The paymaster may pay directly, or you may pay on their behalf—either way admin records receipts here. You may submit in one transfer or several; each of your submissions stays pending until admin reconciles it.";

function repaymentPayerLabel(source: NotePaymentSource, paymasterName: string | null): string {
  if (source === NotePaymentSource.PAYMASTER) {
    const name = paymasterName?.trim();
    return name && name.length > 0 ? name : "—";
  }
  if (source === NotePaymentSource.ISSUER_ON_BEHALF) {
    return "You";
  }
  return "Admin";
}

function RepaymentPoolReceivedBreakdown({
  note,
  total,
  hasPending,
  totalClassName,
}: {
  note: NoteDetail;
  total: number;
  hasPending: boolean;
  totalClassName: string;
}) {
  const bySource = getRepaymentReceiptsBySource(note);
  return (
    <>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className={totalClassName}>{formatCurrency(total)}</span>
        {hasPending ? (
          <Badge variant="outline" className={NOTE_STATUS_BADGE_TONE_CLASS.warning}>
            Pending
          </Badge>
        ) : null}
      </div>
      <div className="mt-1.5 space-y-0.5 text-xs tabular-nums">
        {REPAYMENT_RECEIPT_SOURCE_ORDER.map((source) => {
          const amount = bySource[source];
          if (amount <= MONEY_TOLERANCE) return null;
          return (
            <div key={source}>
              <span className="text-muted-foreground">
                {repaymentPayerLabel(source, note.paymasterName)}
              </span>
              <span className="text-muted-foreground"> - </span>
              <span className="text-foreground">{formatCurrency(amount)}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function isTwoDecimalMoneyInput(value: string) {
  return value === "" || /^\d*(?:\.\d{0,2})?$/.test(value);
}

function roundMoneyTwo(value: number) {
  return Math.round(value * 100) / 100;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getRiskRating(note: NoteDetail) {
  const offerDetails = asRecord(note.invoiceSnapshot?.offer_details);
  const riskRating = offerDetails?.risk_rating;
  return isSoukscoreRiskRating(riskRating) ? riskRating : "—";
}

function getFundingProgressClass(fundingStatus: NoteDetail["fundingStatus"]) {
  if (fundingStatus === "FUNDED" || fundingStatus === "FAILED") {
    return "bg-muted [&>div]:bg-black";
  }
  return "[&>div]:bg-primary";
}

function formatMaturityDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-MY") : "Not set";
}

function formatMaturityTiming(value: string | null) {
  if (!value) return "No maturity date set";
  const maturityDate = new Date(value);
  const today = new Date();
  const maturityStart = new Date(
    maturityDate.getFullYear(),
    maturityDate.getMonth(),
    maturityDate.getDate()
  );
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((maturityStart.getTime() - todayStart.getTime()) / 86_400_000);
  const absoluteDays = Math.abs(days);
  const dayLabel = `${absoluteDays} day${absoluteDays === 1 ? "" : "s"}`;

  if (days === 0) return "Due today";
  return days > 0 ? `${dayLabel} remaining` : `${dayLabel} overdue`;
}

function getLateFeeSummary(note: NoteDetail) {
  const lateFeeSettlements = note.settlements.filter((settlement) => settlement.status !== "VOID");
  const assessedTawidhAmount = lateFeeSettlements.reduce(
    (sum, settlement) => sum + settlement.tawidhAmount,
    0
  );
  const assessedGharamahAmount = lateFeeSettlements.reduce(
    (sum, settlement) => sum + settlement.gharamahAmount,
    0
  );
  const assessedAmount = assessedTawidhAmount + assessedGharamahAmount;

  return {
    assessedAmount,
    assessedTawidhAmount,
    assessedGharamahAmount,
  };
}

function getPostedSettlementSummary(note: NoteDetail): NoteSettlementPoolSummary | null {
  if (note.settlementSummary?.status === "POSTED") return note.settlementSummary;
  const settlement = note.settlements.find((item) => item.status === "POSTED") ?? null;
  return settlement ? mapNoteSettlementToPoolSummary(settlement) : null;
}

/** Residual trustee payout row on the posted settlement (excludes cancelled withdrawals). */
function getIssuerResidualDisbursementState(
  note: NoteDetail,
  settlementId: string,
  residualAmount: number
):
  | { kind: "none" }
  | { kind: "paid"; completedAt: string | null }
  | { kind: "pending"; status: WithdrawalStatus }
  | { kind: "awaiting" } {
  if (residualAmount <= MONEY_TOLERANCE) {
    return { kind: "none" };
  }

  const strictRows = note.withdrawals.filter(
    (w) =>
      w.withdrawalType === WithdrawalType.ISSUER_RESIDUAL_RETURN &&
      w.settlementId === settlementId &&
      w.status !== WithdrawalStatus.CANCELLED
  );
  const rows =
    strictRows.length > 0
      ? strictRows
      : note.withdrawals.filter(
          (w) =>
            w.withdrawalType === WithdrawalType.ISSUER_RESIDUAL_RETURN &&
            w.noteId === note.id &&
            w.status !== WithdrawalStatus.CANCELLED
        );

  const completed = rows.filter((w) => w.status === WithdrawalStatus.COMPLETED);
  const completedTotal = completed.reduce((sum, w) => sum + w.amount, 0);
  if (completed.length > 0 && Math.abs(completedTotal - residualAmount) <= MONEY_TOLERANCE) {
    const latest = completed.reduce<(typeof completed)[number] | null>((best, w) => {
      if (!w.completedAt) return best ?? w;
      if (!best?.completedAt) return w;
      return new Date(w.completedAt) > new Date(best.completedAt) ? w : best;
    }, null);
    return { kind: "paid", completedAt: latest?.completedAt ?? null };
  }

  const inFlight = rows.find((w) => w.status !== WithdrawalStatus.COMPLETED);
  if (inFlight) {
    return { kind: "pending", status: inFlight.status };
  }

  return { kind: "awaiting" };
}

function BucketPayoutCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{formatCurrency(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

export default function IssuerNoteDetailPage() {
  const params = useParams<{ id: string }>();
  const noteId = params.id;
  const { setTitle } = useHeader();
  const { data: note, isLoading, error } = useIssuerNote(noteId);
  const { data: instructions } = useIssuerNotePaymentInstructions(noteId);
  const submitPayment = useSubmitIssuerPayment(noteId);
  const viewShorakaCertificate = useViewIssuerShorakaCertificate(noteId);
  const [reference, setReference] = React.useState("");
  const [paymentAmountInput, setPaymentAmountInput] = React.useState("");
  const [paymentDialogOpen, setPaymentDialogOpen] = React.useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = React.useState(false);

  React.useEffect(() => {
    setTitle("Note Detail");
  }, [setTitle]);

  const openPaymentDialog = () => {
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!note) return;
    const settlementSummary = getPostedSettlementSummary(note);
    if (note.servicingStatus === "SETTLED" || settlementSummary?.status === "POSTED") {
      toast.info("This note has already been settled");
      return;
    }
    if (note.fundingStatus !== "FUNDED" || note.servicingStatus === "NOT_STARTED") {
      toast.info(
        "Settlement payment opens after funding is complete and admin activates servicing"
      );
      return;
    }
    const settlementDue = noteSettlementAmountDue(note);
    if (settlementDue <= 0) {
      toast.error("This note does not have an invoice settlement amount yet");
      return;
    }
    const receiptAmount = parseMoney(paymentAmountInput);
    if (!Number.isFinite(receiptAmount) || receiptAmount <= MONEY_TOLERANCE) {
      toast.error("Enter a valid payment amount greater than zero");
      return;
    }
    const openReceipts = getSettlementCapReceiptsTotal(note);
    const cap = getIssuerReceiptCap(note);
    if (openReceipts + receiptAmount > cap + MONEY_TOLERANCE) {
      toast.error(
        `This amount exceeds the remaining settlement (${formatCurrency(Math.max(0, cap - openReceipts))} left)`
      );
      return;
    }
    try {
      await submitPayment.mutateAsync({
        receiptAmount,
        receiptDate: new Date().toISOString(),
        reference: reference || null,
        metadata: { paymentPurpose: "SETTLEMENT" },
      });
      setReference("");
      setPaymentAmountInput("");
      setPaymentConfirmed(false);
      setPaymentDialogOpen(false);
      toast.success("Payment confirmation submitted for admin reconciliation");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit payment");
    }
  };

  if (isLoading) return <div className="p-4 text-muted-foreground">Loading note...</div>;
  if (error || !note) {
    return (
      <div className="p-4 text-destructive">
        {error instanceof Error ? error.message : "Note not found"}
      </div>
    );
  }
  const settlementAmount = noteSettlementAmountDue(note);
  const openReceiptsTotal = getOpenReceiptsTotal(note);
  const settlementCapReceiptsTotal = getSettlementCapReceiptsTotal(note);
  const hasPendingReceiptReview = note.payments.some(
    (payment) => payment.status === NotePaymentStatus.PENDING
  );
  const receiptCap = getIssuerReceiptCap(note);
  const remainingCapacity = getIssuerRemainingReceiptCapacity(note);
  const activeLateFeesInSettlement = getActiveSettlementLateFees(note);
  const fundingRatio = note.targetAmount > 0 ? (note.fundedAmount / note.targetAmount) * 100 : 0;
  const fundingProgress = Math.min(Math.max(fundingRatio, 0), 100);
  const progressClassName = getFundingProgressClass(note.fundingStatus);
  const instructionEntries = Object.entries(instructions ?? {});
  const lateFeeSummary = getLateFeeSummary(note);
  const maturityDateLabel = formatMaturityDate(note.maturityDate);
  const maturityTimingLabel = formatMaturityTiming(note.maturityDate);
  const settlementSummary = getPostedSettlementSummary(note);
  const issuerResidualDisbursement = settlementSummary
    ? getIssuerResidualDisbursementState(
        note,
        settlementSummary.settlementId,
        settlementSummary.issuerResidualAmount
      )
    : null;
  const issuerDisbursementWithdrawal = note.withdrawals.find(
    (w) => w.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT
  );
  const shouldShowIssuerDisbursementBreakdown =
    issuerDisbursementWithdrawal?.grossFundedAmount != null &&
    issuerDisbursementWithdrawal?.platformFeeAmount != null &&
    issuerDisbursementWithdrawal?.netIssuerDisbursement != null;
  const settlementPayoutSummaryBlurb =
    issuerResidualDisbursement?.kind === "pending"
      ? "Posted allocation below. Your residual is still being paid via the trustee; it is not complete until that payout is marked paid."
      : issuerResidualDisbursement?.kind === "awaiting"
        ? "Posted allocation below. Your residual has not been sent yet; admin will initiate the trustee withdrawal."
        : "Posted settlement allocation below.";
  const riskRating = getRiskRating(note);
  const riskRatingForBadge = riskRating === "—" ? null : riskRating;

  const invoiceSnapshotRecord = asRecord(note.invoiceSnapshot);
  const invoiceDetailsRecord = asRecord(invoiceSnapshotRecord?.details);
  const invoiceNumberRaw =
    invoiceDetailsRecord?.invoice_number ?? invoiceDetailsRecord?.number ?? null;
  const invoiceNumberLabel =
    typeof invoiceNumberRaw === "string" || typeof invoiceNumberRaw === "number"
      ? String(invoiceNumberRaw).trim()
      : "";
  const contractSnapshotRecord = asRecord(note.contractSnapshot);
  const contractDetailsRecord = asRecord(contractSnapshotRecord?.contract_details);
  const contractTitleRaw =
    contractDetailsRecord?.title ?? contractDetailsRecord?.contract_title ?? null;
  const contractTitleLabel = typeof contractTitleRaw === "string" ? contractTitleRaw.trim() : "";
  const hasSourceCrumb = Boolean(note.sourceContractId || note.sourceInvoiceId);
  const invoiceFinancingHref = invoiceNumberLabel
    ? `/financing?tab=invoices&search=${encodeURIComponent(invoiceNumberLabel)}`
    : "/financing?tab=invoices";
  const isSettled = note.servicingStatus === "SETTLED" || settlementSummary?.status === "POSTED";
  const paymentBlockedReason = isSettled
    ? "This note has been settled. Payment is closed and no further issuer payment confirmation is needed."
    : note.fundingStatus !== "FUNDED"
      ? "Payment is not available while the note is still published or funding. It opens only after funding is complete."
      : note.servicingStatus === "NOT_STARTED"
        ? "Payment opens after admin activates the funded note for servicing."
        : null;
  const noReceiptCapacityReason =
    !paymentBlockedReason && settlementAmount > 0 && remainingCapacity <= MONEY_TOLERANCE
      ? "Remaining settlement is fully covered by existing or pending receipts. Further payments require admin review of pending submissions or an updated settlement from admin."
      : null;
  const paymentAmountParsed = parseMoney(paymentAmountInput);
  const paymentAmountAcceptable =
    Number.isFinite(paymentAmountParsed) &&
    paymentAmountParsed > MONEY_TOLERANCE &&
    settlementCapReceiptsTotal + paymentAmountParsed <= receiptCap + MONEY_TOLERANCE;

  return (
    <div className={issuerMainContentClassName}>
      <div className={cn("mx-auto w-full max-w-6xl space-y-6", issuerPageGutterClassName)}>
        {hasSourceCrumb ? (
          <nav
            aria-label="Source"
            className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link
              href="/financing"
              className="font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Financing
            </Link>
            {note.sourceContractId ? (
              <>
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <Link
                  href={`/financing/contracts/${note.sourceContractId}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {contractTitleLabel ? `Contract: ${contractTitleLabel}` : "Contract"}
                </Link>
              </>
            ) : null}
            {note.sourceInvoiceId ? (
              <>
                <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {note.sourceContractId ? (
                  <span className="font-medium text-muted-foreground">
                    {invoiceNumberLabel ? `Invoice: ${invoiceNumberLabel}` : "Invoice"}
                  </span>
                ) : (
                  <Link
                    href={invoiceFinancingHref}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {invoiceNumberLabel ? `Invoice: ${invoiceNumberLabel}` : "Invoice"}
                  </Link>
                )}
              </>
            ) : null}
            <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="font-medium text-foreground">Note</span>
          </nav>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <DocumentTextIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Note Detail
              </div>
              <h1 className="truncate text-2xl font-semibold">{note.title}</h1>
              <p className="mt-1 text-muted-foreground">{note.noteReference}</p>
            </div>
          </div>
          <NoteStatusBadge
            note={note}
            className="max-w-[48%] shrink-0 self-start text-xs font-semibold"
          />
        </div>

        <Card className="rounded-2xl">
          <CardContent className="space-y-5 p-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <div className="text-xs text-muted-foreground">Invoice Amount</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(settlementAmount)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Target Amount</div>
                <div className="mt-1 text-xl font-semibold">
                  {formatCurrency(note.targetAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Funded Amount</div>
                <div className="mt-1 text-xl font-semibold">
                  {formatCurrency(note.fundedAmount)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Funding Ratio</div>
                <div className="mt-1 text-xl font-semibold">{fundingRatio.toFixed(1)}%</div>
              </div>
              <div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>Risk rating</span>
                  <InfoTooltip content={RISK_TOOLTIP_TEXT} iconClassName="h-3.5 w-3.5 shrink-0" />
                </div>
                <div className="mt-2 rounded-2xl border bg-muted/20 p-2 md:p-3">
                  <SoukscoreRiskRatingBadge
                    riskRating={riskRatingForBadge}
                    className={cn(
                      "flex w-full items-center justify-center rounded-xl px-2 py-2",
                      "text-2xl font-semibold leading-none tracking-tight md:text-3xl"
                    )}
                  />
                </div>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Funding progress</span>
                <span>{fundingRatio.toFixed(1)}%</span>
              </div>
              <Progress value={fundingProgress} className={`h-3 ${progressClassName}`} />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{note.fundingStatus.replace(/_/g, " ")}</span>
                <span>100%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-0 gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              <CardTitle className="text-xl sm:text-2xl">Settlement Payment</CardTitle>
              <InfoTooltip
                content={SETTLEMENT_PAYMENT_INTRO_TOOLTIP}
                iconClassName="h-4 w-4 shrink-0 text-muted-foreground"
              />
            </div>
            <Button
              className="w-full shrink-0 sm:w-auto"
              onClick={openPaymentDialog}
              disabled={
                settlementAmount <= 0 ||
                paymentBlockedReason != null ||
                noReceiptCapacityReason != null
              }
            >
              {isSettled ? "Payment Settled" : "Make Payment"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border bg-muted p-4 sm:p-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <div className="text-sm text-muted-foreground">Invoice settlement</div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {formatCurrency(settlementAmount)}
                  </div>
                </div>
                {activeLateFeesInSettlement > MONEY_TOLERANCE ? (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      Late fees (in admin settlement)
                    </div>
                    <div className="mt-1 text-2xl font-semibold text-foreground">
                      {formatCurrency(activeLateFeesInSettlement)}
                    </div>
                  </div>
                ) : null}
                <div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>Repayment pool received</span>
                    <InfoTooltip
                      content={REPAYMENT_POOL_RECEIVED_TOOLTIP}
                      iconClassName="h-3.5 w-3.5 shrink-0"
                    />
                  </div>
                  <RepaymentPoolReceivedBreakdown
                    note={note}
                    total={openReceiptsTotal}
                    hasPending={hasPendingReceiptReview}
                    totalClassName="text-2xl font-semibold text-foreground"
                  />
                </div>
                <div
                  className={cn(
                    "min-w-0",
                    activeLateFeesInSettlement > MONEY_TOLERANCE && "lg:col-start-3 lg:row-start-2"
                  )}
                >
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <span>Maturity</span>
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-foreground">
                    {maturityDateLabel}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{maturityTimingLabel}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Open the payment instructions, transfer the amount you are confirming on behalf of
              the paymaster, then submit the reference for admin reconciliation.
            </p>
            {paymentBlockedReason ? (
              <div
                className={`rounded-xl border p-4 text-sm ${
                  isSettled
                    ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                    : "border-amber-200 bg-amber-50 text-amber-950"
                }`}
              >
                {paymentBlockedReason}
              </div>
            ) : null}
            {noReceiptCapacityReason ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                {noReceiptCapacityReason}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {shouldShowIssuerDisbursementBreakdown ? (
            <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Disbursement breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Gross funded</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCurrency(issuerDisbursementWithdrawal.grossFundedAmount!)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Platform fee</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">
                  {formatCurrency(issuerDisbursementWithdrawal.platformFeeAmount!)}
                </span>
              </div>
              {issuerDisbursementWithdrawal.facilityFeeCharged != null ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-muted-foreground">Facility fee</span>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(issuerDisbursementWithdrawal.facilityFeeCharged)}
                  </span>
                </div>
              ) : null}
              <div className="flex items-center justify-between gap-4 pt-1">
                <span className="text-sm text-muted-foreground">Net to issuer</span>
                <span className="text-sm font-semibold text-primary tabular-nums">
                  {formatCurrency(issuerDisbursementWithdrawal.netIssuerDisbursement!)}
                </span>
              </div>

              {issuerDisbursementWithdrawal?.status === "COMPLETED" &&
              issuerDisbursementWithdrawal?.hasShorakaCertificate ? (
                <div className="rounded-lg border bg-card p-4">
                  <div className="text-sm font-medium">Tawarruq Certificate</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Certificate fetched and stored for this financing.
                  </div>
                  <div className="mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={async () => {
                        try {
                          const result = await viewShorakaCertificate.mutateAsync();
                          if (result.viewUrl) window.open(result.viewUrl, "_blank", "noopener,noreferrer");
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : "Failed to open certificate");
                        }
                      }}
                      disabled={viewShorakaCertificate.isPending}
                    >
                      View Tawarruq Certificate
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {settlementSummary ? (
          <Card>
            <CardHeader>
              <CardTitle>Settlement Payout Summary</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">{settlementPayoutSummaryBlurb}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <BucketPayoutCard
                  label="Total received"
                  value={settlementSummary.grossReceiptAmount}
                  description="Gross receipt recorded for this note."
                />
                <BucketPayoutCard
                  label="Investors"
                  value={settlementSummary.investorPoolAmount}
                  description="Principal, net profit, and any investor Ta'widh compensation."
                />
                <BucketPayoutCard
                  label="Platform fee"
                  value={settlementSummary.operatingAccountAmount}
                  description="Service fee retained by the platform."
                />
                <BucketPayoutCard
                  label="Ta'widh"
                  value={settlementSummary.tawidhAccountAmount}
                  description={`${formatCurrency(settlementSummary.totalTawidhAmount)} total Ta'widh; ${formatCurrency(settlementSummary.tawidhInvestorAmount)} allocated to investors.`}
                />
                <BucketPayoutCard
                  label="Gharamah"
                  value={settlementSummary.gharamahAccountAmount}
                  description="Approved charity/penalty late-fee allocation."
                />
              </div>
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-start sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Issuer residual:</span>{" "}
                  {formatCurrency(settlementSummary.issuerResidualAmount)} is the residual refund
                  after investor allocation, service fee, full Ta&apos;widh, and Gharamah.
                  Contractual profit is locked for {settlementSummary.profitDays} days at{" "}
                  {settlementSummary.annualProfitRatePercent}% p.a. through note maturity.
                  {issuerResidualDisbursement?.kind === "paid" &&
                  issuerResidualDisbursement.completedAt ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Paid out{" "}
                      {new Date(issuerResidualDisbursement.completedAt).toLocaleString("en-MY", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                      .
                    </span>
                  ) : null}
                </p>
                {issuerResidualDisbursement?.kind === "paid" ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit shrink-0 text-xs font-semibold",
                      NOTE_STATUS_BADGE_TONE_CLASS.success
                    )}
                  >
                    Paid
                  </Badge>
                ) : issuerResidualDisbursement?.kind === "pending" ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit shrink-0 text-xs font-semibold",
                      NOTE_STATUS_BADGE_TONE_CLASS.warning
                    )}
                  >
                    {issuerResidualDisbursement.status === WithdrawalStatus.SUBMITTED_TO_TRUSTEE
                      ? "Payout with trustee"
                      : "Payout in progress"}
                  </Badge>
                ) : issuerResidualDisbursement?.kind === "awaiting" ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "w-fit shrink-0 text-xs font-semibold",
                      NOTE_STATUS_BADGE_TONE_CLASS.neutral
                    )}
                  >
                    Awaiting disbursement
                  </Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {lateFeeSummary.assessedAmount > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Late Fee Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border bg-amber-50 p-5 text-amber-950">
                <div className="text-sm text-amber-800">Assessed late fees</div>
                <div className="mt-1 text-3xl font-semibold">
                  {formatCurrency(lateFeeSummary.assessedAmount)}
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                  <div>
                    <div className="text-amber-800">{"Ta'widh"}</div>
                    <div className="font-semibold">
                      {formatCurrency(lateFeeSummary.assessedTawidhAmount)}
                    </div>
                  </div>
                  <div>
                    <div className="text-amber-800">Gharamah</div>
                    <div className="font-semibold">
                      {formatCurrency(lateFeeSummary.assessedGharamahAmount)}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Late fees are borne by the issuer, but the issuer does not make a separate late-fee
                payment here. Admin deducts approved {"Ta'widh"} and Gharamah from the repayment
                pool before returning any residual balance to the issuer. If admin allocates part of
                Ta&apos;widh to investors, the total Ta&apos;widh charge remains the same for
                residual calculation.
              </p>
            </CardContent>
          </Card>
        ) : null}

        <LedgerPanel
          note={note}
          description="Posted note activity. Trustee and bank transfer details are shown only when available."
        />
      </div>

      <Dialog
        open={paymentDialogOpen}
        onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (open && note) {
            const remaining = getIssuerRemainingReceiptCapacity(note);
            setPaymentAmountInput(
              remaining > MONEY_TOLERANCE ? roundMoneyTwo(remaining).toFixed(2) : ""
            );
            setPaymentConfirmed(false);
          } else if (!open) {
            setPaymentConfirmed(false);
          }
        }}
      >
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm repayment (on behalf of paymaster)</DialogTitle>
            <DialogDescription className="text-[15px] leading-7">
              Use the instructions below to make the repayment transfer. Submit this confirmation
              only after the transfer for the amount you enter has been made. Admin will reconcile
              before settlement is posted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-muted p-5 space-y-3">
              <div className="space-y-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <span>Repayments received</span>
                      <InfoTooltip
                        content={REPAYMENT_POOL_RECEIVED_TOOLTIP}
                        iconClassName="h-3.5 w-3.5 shrink-0"
                      />
                    </div>
                    <RepaymentPoolReceivedBreakdown
                      note={note}
                      total={openReceiptsTotal}
                      hasPending={hasPendingReceiptReview}
                      totalClassName="text-lg font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Remaining settlement</div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                      {formatCurrency(remainingCapacity)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <label className="text-sm font-medium" htmlFor="issuer-payment-amount">
                    Amount you are confirming
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={remainingCapacity <= MONEY_TOLERANCE}
                    onClick={() =>
                      setPaymentAmountInput(roundMoneyTwo(remainingCapacity).toFixed(2))
                    }
                  >
                    Use full remaining settlement
                  </Button>
                </div>
                <Input
                  id="issuer-payment-amount"
                  inputMode="decimal"
                  value={paymentAmountInput}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (isTwoDecimalMoneyInput(next)) setPaymentAmountInput(next);
                  }}
                  onBlur={() => {
                    const v = parseMoney(paymentAmountInput);
                    if (Number.isFinite(v) && v > 0) {
                      setPaymentAmountInput(roundMoneyTwo(v).toFixed(2));
                    }
                  }}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Must be greater than zero and must not exceed the remaining settlement shown
                  above, including amounts already pending or received.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border p-4">
              <div className="mb-3 font-semibold">Repayment Instructions</div>
              {instructionEntries.length ? (
                <div className="grid gap-3 text-sm md:grid-cols-2">
                  {instructionEntries.map(([key, value]) => (
                    <div key={key}>
                      <div className="text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</div>
                      <div className="font-medium">{String(value)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Repayment instructions are not available yet. Contact support before making
                  payment.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="payment-reference">
                Payment reference
              </label>
              <Input
                id="payment-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Bank transfer reference or receipt number"
              />
            </div>

            <label className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
              <Checkbox
                checked={paymentConfirmed}
                onCheckedChange={(checked) => setPaymentConfirmed(checked === true)}
                className="mt-1"
              />
              <span>
                I confirm that I have transferred the amount entered above to the repayment account
                and understand that admin will reconcile the receipt before settlement is posted.
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                setPaymentDialogOpen(false);
                setPaymentConfirmed(false);
              }}
              disabled={submitPayment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleSubmitPayment}
              disabled={
                !paymentConfirmed ||
                !paymentAmountAcceptable ||
                submitPayment.isPending ||
                settlementAmount <= 0 ||
                paymentBlockedReason != null ||
                noReceiptCapacityReason != null
              }
            >
              {submitPayment.isPending ? "Submitting..." : "Submit Payment Confirmation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
