"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  DocumentTextIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { parseMoney } from "@cashsouk/ui";
import type {
  NoteDetail,
  NotePayment,
  NotePaymentSource,
  NoteSettlementPreviewResult,
  OverdueLateChargeResult,
  ServiceFeeTrusteeInstructionStatus,
} from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import {
  useApproveNotePayment,
  useApproveNoteSettlement,
  useCheckOverdueLateCharge,
  useGenerateArrearsLetter,
  useGenerateDefaultLetter,
  useMarkNoteDefault,
  usePostNoteSettlement,
  usePreviewNoteSettlement,
  useRecordNotePayment,
  useRejectNotePayment,
  useGenerateServiceFeeTrusteeLetter,
  useMarkServiceFeeTrusteeLetterSubmitted,
  useMarkServiceFeeTrusteeInstructionCompleted,
} from "../hooks/use-notes";
import { cn } from "@/lib/utils";

type RecordPaymentSource = "PAYMASTER" | "ISSUER_ON_BEHALF";
type OverdueFeeInputMode = "AMOUNT" | "PERCENTAGE";

const ACTION_CARD_CLASS =
  "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]";
const SECTION_COMPLETE_CLASS = "border-emerald-200 bg-emerald-50/40";
const SECTION_COMPLETE_HEADER_CLASS =
  "mb-2 text-xs font-medium uppercase tracking-wider text-emerald-900";
const OPEN_PAYMENT_STATUSES = ["PENDING", "PARTIAL", "RECEIVED", "RECONCILED"];

function serviceFeeTrusteeStatusLabel(status: ServiceFeeTrusteeInstructionStatus | null) {
  if (status === "PENDING_LETTER") return "Awaiting PDF";
  if (status === "LETTER_GENERATED") return "Letter generated — submit to trustee";
  if (status === "SUBMITTED_TO_TRUSTEE") return "Submitted — confirm complete";
  if (status === "COMPLETED") return "Complete";
  return "Awaiting PDF";
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function sourceLabel(source: NotePaymentSource) {
  const labels: Record<NotePaymentSource, string> = {
    PAYMASTER: "Paymaster",
    ISSUER_ON_BEHALF: "Issuer reported",
    ADMIN_ADJUSTMENT: "Admin adjustment",
  };
  return labels[source] ?? source;
}

function statusVariant(status: string) {
  if (status === "PENDING") return "secondary" as const;
  if (status === "VOID") return "destructive" as const;
  return "outline" as const;
}

function MoneyMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{formatCurrency(value)}</div>
    </div>
  );
}

