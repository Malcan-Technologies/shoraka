"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowDownTrayIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { parseMoney } from "@cashsouk/ui";
import type { NoteDetail, NotePayment, NotePaymentSource } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "../hooks/use-notes";

type OverdueLateChargeResult = {
  overdue: boolean;
  dueDate: string | null;
  checkDate: string;
  gracePeriodDays: number;
  daysLate: number;
  receiptAmount: number;
  totalTawidhCap: number;
  totalGharamahCap: number;
  appliedTawidhAmount: number;
  appliedGharamahAmount: number;
  remainingTawidhAmount: number;
  remainingGharamahAmount: number;
  suggestedTawidhAmount: number;
  suggestedGharamahAmount: number;
  message: string;
};

type RecordPaymentSource = "PAYMASTER" | "ISSUER_ON_BEHALF";
type OverdueFeeInputMode = "AMOUNT" | "PERCENTAGE";

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function sourceLabel(source: NotePaymentSource) {
  const labels: Record<NotePaymentSource, string> = {
    PAYMASTER: "Paymaster",
    ISSUER_ON_BEHALF: "Issuer on behalf",
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

function getSettlementValue(settlement: Record<string, unknown>, key: string) {
  const value = settlement[key];
  if (typeof value === "string" || typeof value === "number" || value == null) {
    return parseMoney(value);
  }
  return 0;
}

function getOverdueSnapshot(note: NoteDetail) {
  if (!note.maturityDate) {
    return { daysPastMaturity: 0, daysOverdue: 0, label: "No maturity date set" };
  }
  const maturityDate = new Date(note.maturityDate);
  const today = new Date();
  const maturityStart = new Date(
    maturityDate.getFullYear(),
    maturityDate.getMonth(),
    maturityDate.getDate()
  );
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysPastMaturity = Math.max(
    0,
    Math.floor((todayStart.getTime() - maturityStart.getTime()) / 86_400_000)
  );
  const daysOverdue = Math.max(0, daysPastMaturity - note.gracePeriodDays);
  const label =
    daysOverdue > 0
      ? `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`
      : daysPastMaturity > 0
        ? `Within grace period (${Math.max(0, note.gracePeriodDays - daysPastMaturity)} days left)`
        : "Not overdue";
  return { daysPastMaturity, daysOverdue, label };
}

function getPreviousLateFeeSummary(note: NoteDetail) {
  const appliedBySettlement = note.settlements
    .filter((settlement) => settlement.status !== "VOID")
    .reduce(
      (sum, settlement) => sum + settlement.tawidhAmount + settlement.gharamahAmount,
      0
    );
  const submittedByIssuer = note.payments
    .filter((payment) => {
      const metadata = getPaymentMetadata(payment);
      return (
        payment.source === "ISSUER_ON_BEHALF" &&
        metadata?.paymentPurpose === "LATE_FEES" &&
        payment.status !== "VOID"
      );
    })
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  return { appliedBySettlement, submittedByIssuer };
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
  const [receiptAmount, setReceiptAmount] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [recordPaymentSource, setRecordPaymentSource] = React.useState<RecordPaymentSource>("PAYMASTER");
  const [tawidhAmount, setTawidhAmount] = React.useState("0");
  const [gharamahAmount, setGharamahAmount] = React.useState("0");
  const [overdueFeeInputMode, setOverdueFeeInputMode] = React.useState<OverdueFeeInputMode>("AMOUNT");
  const [overdueTawidhInput, setOverdueTawidhInput] = React.useState("0");
  const [overdueGharamahInput, setOverdueGharamahInput] = React.useState("0");
  const [overdueTawidhPercentInput, setOverdueTawidhPercentInput] = React.useState("0.00");
  const [overdueGharamahPercentInput, setOverdueGharamahPercentInput] = React.useState("0.00");
  const [selectedPaymentId, setSelectedPaymentId] = React.useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = React.useState<Record<string, string>>({});
  const [defaultReason, setDefaultReason] = React.useState("");
  const [recordPaymentDialogOpen, setRecordPaymentDialogOpen] = React.useState(false);
  const [overdueFeeDialogOpen, setOverdueFeeDialogOpen] = React.useState(false);
  const [preview, setPreview] = React.useState<Record<string, unknown> | null>(null);
  const [lateChargeResult, setLateChargeResult] = React.useState<OverdueLateChargeResult | null>(null);
  const recordPayment = useRecordNotePayment();
  const approvePayment = useApproveNotePayment();
  const rejectPayment = useRejectNotePayment();
  const checkOverdueLateCharge = useCheckOverdueLateCharge();
  const previewSettlement = usePreviewNoteSettlement();
  const approveSettlement = useApproveNoteSettlement();
  const postSettlement = usePostNoteSettlement();
  const arrearsLetter = useGenerateArrearsLetter();
  const defaultLetter = useGenerateDefaultLetter();
  const markDefault = useMarkNoteDefault();
  const { viewDocumentPending, handleViewDocument, handleDownloadDocument } =
    useAdminS3DocumentViewDownload();

  const settlementAmount = getSettlementAmount(note);
  const localPreviewSettlement =
    typeof preview?.settlementId === "string"
      ? {
          id: preview.settlementId,
          status: "PREVIEW" as const,
          grossReceiptAmount: Number(preview.grossReceiptAmount ?? 0),
        }
      : null;
  const persistedPreviewSettlement =
    note.settlements.find((settlement) => settlement.status === "PREVIEW") ?? null;
  const persistedApprovedSettlement =
    note.settlements.find((settlement) => settlement.status === "APPROVED") ?? null;
  const persistedPostedSettlement =
    note.settlements.find((settlement) => settlement.status === "POSTED") ?? null;
  const settlementLocked = persistedPostedSettlement ?? persistedApprovedSettlement;
  const servicingOpen = note.fundingStatus === "FUNDED" && note.servicingStatus !== "NOT_STARTED";
  const servicingBlockedReason = !servicingOpen
    ? note.fundingStatus !== "FUNDED"
      ? "Payment and settlement open only after the note reaches the funding threshold and funding is closed as funded."
      : "Payment and settlement open only after admin activates the funded note for servicing."
    : null;
  const previewSettlementCandidate = settlementLocked ? null : (localPreviewSettlement ?? persistedPreviewSettlement);
  const postSettlementCandidate = persistedApprovedSettlement;
  const approveSettlementId = previewSettlementCandidate?.id ?? null;
  const postSettlementId = postSettlementCandidate?.id ?? null;
  const activeSettlementGrossReceiptAmount =
    previewSettlementCandidate?.grossReceiptAmount ??
    postSettlementCandidate?.grossReceiptAmount ??
    persistedPostedSettlement?.grossReceiptAmount ??
    0;
  const canApproveSettlement =
    approveSettlementId != null &&
    settlementIsComplete(previewSettlementCandidate?.grossReceiptAmount ?? 0, settlementAmount);
  const canPostSettlement =
    postSettlementId != null &&
    settlementIsComplete(postSettlementCandidate?.grossReceiptAmount ?? 0, settlementAmount);
  const pendingIssuerPayments = note.payments.filter(
    (payment) => payment.source === "ISSUER_ON_BEHALF" && payment.status === "PENDING"
  );
  const settlementEligiblePayments = note.payments.filter((payment) =>
    ["RECEIVED", "RECONCILED", "PARTIAL"].includes(payment.status)
  );
  const selectedPayment = note.payments.find((payment) => payment.id === selectedPaymentId) ?? null;
  const generatedLetters = React.useMemo(() => {
    return note.events
      .filter((event) => event.eventType === "ARREARS_LETTER_GENERATED" || event.eventType === "DEFAULT_LETTER_GENERATED")
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
  const maturityDateLabel = formatMaturityDate(note.maturityDate);
  const maturityTimingLabel = formatMaturityTiming(note.maturityDate);
  const overdueSnapshot = getOverdueSnapshot(note);
  const previousLateFeeSummary = getPreviousLateFeeSummary(note);
  const pendingLateFeeTotal = (Number(tawidhAmount) || 0) + (Number(gharamahAmount) || 0);
  const settlementActionBlockedReason = servicingBlockedReason
    ? servicingBlockedReason
    : !previewSettlementCandidate && !postSettlementCandidate && !persistedPostedSettlement
      ? "Generate a settlement preview first."
      : !persistedPostedSettlement && !settlementIsComplete(activeSettlementGrossReceiptAmount, settlementAmount)
        ? `Recorded receipt is ${formatCurrency(activeSettlementGrossReceiptAmount)}. Full settlement amount ${formatCurrency(settlementAmount)} must be received before approval or posting.`
        : null;
  const settlementReadyMessage = canPostSettlement
    ? "Approved settlement is complete. Posting will create ledger entries."
    : canApproveSettlement
      ? "Settlement amount is complete. Approve the preview before posting."
      : persistedPostedSettlement
        ? "Settlement has been posted and ledger entries have been created."
      : null;
  const displayedSettlement = persistedPostedSettlement ?? postSettlementCandidate ?? preview ?? persistedPreviewSettlement;
  const displayedSettlementRecord = displayedSettlement as Record<string, unknown> | null;
  const waterfallGrossReceipt = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "grossReceiptAmount")
    : 0;
  const waterfallInvestorPrincipal = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "investorPrincipal")
    : 0;
  const waterfallInvestorProfitNet = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "investorProfitNet")
    : 0;
  const waterfallServiceFee = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "serviceFeeAmount")
    : 0;
  const waterfallTawidh = displayedSettlementRecord ? getSettlementValue(displayedSettlementRecord, "tawidhAmount") : 0;
  const waterfallGharamah = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "gharamahAmount")
    : 0;
  const waterfallIssuerResidual = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "issuerResidualAmount")
    : 0;
  const waterfallUnapplied = displayedSettlementRecord
    ? getSettlementValue(displayedSettlementRecord, "unappliedAmount")
    : 0;
  const waterfallInvestorPoolTotal = waterfallInvestorPrincipal + waterfallInvestorProfitNet;
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
      label: "Pay investor net profit",
      destination: "Investor Pool",
      amount: waterfallInvestorProfitNet,
      runningBalance: waterfallGrossReceipt - waterfallInvestorPrincipal - waterfallInvestorProfitNet,
      sign: "-",
    },
    {
      label: "Deduct service fee",
      destination: "Operating Account",
      amount: waterfallServiceFee,
      runningBalance:
        waterfallGrossReceipt - waterfallInvestorPrincipal - waterfallInvestorProfitNet - waterfallServiceFee,
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

  React.useEffect(() => {
    if (!receiptAmount && settlementAmount > 0) {
      setReceiptAmount(formatAmountInput(settlementAmount));
    }
  }, [receiptAmount, settlementAmount]);

  const handleUseSettlementAmount = () => {
    if (settlementAmount <= 0) {
      toast.error("Settlement amount is not available");
      return;
    }
    setReceiptAmount(formatAmountInput(settlementAmount));
    if (!settlementLocked) {
      setPreview(null);
    }
  };

  const handleRecordPayment = () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    const amount = Number(receiptAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid receipt amount");
      return;
    }
    setRecordPaymentDialogOpen(true);
  };

  const handleConfirmRecordPayment = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    const amount = Number(receiptAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid receipt amount");
      return;
    }
    try {
      const updatedNote = await recordPayment.mutateAsync({
        id: note.id,
        input: {
          source: recordPaymentSource as NotePaymentSource,
          receiptAmount: amount,
          receiptDate: new Date().toISOString(),
          reference: reference || null,
          metadata:
            recordPaymentSource === "ISSUER_ON_BEHALF"
              ? { paymentPurpose: "SETTLEMENT" }
              : null,
        },
      });
      const latestReceipt = updatedNote.payments[0];
      if (latestReceipt) {
        setSelectedPaymentId(latestReceipt.id);
      }
      setPreview(null);
      setRecordPaymentDialogOpen(false);
      setReference("");
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
    try {
      await approvePayment.mutateAsync({ id: note.id, paymentId: payment.id });
      setSelectedPaymentId(payment.id);
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
      toast.success("Issuer payment rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject payment");
    }
  };

  const handleCheckOverdueLateCharge = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    const amount = Number(receiptAmount);
    try {
      const result = await checkOverdueLateCharge.mutateAsync({
        id: note.id,
        input: {
          receiptAmount: Number.isFinite(amount) && amount > 0 ? amount : settlementAmount,
          receiptDate: new Date().toISOString(),
        },
      });
      setLateChargeResult(result);
      toast.success(result.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check overdue late fees");
    }
  };

  const handleOpenOverdueFeeDialog = async () => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    const amount = Number(receiptAmount);
    try {
      const result = await checkOverdueLateCharge.mutateAsync({
        id: note.id,
        input: {
          receiptAmount: Number.isFinite(amount) && amount > 0 ? amount : settlementAmount,
          receiptDate: new Date().toISOString(),
        },
      });
      setLateChargeResult(result);
      setOverdueTawidhInput(formatAmountInput(result.suggestedTawidhAmount));
      setOverdueGharamahInput(formatAmountInput(result.suggestedGharamahAmount));
      setOverdueTawidhPercentInput(
        formatPercentInput(calculatePercentFromAmount(result.suggestedTawidhAmount, result.receiptAmount))
      );
      setOverdueGharamahPercentInput(
        formatPercentInput(calculatePercentFromAmount(result.suggestedGharamahAmount, result.receiptAmount))
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
    setTawidhAmount(formatAmountInput(tawidh));
    setGharamahAmount(formatAmountInput(gharamah));
    setOverdueFeeDialogOpen(false);
    toast.success("Overdue fees applied to the settlement waterfall");
  };

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
    const amount = Number(receiptAmount);
    try {
      const result = await previewSettlement.mutateAsync({
        id: note.id,
        input: {
          paymentId: selectedPaymentId,
          receiptAmount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
          receiptDate: new Date().toISOString(),
          tawidhAmount: Number(tawidhAmount) || 0,
          gharamahAmount: Number(gharamahAmount) || 0,
        },
      });
      setPreview(result);
      toast.success("Settlement preview generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to preview settlement");
    }
  };

  const handleApprove = async () => {
    if (!approveSettlementId) return;
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    try {
      await approveSettlement.mutateAsync({ id: note.id, settlementId: approveSettlementId });
      setPreview(null);
      toast.success("Settlement approved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve settlement");
    }
  };

  const handlePost = async () => {
    if (!postSettlementId) return;
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    try {
      await postSettlement.mutateAsync({ id: note.id, settlementId: postSettlementId });
      setPreview(null);
      toast.success("Settlement posted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post settlement");
    }
  };

  const handleLetter = async (kind: "arrears" | "default") => {
    try {
      const result =
        kind === "arrears"
          ? await arrearsLetter.mutateAsync(note.id)
          : await defaultLetter.mutateAsync(note.id);
      toast.success(`${kind === "arrears" ? "Arrears" : "Default"} letter generated: ${result.s3Key}`);
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

  return (
    <>
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Servicing Lifecycle</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage maturity-driven servicing: receipts, late fees, settlement, arrears letters, and default actions.
            </p>
          </div>
          {pendingIssuerPayments.length > 0 ? (
            <Badge variant="secondary">{pendingIssuerPayments.length} pending review</Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border bg-primary/5 p-4 md:col-span-2 xl:col-span-1">
            <div className="text-xs text-muted-foreground">Settlement Amount Due</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{formatCurrency(settlementAmount)}</div>
            <p className="mt-2 text-xs text-muted-foreground">
              This is the invoice amount that must be paid into the Repayment Pool.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Maturity Date</div>
            <div className="mt-1 text-lg font-semibold">{maturityDateLabel}</div>
            <div className="mt-1 text-xs text-muted-foreground">{maturityTimingLabel}</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="text-xs text-muted-foreground">Grace and Arrears</div>
            <div className="mt-1 text-lg font-semibold">{note.gracePeriodDays} + {note.arrearsThresholdDays} days</div>
            <div className="mt-1 text-xs text-muted-foreground">Grace period plus arrears threshold</div>
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

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">1. Receipt Intake</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Record verified receipts and separately apply maturity-based overdue fees within the platform caps.
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleUseSettlementAmount}
              disabled={settlementAmount <= 0}
            >
              Use Settlement Amount
            </Button>
          </div>
          {servicingBlockedReason ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              {servicingBlockedReason}
            </div>
          ) : null}
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Record Payment</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Add a verified receipt from the paymaster or from the issuer paying on behalf of the paymaster.
                  </p>
                </div>
                <Badge variant="outline">{note.payments.length} receipts</Badge>
              </div>
              <div className="mt-4 space-y-3">
                <Input
                  value={receiptAmount}
                  onChange={(event) => setReceiptAmount(event.target.value)}
                  placeholder="Receipt amount"
                />
                <Button
                  className="w-full"
                  onClick={handleRecordPayment}
                  disabled={recordPayment.isPending || !servicingOpen}
                >
                  Record Payment
                </Button>
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-medium">Charge Overdue Fees</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Set Ta&apos;widh and Gharamah manually at receipt time, up to the remaining platform caps.
                  </p>
                </div>
                <Badge variant={overdueSnapshot.daysOverdue > 0 ? "secondary" : "outline"}>
                  {overdueSnapshot.label}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                <MoneyMetric label="Previously Applied Fees" value={previousLateFeeSummary.appliedBySettlement} />
                <MoneyMetric label="Late Fee Payments Submitted" value={previousLateFeeSummary.submittedByIssuer} />
              </div>
              {pendingLateFeeTotal > 0 ? (
                <div className="mt-3 rounded-lg border bg-primary/5 p-3 text-sm">
                  <div className="font-medium text-primary">
                    {formatCurrency(pendingLateFeeTotal)} queued for next settlement preview
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Ta&apos;widh {formatCurrency(Number(tawidhAmount) || 0)} · Gharamah {formatCurrency(Number(gharamahAmount) || 0)}
                  </div>
                </div>
              ) : null}
              {lateChargeResult ? (
                <p className="mt-3 text-xs text-muted-foreground">{lateChargeResult.message}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleCheckOverdueLateCharge}
                  disabled={checkOverdueLateCharge.isPending || !servicingOpen}
                >
                  Check Only
                </Button>
                <Button
                  onClick={handleOpenOverdueFeeDialog}
                  disabled={checkOverdueLateCharge.isPending || overdueSnapshot.daysOverdue <= 0 || !servicingOpen}
                >
                  Check and Charge
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">2. Payment Review</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Review issuer-submitted payments and select the receipt that should drive settlement.
              </p>
            </div>
            <Badge variant="outline">{note.payments.length} receipts</Badge>
          </div>
          {note.payments.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No payment receipts recorded yet.
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {note.payments.map((payment) => (
                <div
                  key={payment.id}
                  className={`rounded-lg border p-3 ${selectedPaymentId === payment.id ? "border-primary bg-primary/5" : "bg-card"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{formatCurrency(payment.receiptAmount)}</span>
                        <Badge variant={statusVariant(payment.status)}>{formatStatus(payment.status)}</Badge>
                        <Badge variant="outline">{sourceLabel(payment.source)}</Badge>
                        {Math.abs(payment.receiptAmount - settlementAmount) <= 0.005 ? (
                          <Badge variant="secondary">Matches settlement</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(payment.receiptDate), "dd MMM yyyy, h:mm a")}
                        {payment.reference ? ` · ${payment.reference}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Received into {payment.receivedIntoAccountCode}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {settlementEligiblePayments.some((item) => item.id === payment.id) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedPaymentId(payment.id)}
                        >
                          Use for Settlement
                        </Button>
                      ) : null}
                      {payment.status === "PENDING" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleApprovePayment(payment)}
                            disabled={approvePayment.isPending || !servicingOpen}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleRejectPayment(payment)}
                            disabled={rejectPayment.isPending}
                          >
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  {payment.status === "PENDING" ? (
                    <Input
                      className="mt-3"
                      value={rejectionReasons[payment.id] ?? ""}
                      onChange={(event) =>
                        setRejectionReasons((previous) => ({
                          ...previous,
                          [payment.id]: event.target.value,
                        }))
                      }
                      placeholder="Optional rejection reason"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">3. Settlement Waterfall</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Preview the allocation, approve it, then post ledger entries once the settlement is ready.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                onClick={handlePreview}
                disabled={previewSettlement.isPending || settlementLocked != null || !servicingOpen}
              >
                Preview
              </Button>
              <Button
                variant="outline"
                onClick={handleApprove}
                disabled={!canApproveSettlement || approveSettlement.isPending || !servicingOpen}
              >
                Approve
              </Button>
              <Button onClick={handlePost} disabled={!canPostSettlement || postSettlement.isPending || !servicingOpen}>
                Post
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {selectedPayment
              ? `Selected receipt: ${selectedPayment.reference ?? selectedPayment.id}`
              : "No receipt selected. Preview will use the entered receipt amount."}
          </p>
          {settlementActionBlockedReason ? (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              {settlementActionBlockedReason}
            </div>
          ) : settlementReadyMessage ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              {settlementReadyMessage}
            </div>
          ) : null}
          {displayedSettlement ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Waterfall Calculation</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Starts with the gross receipt, then deducts each allocation until the remaining balance is known.
                    </p>
                  </div>
                  <Badge variant="outline">Settlement due {formatCurrency(settlementAmount)}</Badge>
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
                        <span className={row.sign === "+" ? "text-emerald-700" : "text-muted-foreground"}>
                          {row.sign}
                        </span>{" "}
                        {row.label}
                      </div>
                      <div className="text-right text-xs text-muted-foreground">{row.destination}</div>
                      <div className="text-right font-medium">{formatCurrency(row.amount)}</div>
                      <div className="text-right font-medium">{formatCurrency(row.runningBalance)}</div>
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
                  description="Principal plus net profit returned to investors."
                />
                <PoolSummaryCard
                  label="Operating Account"
                  value={waterfallServiceFee}
                  description="Service fee retained by the platform."
                />
                <PoolSummaryCard
                  label="Ta'widh Account"
                  value={waterfallTawidh}
                  description="Compensation portion of late charges."
                />
                <PoolSummaryCard
                  label="Gharamah Account"
                  value={waterfallGharamah}
                  description="Charity/penalty portion of late charges."
                />
              </div>
              <div className="rounded-xl border border-dashed bg-muted/20 p-3 text-sm">
                <span className="font-medium">Issuer residual refund:</span>{" "}
                {formatCurrency(waterfallIssuerResidual)} is returned to the issuer after investor allocation,
                service fee, and late-fee accounts are applied.
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No settlement preview generated yet.
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">4. Arrears and Default Documents</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Generate lifecycle letters tied to the maturity, grace, arrears, and default workflow.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => handleLetter("arrears")} disabled={arrearsLetter.isPending}>
                Generate Arrears Letter
              </Button>
              <Button variant="outline" onClick={() => handleLetter("default")} disabled={defaultLetter.isPending}>
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
            <Button variant="destructive" onClick={handleMarkDefault} disabled={markDefault.isPending}>
              Mark Default
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    <Dialog open={recordPaymentDialogOpen} onOpenChange={setRecordPaymentDialogOpen}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Paymaster Receipt?</DialogTitle>
          <DialogDescription className="text-[15px] leading-7">
            Confirm the verified receipt before it is added to this note. This creates a payment record that can be used for settlement preview.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-2xl border bg-primary/5 p-4">
            <div className="text-xs text-muted-foreground">Receipt amount</div>
            <div className="mt-1 text-2xl font-semibold text-primary">
              {formatCurrency(Number(receiptAmount) || 0)}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              Settlement amount due: {formatCurrency(settlementAmount)}
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
                <SelectItem value="PAYMASTER">Paymaster</SelectItem>
                <SelectItem value="ISSUER_ON_BEHALF">Issuer on behalf of paymaster</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="admin-payment-reference">
              Payment reference
            </label>
            <Input
              id="admin-payment-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="Bank transfer reference or receipt number"
            />
          </div>
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
            {recordPayment.isPending ? "Recording..." : "Confirm Record Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={overdueFeeDialogOpen} onOpenChange={setOverdueFeeDialogOpen}>
      <DialogContent className="rounded-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Charge Overdue Fees?</DialogTitle>
          <DialogDescription className="text-[15px] leading-7">
            Set the Ta&apos;widh and Gharamah amounts to include in the next settlement waterfall. Amounts cannot exceed the remaining caps calculated from today&apos;s overdue check.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-3">
              <div className="text-xs text-muted-foreground">Overdue days</div>
              <div className="mt-1 font-semibold">{lateChargeResult?.daysLate ?? overdueSnapshot.daysOverdue}</div>
              <div className="mt-1 text-xs text-muted-foreground">After grace period</div>
            </div>
            <MoneyMetric label="Remaining Ta'widh Cap" value={lateChargeResult?.remainingTawidhAmount ?? 0} />
            <MoneyMetric label="Remaining Gharamah Cap" value={lateChargeResult?.remainingGharamahAmount ?? 0} />
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
                htmlFor={overdueFeeInputMode === "PERCENTAGE" ? "overdue-tawidh-percent" : "overdue-tawidh-amount"}
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
                  onBlur={() => setOverdueTawidhPercentInput(formatPercentInput(parseMoney(overdueTawidhPercentInput)))}
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
                  onBlur={() => setOverdueTawidhInput(formatAmountInput(parseMoney(overdueTawidhInput)))}
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
                htmlFor={overdueFeeInputMode === "PERCENTAGE" ? "overdue-gharamah-percent" : "overdue-gharamah-amount"}
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
                  onBlur={() => setOverdueGharamahPercentInput(formatPercentInput(parseMoney(overdueGharamahPercentInput)))}
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
                  onBlur={() => setOverdueGharamahInput(formatAmountInput(parseMoney(overdueGharamahInput)))}
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
              Total to apply: {formatCurrency(overdueTawidhPreviewAmount + overdueGharamahPreviewAmount)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Ta&apos;widh {formatCurrency(overdueTawidhPreviewAmount)} · Gharamah {formatCurrency(overdueGharamahPreviewAmount)}
            </div>
          </div>
          <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
            These fees are not posted immediately. They are queued into the settlement preview so admin can review the full waterfall before approving and posting.
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
            Apply to Settlement Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