function PoolSummaryCard({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{formatCurrency(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </div>
  );
}

function getSettlementAmount(note: NoteDetail) {
  const extended = note as NoteDetail & { settlementAmount?: number; invoiceAmount?: number };
  return extended.settlementAmount ?? extended.invoiceAmount ?? note.requestedAmount;
}

function settlementIsComplete(grossReceiptAmount: number, settlementAmount: number) {
  return settlementAmount > 0 && grossReceiptAmount + 0.005 >= settlementAmount;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function beneficiaryFieldsFromSnapshot(snapshot: Record<string, unknown> | null | undefined) {
  const src = snapshot ?? {};
  return {
    accountHolder: asString(src.account_holder ?? src.accountHolder ?? src.beneficiary_name),
    bankName: asString(src.bank_name ?? src.bankName),
    accountNumber: asString(src.account_number ?? src.accountNumber),
  };
}

function hasSettlementTrusteeMovement(input: {
  investorPoolAmount: number;
  operatingAccountAmount: number;
  tawidhAccountAmount: number;
  gharamahAmount: number;
  issuerResidualAmount: number;
}) {
  return (
    input.investorPoolAmount > 0.005 ||
    input.operatingAccountAmount > 0.005 ||
    input.tawidhAccountAmount > 0.005 ||
    input.gharamahAmount > 0.005 ||
    input.issuerResidualAmount > 0.005
  );
}

function roundToTwoDecimals(value: number) {
  return Math.round(value * 100) / 100;
}

function calculatePercentAmount(baseAmount: number, percent: number) {
  const baseCents = Math.round(baseAmount * 100);
  const basisPoints = Math.round(percent * 100);
  return Math.round((baseCents * basisPoints) / 10_000) / 100;
}

function formatPercentInput(value: number) {
  return roundToTwoDecimals(value).toFixed(2);
}

function formatAmountInput(value: number) {
  return roundToTwoDecimals(value).toFixed(2);
}

function isTwoDecimalInput(value: string) {
  return value === "" || /^\d*(?:\.\d{0,2})?$/.test(value);
}

function calculatePercentFromAmount(amount: number, baseAmount: number) {
  if (baseAmount <= 0) return 0;
  return roundToTwoDecimals((amount / baseAmount) * 100);
}

function getPaymentMetadata(payment: NotePayment) {
  const extended = payment as NotePayment & { metadata?: Record<string, unknown> | null };
  return extended.metadata;
}

function getPaymentEvidenceFiles(payment: NotePayment) {
  const extended = payment as NotePayment & {
    evidenceFiles?: Array<{
      s3Key: string;
      fileName: string;
      contentType: string;
      fileSize: number;
      uploadedAt: string;
    }> | null;
  };
  return Array.isArray(extended.evidenceFiles) ? extended.evidenceFiles : [];
}

function PaymentAdviceProofCompact({
  files,
  onView,
  onDownload,
  viewPending,
}: {
  files: Array<{ s3Key: string; fileName: string }>;
  onView: (s3Key: string) => void;
  onDownload: (s3Key: string, fileName?: string) => void;
  viewPending: boolean;
}) {
  if (files.length === 0) return null;

  const primary = files[0];
  const extraCount = files.length - 1;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Payment advice
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1">
        <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="max-w-[12rem] truncate text-xs text-foreground">
          {primary.fileName || "Payment advice"}
        </span>
        {extraCount > 0 ? (
          <span className="text-xs text-muted-foreground">+{extraCount} more</span>
        ) : null}
        <div className="ml-auto flex shrink-0 gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-md px-2 text-xs"
            onClick={() => onView(primary.s3Key)}
            disabled={viewPending}
          >
            <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
            View
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1 rounded-md px-2 text-xs"
            onClick={() => onDownload(primary.s3Key, primary.fileName || "payment-advice")}
            disabled={viewPending}
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5" />
            Download
          </Button>
        </div>
      </div>
    </div>
  );
}

function getSettlementValue(settlement: Record<string, unknown>, key: string) {
  const value = settlement[key];
  if (typeof value === "string" || typeof value === "number" || value == null) {
    return parseMoney(value);
  }
  return 0;
}

function resolvePaymentDueDate(note: NoteDetail) {
  const schedules = [...(note.paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  return schedules[0]?.dueDate ?? note.maturityDate;
}

function resolveProfitMaturityDate(note: NoteDetail) {
  const schedules = [...(note.paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  return note.maturityDate ?? schedules.at(-1)?.dueDate ?? null;
}

function utcStartOfDayMs(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function calculateCalendarDayCount(startDate: Date, endDate: Date) {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((utcStartOfDayMs(endDate) - utcStartOfDayMs(startDate)) / 86_400_000)
  );
}

function getOverdueSnapshot(note: NoteDetail) {
  const dueDateValue = resolvePaymentDueDate(note);
  if (!dueDateValue) {
    return { daysPastMaturity: 0, daysOverdue: 0, label: "No payment due date set" };
  }
  const dueDate = new Date(dueDateValue);
  const today = new Date();
  const daysPastMaturity = calculateCalendarDayCount(dueDate, today);
  const daysOverdue = Math.max(0, daysPastMaturity - note.gracePeriodDays);
  const label =
    daysOverdue > 0
      ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`
      : daysPastMaturity > 0
        ? `Within grace period (${Math.max(0, note.gracePeriodDays - daysPastMaturity)} days left)`
        : "Not overdue";
  return { daysPastMaturity, daysOverdue, label };
}

function readHeadroomFromPreviewSnapshot(snapshot: Record<string, unknown> | undefined) {
  const value = snapshot?.availableLateFeeHeadroomAmount;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function estimateLateFeeHeadroom(note: NoteDetail, settlementAmount: number) {
  if (!note.activatedAt || !note.profitRatePercent || settlementAmount <= 0) return null;
  const profitMaturityDate = resolveProfitMaturityDate(note);
  if (!profitMaturityDate) return null;
  const profitDays = calculateCalendarDayCount(new Date(note.activatedAt), new Date(profitMaturityDate));
  const investorProfitGross =
    note.fundedAmount * (note.profitRatePercent / 100) * (profitDays / 365);
  return Math.max(0, settlementAmount - note.fundedAmount - investorProfitGross);
}

function resolvePanelLateFeeHeadroom(input: {
  preview: NoteSettlementPreviewResult | null;
  lateChargeResult: OverdueLateChargeResult | null;
  previewSnapshot?: Record<string, unknown>;
  note: NoteDetail;
  settlementAmount: number;
}) {
  if (input.preview != null && typeof input.preview.availableLateFeeHeadroomAmount === "number") {
    return input.preview.availableLateFeeHeadroomAmount;
  }
  if (
    input.lateChargeResult != null &&
    typeof input.lateChargeResult.availableLateFeeHeadroomAmount === "number"
  ) {
    return input.lateChargeResult.availableLateFeeHeadroomAmount;
  }
  const fromSnapshot = readHeadroomFromPreviewSnapshot(input.previewSnapshot);
  if (fromSnapshot != null) return fromSnapshot;
  return estimateLateFeeHeadroom(input.note, input.settlementAmount);
}

function settlementLateFeeTotal(settlement: { tawidhAmount: number; gharamahAmount: number }) {
  return settlement.tawidhAmount + settlement.gharamahAmount;
}

function getLateFeeLedgerSummary(note: NoteDetail) {
  let postedToLedger = 0;
  let approvedNotPosted = 0;

  for (const settlement of note.settlements) {
    if (settlement.status === "VOID") continue;
    const total = settlementLateFeeTotal(settlement);
    if (settlement.status === "POSTED") postedToLedger += total;
    else if (settlement.status === "APPROVED") approvedNotPosted += total;
  }

  const issuerLateFeePaymentsSubmitted = note.payments
    .filter((payment) => {
      const metadata = getPaymentMetadata(payment);
      return (
        payment.source === "ISSUER_ON_BEHALF" &&
        metadata?.paymentPurpose === "LATE_FEES" &&
        payment.status !== "VOID"
      );
    })
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);

  return { postedToLedger, approvedNotPosted, issuerLateFeePaymentsSubmitted };
}

function formatMaturityDate(value: string | null) {
  return value ? format(new Date(value), "dd MMM yyyy") : "Not set";
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

export function SettlementPanel({ note }: { note: NoteDetail }) {
  const { can } = usePermissions();
  const canRepayment = can("notes.repayment.manage");
  const canSettlement = can("notes.settlement.manage");
  const canDisbursement = can("notes.disbursement.manage");
  const canDefault = can("notes.default.manage");
  const [receiptAmount, setReceiptAmount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [recordPaymentSource, setRecordPaymentSource] =
    React.useState<RecordPaymentSource>("PAYMASTER");
  const [tawidhAmount, setTawidhAmount] = React.useState("0");
  const [tawidhInvestorSharePercentInput, setTawidhInvestorSharePercentInput] =
    React.useState("0.00");
  const [gharamahAmount, setGharamahAmount] = React.useState("0");
  const [overdueFeeInputMode, setOverdueFeeInputMode] =
    React.useState<OverdueFeeInputMode>("AMOUNT");
  const [overdueTawidhInput, setOverdueTawidhInput] = React.useState("0");
  const [overdueGharamahInput, setOverdueGharamahInput] = React.useState("0");
  const [overdueTawidhPercentInput, setOverdueTawidhPercentInput] = React.useState("0.00");
  const [overdueGharamahPercentInput, setOverdueGharamahPercentInput] = React.useState("0.00");
  const [rejectionReasons, setRejectionReasons] = React.useState<Record<string, string>>({});
  const [rejectingPaymentId, setRejectingPaymentId] = React.useState<string | null>(null);
  const [serviceFeeTrusteeConfirm, setServiceFeeTrusteeConfirm] = React.useState<
    "submit" | "complete" | null
  >(null);
  const [defaultReason, setDefaultReason] = React.useState("");
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = React.useState(false);
  const [overdueFeeDialogOpen, setOverdueFeeDialogOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<NoteSettlementPreviewResult | null>(null);
  const syncedPreviewIdRef = React.useRef<string | null>(null);
  const [lateChargeResult, setLateChargeResult] = React.useState<OverdueLateChargeResult | null>(
    null
  );
  const [settlementConfirm, setSettlementConfirm] = React.useState<"approve" | "post" | null>(null);
  const recordPayment = useRecordNotePayment();
  const approvePayment = useApproveNotePayment();
  const rejectPayment = useRejectNotePayment();
  const checkOverdueLateCharge = useCheckOverdueLateCharge();
  const previewSettlement = usePreviewNoteSettlement();
  const approveSettlement = useApproveNoteSettlement();
  const postSettlement = usePostNoteSettlement();
  const arrearsLetter = useGenerateArrearsLetter();
  const defaultLetter = useGenerateDefaultLetter();
  const generateServiceFeeTrusteeLetter = useGenerateServiceFeeTrusteeLetter();
  const markServiceFeeTrusteeSubmitted = useMarkServiceFeeTrusteeLetterSubmitted();
  const markServiceFeeTrusteeCompleted = useMarkServiceFeeTrusteeInstructionCompleted();
  const markDefault = useMarkNoteDefault();
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();

  const settlementAmount = getSettlementAmount(note);
  const localPreviewSettlement = preview
    ? {
        ...preview,
        id: preview.settlementId,
        status: "PREVIEW" as const,
      }
    : null;
  const persistedPreviewSettlement =
    note.settlements.find((settlement) => settlement.status === "PREVIEW") ?? null;
  const persistedApprovedSettlement =
    note.settlements.find((settlement) => settlement.status === "APPROVED") ?? null;
  const persistedPostedSettlement =
    note.settlements.find((settlement) => settlement.status === "POSTED") ?? null;
  const persistedPostedSettlementId = persistedPostedSettlement?.id ?? null;
  const settlementLocked = persistedPostedSettlement ?? persistedApprovedSettlement;
  const baseServicingOpen =
    note.fundingStatus === "FUNDED" && note.servicingStatus !== "NOT_STARTED";
  const servicingOpen = baseServicingOpen && !persistedPostedSettlement;
  const servicingBlockedReason = !baseServicingOpen
    ? note.fundingStatus !== "FUNDED"
      ? "Payment and settlement open only after the note reaches the funding threshold and funding is closed as funded."
      : "Payment and settlement open only after admin activates the funded note for servicing."
    : null;
  const previewSettlementCandidate = settlementLocked
    ? null
    : (localPreviewSettlement ?? persistedPreviewSettlement);
  const postSettlementCandidate = persistedApprovedSettlement;
  const approveSettlementId = previewSettlementCandidate?.id ?? null;
  const postSettlementId = postSettlementCandidate?.id ?? null;
  const activeSettlementGrossReceiptAmount =
    previewSettlementCandidate?.grossReceiptAmount ??
    postSettlementCandidate?.grossReceiptAmount ??
    persistedPostedSettlement?.grossReceiptAmount ??
    0;
  const previewSettlementRequiredAmount = settlementAmount;
  const postSettlementRequiredAmount = settlementAmount;
  const activeSettlementRequiredAmount = settlementAmount;
  const pendingPayments = note.payments.filter((payment) => payment.status === "PENDING");
  const openReceiptTotal = note.payments
    .filter((payment) => OPEN_PAYMENT_STATUSES.includes(payment.status))
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  const pendingTawidhAmount = Number(tawidhAmount) || 0;
  const pendingGharamahAmount = Number(gharamahAmount) || 0;
  const pendingLateFeeTotal = pendingTawidhAmount + pendingGharamahAmount;
  const availableLateFeeHeadroom = resolvePanelLateFeeHeadroom({
    preview,
    lateChargeResult,
    previewSnapshot: persistedPreviewSettlement?.previewSnapshot,
    note,
    settlementAmount,
  });
  const pendingLateFeesExceedHeadroom =
    availableLateFeeHeadroom != null && pendingLateFeeTotal > availableLateFeeHeadroom + 0.005;
  const tawidhInvestorSharePercent = Math.min(
    100,
    Math.max(0, parseMoney(tawidhInvestorSharePercentInput))
  );
  const pendingTawidhInvestorAmount = calculatePercentAmount(
    pendingTawidhAmount,
    tawidhInvestorSharePercent
  );
  const recordPaymentLimit = settlementAmount;
  const previewInputsMatchSaved =
    previewSettlementCandidate != null &&
    Math.abs(pendingTawidhAmount - previewSettlementCandidate.tawidhAmount) < 0.01 &&
    Math.abs(pendingGharamahAmount - previewSettlementCandidate.gharamahAmount) < 0.01 &&
    (pendingTawidhAmount <= 0.005 ||
      Math.abs(
        tawidhInvestorSharePercent - (previewSettlementCandidate.tawidhInvestorSharePercent ?? 0)
      ) < 0.01);
  const settlementInputsDirty =
    previewSettlementCandidate != null && !previewInputsMatchSaved && !settlementLocked;
  const canApproveSettlement =
    approveSettlementId != null &&
    !settlementInputsDirty &&
    pendingPayments.length === 0 &&
    settlementIsComplete(
      previewSettlementCandidate?.grossReceiptAmount ?? 0,
      previewSettlementRequiredAmount
    );
  const canPostSettlement =
    postSettlementId != null &&
    pendingPayments.length === 0 &&
    settlementIsComplete(
      postSettlementCandidate?.grossReceiptAmount ?? 0,
      postSettlementRequiredAmount
    );
  const settlementEligiblePayments = note.payments.filter((payment) =>
    ["RECEIVED", "RECONCILED", "PARTIAL"].includes(payment.status)
  );
  const eligibleReceiptTotal = settlementEligiblePayments.reduce(
    (sum, payment) => sum + payment.receiptAmount,
    0
  );
  const includedPaymentIds = new Set(settlementEligiblePayments.map((payment) => payment.id));
  const generatedLetters = React.useMemo(() => {
    return note.events
      .filter(
        (event) =>
          event.eventType === "ARREARS_LETTER_GENERATED" ||
          event.eventType === "DEFAULT_LETTER_GENERATED"
      )
      .map((event) => {
        const s3Key = event.metadata?.s3Key;
        return {
          id: event.id,
          type: event.eventType === "ARREARS_LETTER_GENERATED" ? "Arrears" : "Default",
          s3Key: typeof s3Key === "string" ? s3Key : null,
          createdAt: event.createdAt,
        };
      });
  }, [note.events]);
  const serviceFeeTrusteeLetters = persistedPostedSettlementId
    ? note.events
        .filter((event) => event.eventType === "SERVICE_FEE_TRUSTEE_LETTER_GENERATED")
        .filter((event) => event.metadata?.settlementId === persistedPostedSettlementId)
        .map((event) => ({
          id: event.id,
          s3Key: typeof event.metadata?.s3Key === "string" ? event.metadata.s3Key : null,
          createdAt: event.createdAt,
        }))
    : [];
  const paymentDueDateValue = resolvePaymentDueDate(note);
  const maturityDateLabel = formatMaturityDate(note.maturityDate);
  const paymentDueDateLabel = formatMaturityDate(paymentDueDateValue);
  const maturityTimingLabel = formatMaturityTiming(paymentDueDateValue ?? note.maturityDate);
  const overdueSnapshot = getOverdueSnapshot(note);
  const noteIsOverdue = overdueSnapshot.daysOverdue > 0;
  const profitMaturityDateValue = resolveProfitMaturityDate(note);
  const profitMaturityDateLabel = formatMaturityDate(profitMaturityDateValue);
  const paymentDueDiffersFromProfitMaturity =
    paymentDueDateValue != null &&
    profitMaturityDateValue != null &&
    new Date(paymentDueDateValue).toDateString() !== new Date(profitMaturityDateValue).toDateString();
  const lateFeesBlockedByZeroHeadroom =
    availableLateFeeHeadroom != null && availableLateFeeHeadroom <= 0.005 && noteIsOverdue;
  const lateFeeLedger = getLateFeeLedgerSummary(note);
  const savedPreviewLateFeeTotal = previewSettlementCandidate
    ? settlementLateFeeTotal(previewSettlementCandidate)
    : 0;
  const hasLateFeeActivity =
    pendingLateFeeTotal > 0.005 ||
    savedPreviewLateFeeTotal > 0.005 ||
    lateFeeLedger.postedToLedger > 0.005 ||
    lateFeeLedger.approvedNotPosted > 0.005 ||
    lateFeeLedger.issuerLateFeePaymentsSubmitted > 0.005;
  const showOverdueFeesSection = noteIsOverdue || hasLateFeeActivity;
  const feesNeedPreview = settlementInputsDirty;
  const previewButtonLabel = settlementInputsDirty
    ? "Preview settlement (update inputs)"
    : pendingLateFeeTotal > 0.005
      ? `Preview settlement (+${formatCurrency(pendingLateFeeTotal)} fees)`
      : "Preview settlement";
  const settlementActionBlockedReason = servicingBlockedReason
    ? servicingBlockedReason
    : pendingPayments.length > 0
      ? "Review or reject all pending payments before previewing, approving, or posting settlement."
      : !previewSettlementCandidate && !postSettlementCandidate && !persistedPostedSettlement
        ? "Generate a settlement preview first."
        : !persistedPostedSettlement &&
            !settlementIsComplete(
              activeSettlementGrossReceiptAmount,
              activeSettlementRequiredAmount
            )
          ? `Recorded receipt is ${formatCurrency(activeSettlementGrossReceiptAmount)}. Invoice settlement amount ${formatCurrency(activeSettlementRequiredAmount)} is required before approval or posting. Late fees are allocated from this receipt in the waterfall.`
          : null;
  const settlementReadyMessage = canPostSettlement
    ? "Approved settlement is complete. Posting will create ledger entries."
    : canApproveSettlement
      ? "Settlement amount is complete. Approve the preview before posting."
      : persistedPostedSettlement
        ? "Settlement has been posted and ledger entries have been created."
        : null;
  const displayedSettlement =
    persistedPostedSettlement ?? postSettlementCandidate ?? preview ?? persistedPreviewSettlement;
  const displayedSettlementRecord = displayedSettlement as Record<string, unknown> | null;
  const waterfallGrossReceipt = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "grossReceiptAmount")
    : 0;
  const waterfallInvestorPrincipal = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "investorPrincipal")
    : 0;
  const waterfallInvestorProfitGross = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "investorProfitGross")
    : 0;
  const waterfallInvestorProfitNet = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "investorProfitNet")
    : 0;
  const waterfallServiceFeeRatePercent = note.serviceFeeRatePercent;
  const waterfallTawidhInvestor = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "tawidhInvestorAmount")
    : 0;
  const waterfallServiceFee = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "serviceFeeAmount")
    : 0;
  const waterfallTotalTawidh = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "tawidhAmount")
    : 0;
  const waterfallTawidh = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "tawidhAccountAmount")
    : 0;
  const waterfallTawidhInvestorSharePercent = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "tawidhInvestorSharePercent")
    : 0;
  const waterfallGharamah = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "gharamahAmount")
    : 0;
  const waterfallIssuerResidual = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "issuerResidualAmount")
    : 0;
  const waterfallUnapplied = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "unappliedAmount")
    : 0;
  const waterfallProfitDays = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "profitDays")
    : 0;
  const waterfallAnnualProfitRatePercent = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "annualProfitRatePercent")
    : 0;
  const waterfallProfitStartDate =
    typeof displayedSettlementRecord?.profitStartDate === "string"
      ? displayedSettlementRecord.profitStartDate
      : null;
  const waterfallProfitMaturityDate =
    typeof displayedSettlementRecord?.profitMaturityDate === "string"
      ? displayedSettlementRecord.profitMaturityDate
      : null;
  const waterfallInvestorPoolTotal =
    waterfallInvestorPrincipal + waterfallInvestorProfitNet + waterfallTawidhInvestor;
  const showSettlementTrusteeWorkflow = hasSettlementTrusteeMovement({
    investorPoolAmount: waterfallInvestorPoolTotal,
    operatingAccountAmount: waterfallServiceFee,
    tawidhAccountAmount: waterfallTawidh,
    gharamahAmount: waterfallGharamah,
    issuerResidualAmount: waterfallIssuerResidual,
  });
  const issuerDisbursementWithdrawal =
    note.withdrawals.find(
      (withdrawal) =>
        withdrawal.withdrawalType === "ISSUER_DISBURSEMENT" &&
        withdrawal.status !== "CANCELLED"
    ) ?? null;
  const issuerResidualWithdrawal =
    note.withdrawals.find(
      (withdrawal) =>
        withdrawal.withdrawalType === "ISSUER_RESIDUAL_RETURN" &&
        withdrawal.status !== "CANCELLED"
    ) ?? null;
  const issuerResidualBeneficiary = beneficiaryFieldsFromSnapshot(
    (issuerDisbursementWithdrawal?.beneficiarySnapshot as Record<string, unknown> | null | undefined) ??
      (issuerResidualWithdrawal?.beneficiarySnapshot as Record<string, unknown> | null | undefined)
  );
  const waterfallRows = [
    {
      label: "Gross receipt from paymaster or issuer",
      destination: "Repayment Pool",
      amount: waterfallGrossReceipt,
      runningBalance: waterfallGrossReceipt,
      sign: "+",
    },
    {
      label: "Return investor principal",
      destination: "Investor Pool",
      amount: waterfallInvestorPrincipal,
      runningBalance: waterfallGrossReceipt - waterfallInvestorPrincipal,
      sign: "-",
    },
    {
      label: "Investor profit payout (net share)",
      detail:
        "Investors receive this amount. It is the net portion of gross contractual profit after the platform service fee below.",
      destination: "Investor Pool",
      amount: waterfallInvestorProfitNet,
      runningBalance:
        waterfallGrossReceipt - waterfallInvestorPrincipal - waterfallInvestorProfitNet,
      sign: "-",
    },
    {
      label: "Allocate investor Ta'widh compensation",
      destination: "Investor Pool",
      amount: waterfallTawidhInvestor,
      runningBalance:
        waterfallGrossReceipt -
        waterfallInvestorPrincipal -
        waterfallInvestorProfitNet -
        waterfallTawidhInvestor,
      sign: "-",
    },
    {
      label: "Platform service fee (from gross profit)",
      detail: `Not charged on top of the net payout above. ${waterfallServiceFeeRatePercent}% of ${formatCurrency(waterfallInvestorProfitGross)} gross contractual profit.`,
      destination: "Operating Account",
      amount: waterfallServiceFee,
      runningBalance:
        waterfallGrossReceipt -
        waterfallInvestorPrincipal -
        waterfallInvestorProfitNet -
        waterfallTawidhInvestor -
        waterfallServiceFee,
      sign: "-",
    },
    {
      label: "Allocate Ta'widh",
      destination: "Ta'widh Account",
      amount: waterfallTawidh,
      runningBalance:
        waterfallGrossReceipt -
        waterfallInvestorPrincipal -
        waterfallInvestorProfitNet -
        waterfallTawidhInvestor -
        waterfallServiceFee -
        waterfallTawidh,
      sign: "-",
    },
    {
      label: "Allocate Gharamah",
      destination: "Gharamah Account",
      amount: waterfallGharamah,
      runningBalance:
        waterfallGrossReceipt -
        waterfallInvestorPrincipal -
        waterfallInvestorProfitNet -
        waterfallTawidhInvestor -
        waterfallServiceFee -
        waterfallTawidh -
        waterfallGharamah,
      sign: "-",
    },
    {
      label: "Return residual to issuer",
      destination: "Issuer refund",
      amount: waterfallIssuerResidual,
      runningBalance: waterfallUnapplied,
      sign: "-",
    },
  ];
  const overdueBaseAmount = lateChargeResult?.receiptAmount ?? settlementAmount;
  const overdueTawidhPreviewAmount =
    overdueFeeInputMode === "PERCENTAGE"
      ? calculatePercentAmount(overdueBaseAmount, parseMoney(overdueTawidhPercentInput))
      : parseMoney(overdueTawidhInput);
  const overdueGharamahPreviewAmount =
    overdueFeeInputMode === "PERCENTAGE"
      ? calculatePercentAmount(overdueBaseAmount, parseMoney(overdueGharamahPercentInput))
      : parseMoney(overdueGharamahInput);
  const paymentActionsOpen = servicingOpen && !persistedApprovedSettlement;
  const receiptRemainingAmount = Math.max(0, settlementAmount - openReceiptTotal);
  const canRecordMoreReceipts =
    paymentActionsOpen && settlementAmount > 0.005 && receiptRemainingAmount > 0.005;
  const settledReceiptTotal = note.payments
    .filter((payment) => payment.status === "SETTLED")
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  const repaymentReceiptsThresholdMet =
    settlementAmount > 0.005 &&
    pendingPayments.length === 0 &&
    (eligibleReceiptTotal + 0.005 >= settlementAmount ||
      settledReceiptTotal + 0.005 >= settlementAmount);
  const canPreviewSettlement =
    !previewSettlement.isPending &&
    settlementLocked == null &&
    servicingOpen &&
    settlementEligiblePayments.length > 0 &&
    pendingPayments.length === 0 &&
    repaymentReceiptsThresholdMet &&
    !pendingLateFeesExceedHeadroom;
  const repaymentReceiptsNeedAttention =
    paymentActionsOpen && (pendingPayments.length > 0 || canRecordMoreReceipts);
  const settlementReceiptsComplete = repaymentReceiptsThresholdMet;
  const settlementSectionNeedAttention =
    servicingOpen &&
    !persistedPostedSettlement &&
    settlementReceiptsComplete &&
    (canPreviewSettlement || canApproveSettlement || canPostSettlement || feesNeedPreview);
  const repaymentReceiptsSectionComplete =
    repaymentReceiptsThresholdMet || persistedPostedSettlement != null;
  const settlementWaterfallSectionComplete = persistedPostedSettlement != null;
  const overdueActionAvailable = servicingOpen && noteIsOverdue;
  const canMarkDefault = note.servicingStatus === "ARREARS";
  const documentActionAvailable = servicingOpen && (noteIsOverdue || canMarkDefault);

  const handleUseSettlementAmount = () => {
    if (settlementAmount <= 0) {
      toast.error("Settlement amount is not available");
      return;
    }
    setReceiptAmount(
      formatAmountInput(receiptRemainingAmount > 0 ? receiptRemainingAmount : settlementAmount)
    );
  };

  const handleOpenRecordPaymentDialog = () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (!paymentActionsOpen) {
      toast.info(
        "Payment actions are locked after settlement is approved. Post the settlement first."
      );
      return;
    }
    if (settlementAmount > 0 && openReceiptTotal >= settlementAmount - 0.005) {
      toast.info("Invoice settlement amount is already fully recorded in open receipts");
      return;
    }
    setRecordPaymentSource("PAYMASTER");
    setReference("");
    handleUseSettlementAmount();
    setRecordPaymentDialogOpen(true);
  };

  const sortedPayments = React.useMemo(() => {
    const statusRank: Record<string, number> = {
      PENDING: 0,
      PARTIAL: 1,
      RECEIVED: 2,
      RECONCILED: 3,
      VOID: 4,
    };
    return [...note.payments].sort((left, right) => {
      const rankDiff = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
      if (rankDiff !== 0) return rankDiff;
      return new Date(right.receiptDate).getTime() - new Date(left.receiptDate).getTime();
    });
  }, [note.payments]);

  const pendingReviewPayments = React.useMemo(
    () => sortedPayments.filter((payment) => payment.status === "PENDING"),
    [sortedPayments]
  );

  const recordedReceiptPayments = React.useMemo(
    () =>
      [...note.payments]
        .filter((payment) => payment.status !== "PENDING" && payment.status !== "VOID")
        .sort(
          (left, right) =>
            new Date(right.receiptDate).getTime() - new Date(left.receiptDate).getTime()
        ),
    [note.payments]
  );

  const handleConfirmRecordPayment = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (!paymentActionsOpen) {
      toast.info(
        "Payment actions are locked after settlement is approved. Post the settlement first."
      );
      return;
    }
    const amount = Number(receiptAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid receipt amount");
      return;
    }
    if (openReceiptTotal + amount > recordPaymentLimit + 0.005) {
      toast.error(
        `Open receipts cannot exceed the invoice settlement amount of ${formatCurrency(recordPaymentLimit)}`
      );
      return;
    }
    try {
      await recordPayment.mutateAsync({
        id: note.id,
        input: {
          source: recordPaymentSource as NotePaymentSource,
          receiptAmount: amount,
          receiptDate: new Date().toISOString(),
          reference: reference || null,
          metadata:
            recordPaymentSource === "ISSUER_ON_BEHALF" ? { paymentPurpose: "SETTLEMENT" } : null,
        },
      });
      setPreview(null);
      setRecordPaymentDialogOpen(false);
      setReference("");
      setReceiptAmount("");
      toast.success("Payment receipt recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    }
  };

  const handleApprovePayment = async (payment: NotePayment) => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (!paymentActionsOpen) {
      toast.info(
        "Payment actions are locked after settlement is approved. Post the settlement first."
      );
      return;
    }
    try {
      await approvePayment.mutateAsync({ id: note.id, paymentId: payment.id });
      toast.success("Issuer payment approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve payment");
    }
  };

  const handleRejectPayment = async (payment: NotePayment) => {
    try {
      await rejectPayment.mutateAsync({
        id: note.id,
        paymentId: payment.id,
        reason: rejectionReasons[payment.id]?.trim() || null,
      });
      setRejectionReasons((previous) => ({ ...previous, [payment.id]: "" }));
      setRejectingPaymentId(null);
      toast.success("Issuer payment rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject payment");
    }
  };

  const handleCancelRejectPayment = (paymentId: string) => {
    setRejectingPaymentId(null);
    setRejectionReasons((previous) => ({ ...previous, [paymentId]: "" }));
  };

  const runOverdueLateChargeCheck = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return null;
    }
    const result = await checkOverdueLateCharge.mutateAsync({
      id: note.id,
      input: {
        receiptAmount: settlementAmount,
        receiptDate: new Date().toISOString(),
      },
    });
    setLateChargeResult(result);
    return result;
  };

  const queueLateFeeAmounts = (tawidh: number, gharamah: number) => {
    const total = tawidh + gharamah;
    if (availableLateFeeHeadroom != null && total > availableLateFeeHeadroom + 0.005) {
      toast.error(
        `Late fees exceed the available settlement headroom of ${formatCurrency(availableLateFeeHeadroom)}`
      );
      return;
    }
    setTawidhAmount(formatAmountInput(tawidh));
    setGharamahAmount(formatAmountInput(gharamah));
    if (total <= 0.005) return;
    toast.success(
      `Queued ${formatCurrency(total)} in late fees. Preview settlement below to save to the waterfall.`
    );
  };

  const handleApplySuggestedLateFees = async () => {
    try {
      const result = await runOverdueLateChargeCheck();
      if (!result) return;
      if (!result.overdue) {
        toast.info(result.message);
        return;
      }
      if (result.remainingTawidhAmount <= 0 && result.remainingGharamahAmount <= 0) {
        toast.info("All allowable overdue fees have already been applied.");
        return;
      }
      const tawidh = result.suggestedTawidhAmount;
      const gharamah = result.suggestedGharamahAmount;
      if (tawidh + gharamah <= 0.005) {
        toast.info("No late fees to apply for the current overdue check.");
        return;
      }
      queueLateFeeAmounts(tawidh, gharamah);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply suggested late fees");
    }
  };

  const handleOpenOverdueFeeDialog = async () => {
    try {
      const result = await runOverdueLateChargeCheck();
      if (!result) return;
      setOverdueTawidhInput(formatAmountInput(result.suggestedTawidhAmount));
      setOverdueGharamahInput(formatAmountInput(result.suggestedGharamahAmount));
      setOverdueTawidhPercentInput(
        formatPercentInput(
          calculatePercentFromAmount(result.suggestedTawidhAmount, result.receiptAmount)
        )
      );
      setOverdueGharamahPercentInput(
        formatPercentInput(
          calculatePercentFromAmount(result.suggestedGharamahAmount, result.receiptAmount)
        )
      );
      if (!result.overdue) {
        toast.info(result.message);
        return;
      }
      if (result.remainingTawidhAmount <= 0 && result.remainingGharamahAmount <= 0) {
        toast.info("All allowable overdue fees have already been applied.");
        return;
      }
      setOverdueFeeDialogOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check overdue late fees");
    }
  };

  const handleApplyOverdueFees = () => {
    if (!lateChargeResult) {
      toast.error("Run the overdue check first");
      return;
    }
    const tawidh = overdueTawidhPreviewAmount;
    const gharamah = overdueGharamahPreviewAmount;
    if (!Number.isFinite(tawidh) || !Number.isFinite(gharamah) || tawidh < 0 || gharamah < 0) {
      toast.error("Enter valid overdue fee amounts");
      return;
    }
    if (tawidh > lateChargeResult.remainingTawidhAmount + 0.005) {
      toast.error("Ta'widh exceeds the remaining allowable cap");
      return;
    }
    if (gharamah > lateChargeResult.remainingGharamahAmount + 0.005) {
      toast.error("Gharamah exceeds the remaining allowable cap");
      return;
    }
    if (tawidh + gharamah <= 0) {
      toast.error("Enter at least one overdue fee amount");
      return;
    }
    queueLateFeeAmounts(tawidh, gharamah);
    setOverdueFeeDialogOpen(false);
  };

  React.useEffect(() => {
    if (!persistedPreviewSettlement || settlementLocked) {
      syncedPreviewIdRef.current = null;
      return;
    }
    const syncKey = `${note.id}:${persistedPreviewSettlement.id}`;
    if (syncedPreviewIdRef.current === syncKey) return;
    setTawidhAmount(formatAmountInput(persistedPreviewSettlement.tawidhAmount));
    setGharamahAmount(formatAmountInput(persistedPreviewSettlement.gharamahAmount));
    setTawidhInvestorSharePercentInput(
      formatPercentInput(persistedPreviewSettlement.tawidhInvestorSharePercent ?? 0)
    );
    syncedPreviewIdRef.current = syncKey;
  }, [note.id, settlementLocked, persistedPreviewSettlement]);

  const handlePreview = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (settlementLocked) {
      toast.info(
        persistedPostedSettlement
          ? "Settlement has already been posted"
          : "Settlement has already been approved. Post it before making further changes."
      );
      return;
    }
    if (settlementEligiblePayments.length === 0) {
      toast.error("Record at least one payment receipt before previewing the settlement");
      return;
    }
    if (pendingPayments.length > 0) {
      toast.error("Review or reject pending payments before previewing settlement");
      return;
    }
    if (pendingLateFeesExceedHeadroom) {
      toast.error(
        `Late fees exceed the available settlement headroom of ${formatCurrency(availableLateFeeHeadroom ?? 0)}`
      );
      return;
    }
    try {
      const result = await previewSettlement.mutateAsync({
        id: note.id,
        input: {
          receiptDate: new Date().toISOString(),
          tawidhAmount: Number(tawidhAmount) || 0,
          tawidhInvestorSharePercent,
          gharamahAmount: Number(gharamahAmount) || 0,
        },
      });
      setPreview(result);
      syncedPreviewIdRef.current = `${note.id}:${result.settlementId}`;
      toast.success("Settlement preview generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview settlement");
    }
  };

  const requestApproveSettlement = () => {
    if (!approveSettlementId) return;
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (pendingPayments.length > 0) {
      toast.error("Review or reject pending payments before approving settlement");
      return;
    }
    if (settlementInputsDirty) {
      toast.error("Preview the updated settlement inputs before approving");
      return;
    }
    setSettlementConfirm("approve");
  };

  const requestPostSettlement = () => {
    if (!postSettlementId) return;
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    if (pendingPayments.length > 0) {
      toast.error("Review or reject pending payments before posting settlement");
      return;
    }
    setSettlementConfirm("post");
  };

  const confirmSettlementAction = async () => {
    if (!settlementConfirm) return;
    try {
      if (settlementConfirm === "approve") {
        if (!approveSettlementId) return;
        await approveSettlement.mutateAsync({ id: note.id, settlementId: approveSettlementId });
        toast.success("Settlement approved");
      } else {
        if (!postSettlementId) return;
        await postSettlement.mutateAsync({ id: note.id, settlementId: postSettlementId });
        toast.success("Settlement posted");
      }
      setPreview(null);
      setSettlementConfirm(null);
    } catch (err) {
      const verb = settlementConfirm === "approve" ? "approve" : "post";
      toast.error(err instanceof Error ? err.message : `Failed to ${verb} settlement`);
    }
  };

  const handleLetter = async (kind: "arrears" | "default") => {
    try {
      const result =
        kind === "arrears"
          ? await arrearsLetter.mutateAsync(note.id)
          : await defaultLetter.mutateAsync(note.id);
      toast.success(
        `${kind === "arrears" ? "Arrears" : "Default"} letter generated: ${result.s3Key}`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate letter");
    }
  };

  const handleServiceFeeTrusteeLetter = async () => {
    if (!persistedPostedSettlement) return;
    try {
      const result = await generateServiceFeeTrusteeLetter.mutateAsync({
        noteId: note.id,
        settlementId: persistedPostedSettlement.id,
      });
      toast.success(`Settlement trustee letter generated: ${result.s3Key}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate letter");
    }
  };

  const handleMarkDefault = async () => {
    if (!defaultReason.trim()) {
      toast.error("Default reason is required");
      return;
    }
    try {
      await markDefault.mutateAsync({ id: note.id, reason: defaultReason });
      setDefaultReason("");
      toast.success("Note marked as default");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark default");
    }
  };

  const serviceFeeTrusteeStatus = persistedPostedSettlement?.serviceFeeTrusteeStatus ?? null;
  const serviceFeeTrusteeWorkflowComplete = serviceFeeTrusteeStatus === "COMPLETED";
  const serviceFeeTrusteeNeedsPdf =
    !serviceFeeTrusteeWorkflowComplete &&
    (serviceFeeTrusteeStatus === null || serviceFeeTrusteeStatus === "PENDING_LETTER");
  const serviceFeeTrusteeLetterLocked =
    serviceFeeTrusteeStatus === "SUBMITTED_TO_TRUSTEE" || serviceFeeTrusteeStatus === "COMPLETED";
  const serviceFeeTrusteePendingAny =
    generateServiceFeeTrusteeLetter.isPending ||
    markServiceFeeTrusteeSubmitted.isPending ||
    markServiceFeeTrusteeCompleted.isPending;

  const confirmServiceFeeTrusteeCopy =
    serviceFeeTrusteeConfirm === "submit"
      ? {
          title: "Submit to trustee?",
          description:
            "Confirm the settlement trustee instruction has been sent to the trustee. Mark it complete once the settlement allocations have been processed.",
          confirmLabel: "Mark submitted",
        }
      : serviceFeeTrusteeConfirm === "complete"
        ? {
            title: "Mark instruction completed?",
            description:
              "Confirm the trustee has processed this settlement instruction. This closes the settlement trustee checklist.",
            confirmLabel: "Mark completed",
          }
        : null;

  const runServiceFeeTrusteeConfirm = async () => {
    if (!serviceFeeTrusteeConfirm || !persistedPostedSettlement) return;
    try {
      if (serviceFeeTrusteeConfirm === "submit") {
        await markServiceFeeTrusteeSubmitted.mutateAsync({
          noteId: note.id,
          settlementId: persistedPostedSettlement.id,
        });
        toast.success("Marked as submitted to trustee");
      } else {
        await markServiceFeeTrusteeCompleted.mutateAsync({
          noteId: note.id,
          settlementId: persistedPostedSettlement.id,
        });
        toast.success("Settlement trustee instruction marked complete");
      }
      setServiceFeeTrusteeConfirm(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <>
      <Card className="rounded-2xl">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Servicing Lifecycle</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Manage maturity-driven servicing: receipts, late fees, settlement, arrears letters,
                and default actions.
              </p>
            </div>
            {pendingPayments.length > 0 ? (
              <Badge variant="secondary">{pendingPayments.length} pending review</Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div
              className={cn(
                "rounded-xl border p-4 md:col-span-2 xl:col-span-1",
                repaymentReceiptsNeedAttention ? ACTION_CARD_CLASS : "bg-card"
              )}
            >
              <div className="text-xs text-muted-foreground">Invoice settlement amount</div>
              <div className="mt-1 text-2xl font-semibold text-primary">
                {formatCurrency(settlementAmount)}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Repayment receipts should total this amount. Ta&apos;widh and Gharamah are taken
                from this pool in the waterfall (they are not added on top).
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Payment due / maturity</div>
              <div className="mt-1 text-lg font-semibold">{paymentDueDateLabel}</div>
              <div className="mt-1 text-xs text-muted-foreground">{maturityTimingLabel}</div>
              {paymentDueDateValue &&
              note.maturityDate &&
              new Date(paymentDueDateValue).toDateString() !==
                new Date(note.maturityDate).toDateString() ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Contractual maturity {maturityDateLabel}
                </div>
              ) : null}
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Grace and Arrears</div>
              <div className="mt-1 text-lg font-semibold">
                {note.gracePeriodDays} + {note.arrearsThresholdDays} days
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Grace period plus arrears threshold
              </div>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <div className="text-xs text-muted-foreground">Late Fee Caps</div>
              <div className="mt-1 text-lg font-semibold">
                Ta&apos;widh {note.tawidhRateCapPercent}%
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Gharamah {note.gharamahRateCapPercent}% cap
              </div>
            </div>
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              repaymentReceiptsSectionComplete
                ? SECTION_COMPLETE_CLASS
                : repaymentReceiptsNeedAttention
                  ? ACTION_CARD_CLASS
                  : "bg-muted/20"
            )}
          >
            {repaymentReceiptsSectionComplete ? (
              <div className={SECTION_COMPLETE_HEADER_CLASS}>Repayment receipts complete</div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">1. Repayment receipts</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Record paymaster or issuer receipts, approve issuer submissions, then preview
                  settlement when open receipts reach the invoice amount.
                </p>
              </div>
              <Button
                size="sm"
                className="gap-1.5 rounded-xl"
                onClick={handleOpenRecordPaymentDialog}
                disabled={recordPayment.isPending || !canRecordMoreReceipts || !canRepayment}
                title={!canRepayment ? "You do not have permission to perform this action." : undefined}
              >
                <PlusIcon className="h-4 w-4" />
                Record receipt
              </Button>
            </div>

            {!repaymentReceiptsSectionComplete &&
            !canRecordMoreReceipts &&
            paymentActionsOpen &&
            settlementAmount > 0.005 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Open receipts already reach the invoice settlement amount. Record receipt is
                disabled until receipts are reduced or the settlement amount changes.
              </p>
            ) : null}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MoneyMetric label="Open receipts" value={openReceiptTotal} />
              <MoneyMetric label="Invoice settlement" value={settlementAmount} />
              <MoneyMetric label="Remaining to record" value={receiptRemainingAmount} />
            </div>

            {pendingPayments.length > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                {pendingPayments.length} issuer-submitted payment
                {pendingPayments.length === 1 ? " is" : "s are"} awaiting approval before settlement
                preview is available.
              </div>
            ) : null}

            {servicingBlockedReason ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                {servicingBlockedReason}
              </div>
            ) : null}

            {note.payments.length === 0 ? (
              <div className="mt-4 flex flex-col items-start gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                <span>No repayment receipts yet.</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-xl"
                  onClick={handleOpenRecordPaymentDialog}
                  disabled={!canRecordMoreReceipts || !canRepayment}
                  title={!canRepayment ? "You do not have permission to perform this action." : undefined}
                >
                  <PlusIcon className="h-4 w-4" />
                  Record first receipt
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {pendingReviewPayments.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                      Needs approval ({pendingReviewPayments.length})
                    </div>
                    <div className="space-y-2">
                      {pendingReviewPayments.map((payment) => {
                        const evidenceFiles = getPaymentEvidenceFiles(payment);
                        const isRejecting = rejectingPaymentId === payment.id;
                        return (
                          <div
                            key={payment.id}
                            className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold tabular-nums">
                                    {formatCurrency(payment.receiptAmount)}
                                  </span>
                                  <Badge variant={statusVariant(payment.status)}>
                                    {formatStatus(payment.status)}
                                  </Badge>
                                  <Badge variant="outline">{sourceLabel(payment.source)}</Badge>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(payment.receiptDate), "dd MMM yyyy, h:mm a")}
                                  {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                                </div>
                                {evidenceFiles.length > 0 ? (
                                  <PaymentAdviceProofCompact
                                    files={evidenceFiles}
                                    onView={handleViewDocument}
                                    onDownload={handleDownloadDocument}
                                    viewPending={viewDocumentPending}
                                  />
                                ) : null}
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setRejectingPaymentId(payment.id)}
                                  disabled={
                                    rejectPayment.isPending || !canRepayment || isRejecting
                                  }
                                  title={
                                    !canRepayment
                                      ? "You do not have permission to perform this action."
                                      : undefined
                                  }
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePayment(payment)}
                                  disabled={
                                    approvePayment.isPending ||
                                    !paymentActionsOpen ||
                                    !canRepayment ||
                                    isRejecting
                                  }
                                  title={
                                    !canRepayment
                                      ? "You do not have permission to perform this action."
                                      : undefined
                                  }
                                >
                                  Approve
                                </Button>
                              </div>
                            </div>
                            {isRejecting ? (
                              <div className="mt-3 space-y-2 rounded-md border border-border/60 bg-background p-3">
                                <label
                                  className="text-xs font-medium text-foreground"
                                  htmlFor={`reject-reason-${payment.id}`}
                                >
                                  Reject reason (optional)
                                </label>
                                <Input
                                  id={`reject-reason-${payment.id}`}
                                  className="h-9"
                                  value={rejectionReasons[payment.id] ?? ""}
                                  onChange={(event) =>
                                    setRejectionReasons((previous) => ({
                                      ...previous,
                                      [payment.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Optional rejection reason"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCancelRejectPayment(payment.id)}
                                    disabled={rejectPayment.isPending}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => void handleRejectPayment(payment)}
                                    disabled={rejectPayment.isPending || !canRepayment}
                                  >
                                    {rejectPayment.isPending ? "Rejecting..." : "Confirm reject"}
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {recordedReceiptPayments.length > 0 ? (
                  <Collapsible
                    defaultOpen={recordedReceiptPayments.length <= 2}
                    className="group"
                  >
                    <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg py-1 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Recorded receipts ({recordedReceiptPayments.length})
                      </span>
                      <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2">
                      <div className="space-y-2">
                        {recordedReceiptPayments.map((payment) => {
                          const isIncluded = includedPaymentIds.has(payment.id);
                          const evidenceFiles = getPaymentEvidenceFiles(payment);
                          return (
                            <div
                              key={payment.id}
                              className="rounded-lg border border-border bg-card p-3"
                            >
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-sm font-semibold tabular-nums">
                                    {formatCurrency(payment.receiptAmount)}
                                  </span>
                                  <Badge variant={statusVariant(payment.status)}>
                                    {formatStatus(payment.status)}
                                  </Badge>
                                  <Badge variant="outline">{sourceLabel(payment.source)}</Badge>
                                  {isIncluded ? (
                                    <Badge
                                      variant="secondary"
                                      className="gap-1 border-transparent bg-muted px-2 py-0.5 text-xs text-foreground"
                                    >
                                      <CheckCircleIcon className="h-3.5 w-3.5" />
                                      Counts toward settlement
                                    </Badge>
                                  ) : null}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(payment.receiptDate), "dd MMM yyyy, h:mm a")}
                                  {payment.reference ? ` · Ref: ${payment.reference}` : ""}
                                </div>
                                {evidenceFiles.length > 0 ? (
                                  <PaymentAdviceProofCompact
                                    files={evidenceFiles}
                                    onView={handleViewDocument}
                                    onDownload={handleDownloadDocument}
                                    viewPending={viewDocumentPending}
                                  />
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ) : null}
              </div>
            )}
          </div>

          <div
            className={cn(
              "rounded-xl border p-4",
              settlementWaterfallSectionComplete
                ? SECTION_COMPLETE_CLASS
                : settlementSectionNeedAttention
                  ? ACTION_CARD_CLASS
                  : "bg-muted/20"
            )}
          >
            {settlementWaterfallSectionComplete ? (
              <div className={SECTION_COMPLETE_HEADER_CLASS}>Settlement posted</div>
            ) : null}
            <div>
              <div className="text-sm font-medium">2. Settlement &amp; waterfall</div>
              <p className="mt-1 text-xs text-muted-foreground">
                {showOverdueFeesSection
                  ? "Late fees are only booked to the ledger when settlement is posted. Until then they live in a preview (or are queued locally before you preview)."
                  : "Preview settlement to calculate the waterfall, then approve and post."}
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                <li>Record and approve repayment receipts.</li>
                {showOverdueFeesSection ? <li>Apply suggested or custom late fees.</li> : null}
                <li>
                  <span className="font-medium text-foreground">Preview settlement</span>
                  {showOverdueFeesSection
                    ? " to save fees into the waterfall row and review allocations."
                    : " to review allocations."}
                </li>
                <li>
                  Approve, then post
                  {showOverdueFeesSection
                    ? " — late fees hit Ta'widh / Gharamah accounts on post."
                    : "."}
                </li>
              </ol>
            </div>

            <div className="mt-4">
              {settlementEligiblePayments.length > 0 ? (
                <div className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">
                        Receipts included in settlement
                      </div>
                      <div className="mt-1 text-2xl font-semibold text-primary">
                        {formatCurrency(eligibleReceiptTotal)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {settlementEligiblePayments.length} receipt
                        {settlementEligiblePayments.length === 1 ? "" : "s"} aggregated · settlement
                        requires {formatCurrency(activeSettlementRequiredAmount)} invoice settlement
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {eligibleReceiptTotal + 0.005 >= activeSettlementRequiredAmount ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          Fully covered
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          {formatCurrency(
                            Math.max(0, activeSettlementRequiredAmount - eligibleReceiptTotal)
                          )}{" "}
                          remaining
                        </Badge>
                      )}
                    </div>
                  </div>
                  {settlementEligiblePayments.length > 1 ? (
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {settlementEligiblePayments.map((payment) => (
                        <li key={payment.id} className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {format(new Date(payment.receiptDate), "dd MMM yyyy")} ·{" "}
                            {sourceLabel(payment.source)}
                            {payment.reference ? ` · ${payment.reference}` : ""}
                          </span>
                          <span className="shrink-0 font-medium text-foreground">
                            {formatCurrency(payment.receiptAmount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  No eligible receipts yet. Record one or more payments above to build the
                  settlement total.
                </div>
              )}
            </div>

            {settlementActionBlockedReason ? (
              <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                {settlementActionBlockedReason}
              </div>
            ) : settlementReadyMessage ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                {settlementReadyMessage}
              </div>
            ) : null}

            {showOverdueFeesSection ? (
              <div
                className={cn(
                  "mt-4 rounded-xl border bg-card p-4",
                  (overdueActionAvailable || pendingLateFeeTotal > 0.005) && ACTION_CARD_CLASS
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">Late fees</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Caps from payment due {paymentDueDateLabel} plus {note.gracePeriodDays}-day
                      grace. Fees come from the settlement receipt pool, not on top of it.
                      {paymentDueDiffersFromProfitMaturity
                        ? ` Contractual profit accrues to ${profitMaturityDateLabel}.`
                        : ""}
                      {availableLateFeeHeadroom != null
                        ? ` Available late-fee headroom after investor principal and contractual profit is ${formatCurrency(availableLateFeeHeadroom)}.`
                        : " Available late-fee headroom will be confirmed during preview."}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant="secondary">{overdueSnapshot.label}</Badge>
                    {pendingLateFeeTotal > 0.005 ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Badge variant="outline">
                          Ta&apos;widh {formatCurrency(Number(tawidhAmount) || 0)}
                        </Badge>
                        <Badge variant="outline">
                          Gharamah {formatCurrency(Number(gharamahAmount) || 0)}
                        </Badge>
                        {feesNeedPreview ? (
                          <Badge variant="secondary">Queued for preview</Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50/80 text-emerald-900"
                          >
                            In preview
                          </Badge>
                        )}
                        {pendingLateFeesExceedHeadroom ? (
                          <Badge variant="destructive">Exceeds headroom</Badge>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 rounded-lg border bg-card p-3">
                  <div className="grid gap-3 md:grid-cols-[1fr_10rem] md:items-end">
                    <div>
                      <label
                        className="text-sm font-medium"
                        htmlFor="tawidh-investor-share-percent"
                      >
                        Ta&apos;widh investor share
                      </label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Optional percentage of total Ta&apos;widh returned to investors during the
                        settlement waterfall. The total Ta&apos;widh charge still reduces issuer
                        residual.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <div className="relative">
                        <Input
                          id="tawidh-investor-share-percent"
                          className="pr-8"
                          value={tawidhInvestorSharePercentInput}
                          onChange={(event) => {
                            if (isTwoDecimalInput(event.target.value)) {
                              setTawidhInvestorSharePercentInput(event.target.value);
                            }
                          }}
                          onBlur={() =>
                            setTawidhInvestorSharePercentInput(
                              formatPercentInput(tawidhInvestorSharePercent)
                            )
                          }
                          disabled={!servicingOpen || (Number(tawidhAmount) || 0) <= 0}
                          inputMode="decimal"
                          placeholder="0.00"
                        />
                        <span
                          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                          aria-hidden
                        >
                          %
                        </span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        {formatCurrency(pendingTawidhInvestorAmount)} to investors
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <p className="max-w-md text-xs text-muted-foreground">
                    {lateFeesBlockedByZeroHeadroom
                      ? "No late fees can be charged: settlement headroom is fully used by investor principal and contractual profit."
                      : pendingLateFeesExceedHeadroom
                        ? `Queued fees exceed the available settlement headroom of ${formatCurrency(availableLateFeeHeadroom ?? 0)}. Reduce Ta'widh or Gharamah before preview.`
                        : feesNeedPreview && pendingLateFeeTotal > 0.005
                          ? `${formatCurrency(pendingLateFeeTotal)} queued locally — use Preview settlement below.`
                          : pendingLateFeeTotal > 0.005
                            ? "Fees are in the saved preview. Approve and post when receipts are complete."
                            : "Apply system-suggested caps, or open custom amounts if you need to adjust."}
                  </p>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      onClick={handleApplySuggestedLateFees}
                      disabled={
                        checkOverdueLateCharge.isPending ||
                        !noteIsOverdue ||
                        !servicingOpen ||
                        lateFeesBlockedByZeroHeadroom ||
                        !canDefault
                      }
                      title={!canDefault ? "You do not have permission to perform this action." : undefined}
                    >
                      {checkOverdueLateCharge.isPending ? "Checking…" : "Apply suggested fees"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleOpenOverdueFeeDialog}
                      disabled={
                        checkOverdueLateCharge.isPending || !noteIsOverdue || !servicingOpen || !canDefault
                      }
                      title={!canDefault ? "You do not have permission to perform this action." : undefined}
                    >
                      Custom amounts
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Late fees</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    No Ta&apos;widh or Gharamah for this settlement. Checked against payment due{" "}
                    {paymentDueDateLabel} with {note.gracePeriodDays}-day grace —{" "}
                    {overdueSnapshot.label.toLowerCase()}.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="gap-1 border-emerald-200 bg-emerald-50/80 text-emerald-900"
                  >
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    RM 0.00
                  </Badge>
                  <Badge variant="outline">{overdueSnapshot.label}</Badge>
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
              <div className="text-xs text-muted-foreground">
                {feesNeedPreview
                  ? "Preview saves queued late fees into the settlement row and opens the waterfall."
                  : previewSettlementCandidate
                    ? "Preview is saved. Approve when receipts cover the invoice settlement amount, then post."
                    : "Generate a preview after receipts reach the invoice settlement amount."}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant={feesNeedPreview ? "default" : "outline"}
                  onClick={handlePreview}
                  disabled={!canPreviewSettlement || !canSettlement}
                  title={!canSettlement ? "You do not have permission to perform this action." : undefined}
                >
                  {previewButtonLabel}
                </Button>
                <Button
                  variant="outline"
                  onClick={requestApproveSettlement}
                  disabled={!canApproveSettlement || approveSettlement.isPending || !servicingOpen || !canSettlement}
                  title={!canSettlement ? "You do not have permission to perform this action." : undefined}
                >
                  Approve
                </Button>
                <Button
                  onClick={requestPostSettlement}
                  disabled={!canPostSettlement || postSettlement.isPending || !servicingOpen || !canSettlement}
                  title={!canSettlement ? "You do not have permission to perform this action." : undefined}
                >
                  Post
                </Button>
              </div>
            </div>

            {displayedSettlement ? (
              <div className="mt-4 space-y-4">
                <div
                  className={cn(
                    "rounded-xl border p-4",
                    settlementWaterfallSectionComplete ? SECTION_COMPLETE_CLASS : "bg-card"
                  )}
                >
                  {settlementWaterfallSectionComplete ? (
                    <div className={SECTION_COMPLETE_HEADER_CLASS}>
                      Settlement waterfall complete
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">Waterfall Calculation</div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Starts with the gross receipt, then allocates each bucket until the
                        remaining balance is known.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Profit is locked from {formatMaturityDate(waterfallProfitStartDate)} to{" "}
                        {formatMaturityDate(waterfallProfitMaturityDate)} ({waterfallProfitDays}{" "}
                        days) at {waterfallAnnualProfitRatePercent}% p.a. Early settlement does not
                        reduce profit; late settlement adds only approved late charges after grace.
                      </p>
                      {waterfallInvestorProfitGross > 0.005 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Gross contractual profit {formatCurrency(waterfallInvestorProfitGross)} is
                          split once: {formatCurrency(waterfallInvestorProfitNet)} to investors and{" "}
                          {formatCurrency(waterfallServiceFee)} to the platform (
                          {waterfallServiceFeeRatePercent}% of gross profit). The two profit rows
                          below show that split, not a second charge to investors.
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline">
                      Settlement due {formatCurrency(settlementAmount)}
                    </Badge>
                  </div>
                  <div className="mt-4 overflow-hidden rounded-lg border">
                    <div className="grid grid-cols-[1fr_9rem_9rem_9rem] gap-3 bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                      <div>Calculation</div>
                      <div className="text-right">Destination</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Balance</div>
                    </div>
                    {waterfallRows.map((row) => (
                      <div
                        key={row.label}
                        className="grid grid-cols-[1fr_9rem_9rem_9rem] gap-3 border-t px-3 py-3 text-sm"
                      >
                        <div>
                          <div>
                            <span
                              className={
                                row.sign === "+" ? "text-emerald-700" : "text-muted-foreground"
                              }
                            >
                              {row.sign}
                            </span>{" "}
                            {row.label}
                          </div>
                          {"detail" in row && row.detail ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">{row.detail}</p>
                          ) : null}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          {row.destination}
                        </div>
                        <div className="text-right font-medium">{formatCurrency(row.amount)}</div>
                        <div className="text-right font-medium">
                          {formatCurrency(row.runningBalance)}
                        </div>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_9rem_9rem_9rem] gap-3 border-t bg-muted/30 px-3 py-3 text-sm font-semibold">
                      <div>Remaining in Repayment Pool</div>
                      <div className="text-right text-xs text-muted-foreground">Unapplied</div>
                      <div className="text-right">{formatCurrency(waterfallUnapplied)}</div>
                      <div className="text-right">{formatCurrency(waterfallUnapplied)}</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <PoolSummaryCard
                    label="Repayment Pool"
                    value={waterfallGrossReceipt}
                    description={`Receipt in; ${formatCurrency(waterfallUnapplied)} remains unapplied.`}
                  />
                  <PoolSummaryCard
                    label="Investor Pool"
                    value={waterfallInvestorPoolTotal}
                    description="Principal, investors' net profit share, and any investor Ta'widh compensation. Platform service fee is not deducted again here."
                  />
                  <PoolSummaryCard
                    label="Operating Account"
                    value={waterfallServiceFee}
                    description={`Platform share of gross contractual profit (${waterfallServiceFeeRatePercent}% of ${formatCurrency(waterfallInvestorProfitGross)}).`}
                  />
                  <PoolSummaryCard
                    label="Ta'widh Account"
                    value={waterfallTawidh}
                    description={`${formatCurrency(waterfallTotalTawidh)} total Ta'widh; ${waterfallTawidhInvestorSharePercent}% shared with investors.`}
                  />
                  <PoolSummaryCard
                    label="Gharamah Account"
                    value={waterfallGharamah}
                    description="Charity/penalty portion of late charges."
                  />
                </div>
                {persistedPostedSettlement && showSettlementTrusteeWorkflow ? (
                  <div
                    className={cn(
                      "mt-4 rounded-xl border p-4",
                      serviceFeeTrusteeNeedsPdf
                        ? "border-destructive/40 bg-destructive/5 shadow-[0_0_0_1px_hsl(var(--destructive)/0.12),0_0_24px_hsl(var(--destructive)/0.14)]"
                        : !serviceFeeTrusteeWorkflowComplete
                          ? cn("border-amber-200 bg-amber-50/50", ACTION_CARD_CLASS)
                          : SECTION_COMPLETE_CLASS
                    )}
                  >
                    {serviceFeeTrusteeNeedsPdf ? (
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-destructive">
                        Action required — settlement trustee letter not generated
                      </div>
                    ) : !serviceFeeTrusteeWorkflowComplete ? (
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-amber-900">
                        Trustee workflow in progress
                      </div>
                    ) : (
                      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-emerald-900">
                        Settlement trustee instruction complete
                      </div>
                    )}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">
                          Settlement Trustee Letter
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Documents the full posted settlement waterfall from Repayment Pool to
                          Investor Pool, Operating Account, Ta&apos;widh Account, Gharamah Account,
                          and issuer residual refund (if any).
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Status:{" "}
                          <span className="font-medium text-foreground">
                            {serviceFeeTrusteeStatusLabel(serviceFeeTrusteeStatus)}
                          </span>
                          {persistedPostedSettlement.serviceFeeTrusteeSubmittedAt ? (
                            <>
                              {" "}
                              · Submitted{" "}
                              {format(
                                new Date(persistedPostedSettlement.serviceFeeTrusteeSubmittedAt),
                                "dd MMM yyyy, h:mm a"
                              )}
                            </>
                          ) : null}
                          {persistedPostedSettlement.serviceFeeTrusteeCompletedAt ? (
                            <>
                              {" "}
                              · Completed{" "}
                              {format(
                                new Date(persistedPostedSettlement.serviceFeeTrusteeCompletedAt),
                                "dd MMM yyyy, h:mm a"
                              )}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant={serviceFeeTrusteeNeedsPdf ? "destructive" : "outline"}
                          onClick={() => void handleServiceFeeTrusteeLetter()}
                          disabled={serviceFeeTrusteeLetterLocked || serviceFeeTrusteePendingAny || !canDisbursement}
                          title={!canDisbursement ? "You do not have permission to perform this action." : undefined}
                        >
                          Generate Letter
                        </Button>
                        {serviceFeeTrusteeStatus === "LETTER_GENERATED" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setServiceFeeTrusteeConfirm("submit")}
                            disabled={serviceFeeTrusteePendingAny || !canDisbursement}
                            title={!canDisbursement ? "You do not have permission to perform this action." : undefined}
                          >
                            Mark submitted to trustee
                          </Button>
                        ) : null}
                        {serviceFeeTrusteeStatus === "SUBMITTED_TO_TRUSTEE" ? (
                          <Button
                            type="button"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => setServiceFeeTrusteeConfirm("complete")}
                            disabled={serviceFeeTrusteePendingAny || !canDisbursement}
                            title={!canDisbursement ? "You do not have permission to perform this action." : undefined}
                          >
                            Mark completed
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    {waterfallIssuerResidual > 0.005 ? (
                      <div className="mt-3 rounded-lg border bg-muted/30 p-3">
                        <div className="text-sm font-medium">Issuer residual refund</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Amount:{" "}
                          <span className="font-medium text-foreground">
                            {formatCurrency(waterfallIssuerResidual)}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Payee / Account holder:{" "}
                          <span className="font-medium text-foreground">
                            {issuerResidualBeneficiary.accountHolder || "—"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Bank name:{" "}
                          <span className="font-medium text-foreground">
                            {issuerResidualBeneficiary.bankName || "—"}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Account number:{" "}
                          <span className="font-medium text-foreground">
                            {issuerResidualBeneficiary.accountNumber || "—"}
                          </span>
                        </div>
                      </div>
                    ) : null}
                    {serviceFeeTrusteeNeedsPdf ? (
                      <div className="mt-3 text-sm text-destructive">
                        No settlement trustee letter generated for this settlement yet. Generate the
                        instruction for the trustee before marking the workflow submitted or
                        complete.
                      </div>
                    ) : null}
                    {serviceFeeTrusteeLetters.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {serviceFeeTrusteeLetters.map((letter) => (
                          <div key={letter.id} className="rounded-lg border bg-card p-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">
                                    Settlement trustee instruction
                                  </span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {format(new Date(letter.createdAt), "dd MMM yyyy, h:mm a")}
                                </div>
                              </div>
                              {letter.s3Key ? (
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5"
                                    disabled={viewDocumentPending}
                                    onClick={() => handleViewDocument(letter.s3Key!)}
                                  >
                                    <DocumentTextIcon className="h-3.5 w-3.5" />
                                    View
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 gap-1.5"
                                    disabled={viewDocumentPending}
                                    onClick={() =>
                                      handleDownloadDocument(
                                        letter.s3Key!,
                                        `service-fee-trustee-${note.noteReference}-${persistedPostedSettlement.id}.pdf`
                                      )
                                    }
                                  >
                                    <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                    Download
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : !serviceFeeTrusteeNeedsPdf ? (
                      <div className="mt-3 text-sm text-muted-foreground">
                        Letter events will appear here after you generate the PDF.
                      </div>
                    ) : null}
                    {serviceFeeTrusteePendingAny ? (
                      <div className="mt-2 text-xs text-muted-foreground">Working…</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No settlement preview generated yet.
              </div>
            )}
          </div>

          <div
            className={cn("rounded-xl border p-4", documentActionAvailable && ACTION_CARD_CLASS)}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">4. Arrears and Default Documents</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate lifecycle letters tied to the maturity, grace, arrears, and default
                  workflow.
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleLetter("arrears")}
                  disabled={arrearsLetter.isPending || !canDefault}
                  title={!canDefault ? "You do not have permission to perform this action." : undefined}
                >
                  Generate Arrears Letter
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleLetter("default")}
                  disabled={defaultLetter.isPending || !canDefault}
                  title={!canDefault ? "You do not have permission to perform this action." : undefined}
                >
                  Generate Default Letter
                </Button>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Generated Letters</div>
                  <div className="text-xs text-muted-foreground">
                    Arrears and default PDFs generated for this note.
                  </div>
                </div>
                {generatedLetters.length > 0 ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {generatedLetters.length}
                  </Badge>
                ) : null}
              </div>
              {generatedLetters.length === 0 ? (
                <div className="mt-3 text-sm text-muted-foreground">No letters generated yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {generatedLetters.map((letter) => (
                    <div key={letter.id} className="rounded-lg border bg-card p-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{letter.type} letter</span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {format(new Date(letter.createdAt), "dd MMM yyyy, h:mm a")}
                          </div>
                          {letter.s3Key ? (
                            <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                              {letter.s3Key}
                            </div>
                          ) : null}
                        </div>
                        {letter.s3Key ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              disabled={viewDocumentPending}
                              onClick={() => handleViewDocument(letter.s3Key!)}
                            >
                              <DocumentTextIcon className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5"
                              disabled={viewDocumentPending}
                              onClick={() =>
                                handleDownloadDocument(
                                  letter.s3Key!,
                                  `${letter.type.toLowerCase()}-letter-${note.noteReference}.pdf`
                                )
                              }
                            >
                              <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                value={defaultReason}
                onChange={(event) => setDefaultReason(event.target.value)}
                placeholder="Default reason"
              />
              <Button
                variant="destructive"
                onClick={handleMarkDefault}
                disabled={markDefault.isPending || !canMarkDefault || !canDefault}
                title={!canDefault ? "You do not have permission to perform this action." : undefined}
              >
                Mark Default
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <AlertDialog
        open={serviceFeeTrusteeConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setServiceFeeTrusteeConfirm(null);
        }}
      >
        <AlertDialogContent>
          {confirmServiceFeeTrusteeCopy ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmServiceFeeTrusteeCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmServiceFeeTrusteeCopy.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={serviceFeeTrusteePendingAny}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void runServiceFeeTrusteeConfirm()}
                  disabled={serviceFeeTrusteePendingAny}
                >
                  {confirmServiceFeeTrusteeCopy.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={recordPaymentDialogOpen} onOpenChange={setRecordPaymentDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record repayment receipt</DialogTitle>
            <DialogDescription className="text-[15px] leading-7">
              Add a verified receipt to the repayment pool. Open receipts must reach{" "}
              {formatCurrency(settlementAmount)} before settlement preview.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Already recorded (open)</div>
                <div className="mt-1 font-semibold">{formatCurrency(openReceiptTotal)}</div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-3">
                <div className="text-xs text-muted-foreground">Remaining capacity</div>
                <div className="mt-1 font-semibold">{formatCurrency(receiptRemainingAmount)}</div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-payment-amount">
                Receipt amount
              </label>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="admin-payment-amount"
                  className="min-w-[12rem] flex-1 rounded-xl"
                  value={receiptAmount}
                  onChange={(event) => setReceiptAmount(event.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={handleUseSettlementAmount}
                  disabled={settlementAmount <= 0}
                >
                  Fill remaining
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-payment-source">
                Payment source
              </label>
              <Select
                value={recordPaymentSource}
                onValueChange={(value) => setRecordPaymentSource(value as RecordPaymentSource)}
              >
                <SelectTrigger id="admin-payment-source" className="rounded-xl">
                  <SelectValue placeholder="Select payment source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYMASTER">Paymaster payment</SelectItem>
                  <SelectItem value="ISSUER_ON_BEHALF">Issuer-reported payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="admin-payment-reference">
                Payment reference
              </label>
              <Input
                id="admin-payment-reference"
                className="rounded-xl"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="Bank transfer reference or receipt number"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Issuer-submitted Payment Advice from the issuer portal enters pending review. Use
              this form to record a verified receipt directly when you have already confirmed the
              payment (for example, proof received by email).
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setRecordPaymentDialogOpen(false)}
              disabled={recordPayment.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              onClick={handleConfirmRecordPayment}
              disabled={recordPayment.isPending}
            >
              {recordPayment.isPending ? "Recording..." : "Record receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={overdueFeeDialogOpen} onOpenChange={setOverdueFeeDialogOpen}>
        <DialogContent className="rounded-2xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Custom late fee amounts</DialogTitle>
            <DialogDescription className="text-[15px] leading-7">
              Adjust Ta&apos;widh and Gharamah within today&apos;s caps. Queued fees are saved when
              you preview settlement below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">Overdue days</div>
                <div className="mt-1 font-semibold">
                  {lateChargeResult?.daysLate ?? overdueSnapshot.daysOverdue}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">After grace period</div>
              </div>
              <MoneyMetric
                label="Remaining Ta'widh Cap"
                value={lateChargeResult?.remainingTawidhAmount ?? 0}
              />
              <MoneyMetric
                label="Remaining Gharamah Cap"
                value={lateChargeResult?.remainingGharamahAmount ?? 0}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[12rem_1fr] md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="overdue-fee-input-mode">
                  Input mode
                </label>
                <Select
                  value={overdueFeeInputMode}
                  onValueChange={(value) => setOverdueFeeInputMode(value as OverdueFeeInputMode)}
                >
                  <SelectTrigger id="overdue-fee-input-mode" className="rounded-xl">
                    <SelectValue placeholder="Input mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AMOUNT">Amount</SelectItem>
                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="pb-2 text-xs text-muted-foreground">
                {overdueFeeInputMode === "PERCENTAGE"
                  ? `Percentage is calculated against ${formatCurrency(overdueBaseAmount)} and rounded to cents. Use 2 decimal points.`
                  : "Enter fixed Ta'widh and Gharamah amounts directly."}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={
                    overdueFeeInputMode === "PERCENTAGE"
                      ? "overdue-tawidh-percent"
                      : "overdue-tawidh-amount"
                  }
                >
                  Ta&apos;widh {overdueFeeInputMode === "PERCENTAGE" ? "percentage" : "amount"}
                </label>
                {overdueFeeInputMode === "PERCENTAGE" ? (
                  <Input
                    id="overdue-tawidh-percent"
                    value={overdueTawidhPercentInput}
                    onChange={(event) => {
                      if (isTwoDecimalInput(event.target.value)) {
                        setOverdueTawidhPercentInput(event.target.value);
                      }
                    }}
                    onBlur={() =>
                      setOverdueTawidhPercentInput(
                        formatPercentInput(parseMoney(overdueTawidhPercentInput))
                      )
                    }
                    placeholder="0.00"
                  />
                ) : (
                  <Input
                    id="overdue-tawidh-amount"
                    value={overdueTawidhInput}
                    onChange={(event) => {
                      if (isTwoDecimalInput(event.target.value)) {
                        setOverdueTawidhInput(event.target.value);
                      }
                    }}
                    onBlur={() =>
                      setOverdueTawidhInput(formatAmountInput(parseMoney(overdueTawidhInput)))
                    }
                    placeholder="Ta'widh amount"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {overdueFeeInputMode === "PERCENTAGE"
                    ? `Calculated amount ${formatCurrency(overdueTawidhPreviewAmount)}`
                    : `Max ${formatCurrency(lateChargeResult?.remainingTawidhAmount ?? 0)}`}
                </p>
              </div>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium"
                  htmlFor={
                    overdueFeeInputMode === "PERCENTAGE"
                      ? "overdue-gharamah-percent"
                      : "overdue-gharamah-amount"
                  }
                >
                  Gharamah {overdueFeeInputMode === "PERCENTAGE" ? "percentage" : "amount"}
                </label>
                {overdueFeeInputMode === "PERCENTAGE" ? (
                  <Input
                    id="overdue-gharamah-percent"
                    value={overdueGharamahPercentInput}
                    onChange={(event) => {
                      if (isTwoDecimalInput(event.target.value)) {
                        setOverdueGharamahPercentInput(event.target.value);
                      }
                    }}
                    onBlur={() =>
                      setOverdueGharamahPercentInput(
                        formatPercentInput(parseMoney(overdueGharamahPercentInput))
                      )
                    }
                    placeholder="0.00"
                  />
                ) : (
                  <Input
                    id="overdue-gharamah-amount"
                    value={overdueGharamahInput}
                    onChange={(event) => {
                      if (isTwoDecimalInput(event.target.value)) {
                        setOverdueGharamahInput(event.target.value);
                      }
                    }}
                    onBlur={() =>
                      setOverdueGharamahInput(formatAmountInput(parseMoney(overdueGharamahInput)))
                    }
                    placeholder="Gharamah amount"
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  {overdueFeeInputMode === "PERCENTAGE"
                    ? `Calculated amount ${formatCurrency(overdueGharamahPreviewAmount)}`
                    : `Max ${formatCurrency(lateChargeResult?.remainingGharamahAmount ?? 0)}`}
                </p>
              </div>
            </div>
            <div className="rounded-xl border bg-primary/5 p-3 text-sm">
              <div className="font-medium text-primary">
                Total to apply:{" "}
                {formatCurrency(overdueTawidhPreviewAmount + overdueGharamahPreviewAmount)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Ta&apos;widh {formatCurrency(overdueTawidhPreviewAmount)} · Gharamah{" "}
                {formatCurrency(overdueGharamahPreviewAmount)}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
              These fees are not posted immediately. They are queued into the settlement preview so
              admin can review the full waterfall before approving and posting.
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOverdueFeeDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" className="rounded-xl" onClick={handleApplyOverdueFees}>
              Queue fees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={settlementConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setSettlementConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {settlementConfirm === "post" ? "Post settlement to ledger?" : "Approve settlement?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {settlementConfirm === "post" ? (
                <>
                  Posting credits the repayment pool and releases{" "}
                  {formatCurrency(waterfallGrossReceipt)} across investor payouts, service fee, and
                  issuer residual. If a residual payout is due, the note closes to further payment
                  actions while the trustee disbursement is completed. This action writes ledger
                  entries and cannot be undone.
                </>
              ) : (
                <>
                  Approving locks the preview waterfall ({formatCurrency(waterfallGrossReceipt)}{" "}
                  gross receipt) so it can be posted. No funds move until you Post; you can still
                  re-preview while in approved state if the underlying inputs change.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={approveSettlement.isPending || postSettlement.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmSettlementAction}
              disabled={approveSettlement.isPending || postSettlement.isPending}
              className={settlementConfirm === "post" ? "bg-primary" : undefined}
            >
              {settlementConfirm === "post"
                ? postSettlement.isPending
                  ? "Posting…"
                  : "Confirm Post"
                : approveSettlement.isPending
                  ? "Approving…"
                  : "Confirm Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
