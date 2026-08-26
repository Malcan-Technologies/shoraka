"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowRightCircleIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import { WithdrawalType, formatWithdrawalReference } from "@cashsouk/types";
import { StatusBadge } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { DisbursementValueDateField } from "@/notes/components/disbursement-value-date-field";
import {
  defaultDisbursementValueDate,
  disbursementValueDateError,
  noteNeedsDisbursementValueDate,
} from "@/notes/utils/disbursement-value-date";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useGenerateWithdrawalLetter,
  useMarkWithdrawalCompleted,
  useMarkWithdrawalSubmitted,
  useResendWithdrawalTrusteeEmail,
  useUpdateWithdrawalBeneficiary,
  useFetchShorakaCertificate,
  useQueryShorakaStatus,
  useShorakaWithdrawalState,
  useSubmitShorakaOrder,
} from "@/notes/hooks/use-notes";
import { useAdminS3DocumentViewDownload } from "@/hooks/use-admin-s3-document-view-download";
import { cn } from "@/lib/utils";
import { notesKeys } from "@/notes/query-keys";
import {
  formatTrusteeInstructionEmailedAt,
  formatTrusteeInstructionEmailedCopy,
  TRUSTEE_EMAIL_DELIVERED_LABEL,
} from "@/lib/trustee-letter-sent-state";
import {
  canResendWithdrawalTrusteeEmail,
  getTrusteeResendCopy,
} from "@/lib/trustee-letter-resend";
import { getTrusteeSubmitCopy } from "@/lib/trustee-letter-submit-copy";
import {
  BeneficiaryDetailsBlock,
  CollapsibleDetailTimeline,
  PoolSummaryCard,
  WorkflowStepTitle,
} from "@/notes/components/note-detail-ui-blocks";
import {
  WORKFLOW_CARD,
  WORKFLOW_SUCCESS_COPY,
  tawarruqWorkflowTone,
  withdrawalWorkflowTone,
  workflowTaskSurfaceClass,
  workflowToneToStatusToken,
} from "@/notes/utils/workflow-status-tokens";

type BeneficiaryFields = {
  bank_name: string;
  account_number: string;
  account_holder: string;
  swift_code: string;
  branch: string;
  reference_note: string;
};

const BENEFICIARY_LABELS: Record<keyof BeneficiaryFields, string> = {
  bank_name: "Bank Name",
  account_number: "Account Number",
  account_holder: "Account Holder",
  swift_code: "SWIFT / BIC Code",
  branch: "Branch",
  reference_note: "Reference / Note",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function snapshotToFields(snapshot: Record<string, unknown> | null | undefined): BeneficiaryFields {
  const src = snapshot ?? {};
  return {
    bank_name: asString(src.bank_name ?? src.bankName),
    account_number: asString(src.account_number ?? src.accountNumber),
    account_holder: asString(src.account_holder ?? src.accountHolder ?? src.beneficiary_name),
    swift_code: asString(src.swift_code ?? src.swiftCode),
    branch: asString(src.branch ?? src.branch_name ?? src.branchName),
    reference_note: asString(src.reference_note ?? src.note),
  };
}

const STATUS_COPY: Record<
  WithdrawalInstruction["status"],
  { label: string; tone: ReturnType<typeof withdrawalWorkflowTone> }
> = {
  DRAFT: { label: "Not generated", tone: "active" },
  LETTER_GENERATED: { label: "Pending trustee submission", tone: "active" },
  SUBMITTED_TO_TRUSTEE: { label: "Submitted to trustee", tone: "warning" },
  COMPLETED: { label: "Disbursed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

function withdrawalTrusteeDescription(
  status: WithdrawalInstruction["status"],
  kind: IssuerPayoutKind
): string {
  if (status === "LETTER_GENERATED") {
    return "Trustee instruction letter has been generated. Submit it to the trustee, then mark it as submitted.";
  }
  if (status === "SUBMITTED_TO_TRUSTEE") {
    return kind === "DISBURSEMENT"
      ? "Trustee instruction has been submitted. Mark disbursed once the trustee confirms payout."
      : "Trustee instruction has been submitted. Mark complete once the trustee confirms payout.";
  }
  if (status === "COMPLETED") {
    return "Trustee submission is complete.";
  }
  return kind === "DISBURSEMENT"
    ? "Generate the trustee instruction letter for the posted funding disbursement."
    : "Generate the trustee instruction letter for the issuer residual refund.";
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr] gap-x-3 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-foreground", valueClassName)}>{value}</dd>
    </div>
  );
}

type ShorakaOperationalStep = {
  status: string;
  nextAction: string;
};

function resolveShorakaOperationalStep(
  providerStatus: string,
  hasCertificate: boolean
): ShorakaOperationalStep {
  if (providerStatus === "Active") {
    return { status: "Matching in progress", nextAction: "Query status again later" };
  }
  if (providerStatus === "Pending Sell") {
    return {
      status: "Pending sell",
      nextAction: "Query status again later; contact operations if stuck",
    };
  }
  if (providerStatus === "Completed" && !hasCertificate) {
    return { status: "Completed", nextAction: "Fetch certificate" };
  }
  if (providerStatus === "Completed" && hasCertificate) {
    return {
      status: "Certificate ready",
      nextAction: "You may proceed with disbursement",
    };
  }
  return {
    status: "Manual review required",
    nextAction: "Check with Tawarruq operations",
  };
}

const ACTION_CARD_CLASS = WORKFLOW_CARD.activeSection;
const SECTION_COMPLETE_CLASS = WORKFLOW_CARD.successSection;

type IssuerPayoutKind = "DISBURSEMENT" | "RESIDUAL";

interface IssuerPayoutCardProps {
  note: NoteDetail;
  withdrawal: WithdrawalInstruction;
  kind: IssuerPayoutKind;
  servicingBlockedReason: string | null;
  canManage?: boolean;
}

const KIND_COPY: Record<
  IssuerPayoutKind,
  {
    title: string;
    description: string;
    completeConfirm: (amount: string) => string;
  }
> = {
  DISBURSEMENT: {
    title: "Issuer Disbursement",
    description:
      "Net funded proceeds owed to the issuer at funding close. Disbursed from the Investor Pool via the Issuer Payable ledger account.",
    completeConfirm: (amount) =>
      `Confirm that the trustee has disbursed ${amount} to the issuer. This will clear the Issuer Payable obligation on the ledger and flip the note from FUNDING to ACTIVE so servicing can begin. This action cannot be undone.`,
  },
  RESIDUAL: {
    title: "Issuer Residual Refund",
    description:
      "Residual amount owed to the issuer after investor allocation, service fee, and late-fee accounts. Issued from the Repayment Pool via the Issuer Payable ledger account.",
    completeConfirm: (amount) =>
      `Confirm that the trustee has disbursed ${amount} to the issuer. This will clear the Issuer Payable obligation on the ledger and flip the note to REPAID. This action cannot be undone.`,
  },
};

export function IssuerPayoutCard({
  note,
  withdrawal,
  kind,
  servicingBlockedReason,
  canManage = true,
}: IssuerPayoutCardProps) {
  const queryClient = useQueryClient();
  const kindCopy = KIND_COPY[kind];
  const generateLetter = useGenerateWithdrawalLetter();
  const markSubmitted = useMarkWithdrawalSubmitted();
  const resendTrusteeEmail = useResendWithdrawalTrusteeEmail();
  const markCompleted = useMarkWithdrawalCompleted();
  const updateBeneficiary = useUpdateWithdrawalBeneficiary();
  const { handleViewDocument, handleDownloadDocument, viewDocumentPending } =
    useAdminS3DocumentViewDownload();

  const shorakaStateQuery = useShorakaWithdrawalState(withdrawal.id);
  const submitShorakaOrder = useSubmitShorakaOrder(withdrawal.id);
  const queryShorakaStatus = useQueryShorakaStatus(withdrawal.id);
  const fetchShorakaCertificate = useFetchShorakaCertificate(withdrawal.id);

  const shorakaUnsafeSubmitWindowMessage =
    "Tawarruq orders cannot be submitted between 11:30 PM and 12:30 AM MYT because orders may remain Active and require cancellation. Please submit after 12:30 AM.";
  const isMalaysiaUnsafeShorakaSubmitWindow = (() => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return (hour === 23 && minute >= 30) || (hour === 0 && minute >= 0 && minute < 30);
  })();

  const shorakaTradeOrder = shorakaStateQuery.data?.tradeOrder ?? null;
  const hasShorakaCertificate = Boolean(shorakaTradeOrder?.certificate_s3_key);
  const shorakaOperationalStep = shorakaStateQuery.data
    ? resolveShorakaOperationalStep(
        shorakaStateQuery.data.operationalStatus.providerStatus,
        Boolean(shorakaStateQuery.data.tradeOrder.certificate_s3_key)
      )
    : null;
  const shouldGateMarkDisbursed =
    withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT;

  const markDisbursedDisabledBecauseShoraka =
    shouldGateMarkDisbursed &&
    (shorakaStateQuery.isPending ||
      shorakaStateQuery.isError ||
      !shorakaTradeOrder ||
      !hasShorakaCertificate);

  const markDisbursedHelperText =
    shouldGateMarkDisbursed && (shorakaStateQuery.isPending || shorakaStateQuery.isError || !hasShorakaCertificate) ? (
      shorakaStateQuery.isPending ? (
        "Checking Tawarruq certificate status…"
      ) : shorakaStateQuery.isError ? (
        "Unable to verify Tawarruq transaction status. Please refresh or try again."
      ) : (
        "Tawarruq Certificate must be fetched before marking issuer disbursement as completed."
      )
    ) : null;

  const generateLetterDisabledBecauseShoraka =
    shouldGateMarkDisbursed &&
    (shorakaStateQuery.isPending ||
      shorakaStateQuery.isError ||
      !shorakaTradeOrder ||
      !hasShorakaCertificate);

  const generateLetterHelperText =
    shouldGateMarkDisbursed && generateLetterDisabledBecauseShoraka ? (
      shorakaStateQuery.isPending ? (
        "Checking Tawarruq certificate status…"
      ) : shorakaStateQuery.isError ? (
        "Unable to verify Tawarruq certificate status. Please refresh and try again."
      ) : (
        "Tawarruq Certificate must be fetched before generating the trustee letter."
      )
    ) : null;

  const [confirmAction, setConfirmAction] = React.useState<
    "generate" | "submit" | "resend" | "complete" | null
  >(null);
  const [beneficiaryDialogOpen, setBeneficiaryDialogOpen] = React.useState(false);
  const [beneficiaryDraft, setBeneficiaryDraft] = React.useState<BeneficiaryFields>(() =>
    snapshotToFields(withdrawal.beneficiarySnapshot)
  );
  const requiresDisbursementDate =
    kind === "DISBURSEMENT" && noteNeedsDisbursementValueDate(note);
  const [disbursementValueDate, setDisbursementValueDate] = React.useState("");
  const [disbursementDateError, setDisbursementDateError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!beneficiaryDialogOpen) {
      setBeneficiaryDraft(snapshotToFields(withdrawal.beneficiarySnapshot));
    }
  }, [withdrawal.beneficiarySnapshot, beneficiaryDialogOpen]);

  const status = withdrawal.status;
  const trusteeSubmitCopy = getTrusteeSubmitCopy(note.trusteeAutoSendEmailEnabled === true);
  const trusteeResendCopy = getTrusteeResendCopy();
  const canResendTrusteeEmail = canResendWithdrawalTrusteeEmail(
    withdrawal.trusteeEmailSentAt,
    status
  );
  const trusteeEmailedCopy = formatTrusteeInstructionEmailedCopy(withdrawal.trusteeEmailSentAt);
  const trusteeEmailedAt = formatTrusteeInstructionEmailedAt(withdrawal.trusteeEmailSentAt);
  const withdrawalReference = formatWithdrawalReference({
    displayReference: withdrawal.displayReference,
    id: withdrawal.id,
  });
  const statusCopy = STATUS_COPY[status] ?? STATUS_COPY.DRAFT;
  const trusteeBadgeTone = withdrawalWorkflowTone(status);
  const tawarruqTone = shorakaStateQuery.isPending
    ? tawarruqWorkflowTone("checking")
    : hasShorakaCertificate
      ? tawarruqWorkflowTone("certificate-ready")
      : shorakaStateQuery.data == null
        ? tawarruqWorkflowTone("not-submitted")
        : tawarruqWorkflowTone("in-progress");
  const currentFields = snapshotToFields(withdrawal.beneficiarySnapshot);
  const beneficiaryComplete =
    currentFields.bank_name.trim() !== "" && currentFields.account_number.trim() !== "";
  const payoutComplete = status === "COMPLETED";
  const payoutTone = withdrawalWorkflowTone(status);
  const disbursementFlowStep: "tawarruq" | "trustee" | "disbursed" | null =
    kind === "DISBURSEMENT" &&
    withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT &&
    !payoutComplete
      ? status === "SUBMITTED_TO_TRUSTEE"
        ? "disbursed"
        : hasShorakaCertificate
          ? "trustee"
          : "tawarruq"
      : null;
  const workflowInProgress = !payoutComplete && status !== "CANCELLED";
  const guardedAction = (run: () => void) => {
    if (servicingBlockedReason) {
      toast.info(servicingBlockedReason);
      return;
    }
    run();
  };

  const confirmRun = async () => {
    if (!confirmAction) return;
    try {
      if (confirmAction === "generate") {
        if (!beneficiaryComplete) {
          toast.error(
            "Add at least the issuer bank name and account number before generating the letter."
          );
          return;
        }
        if (generateLetterDisabledBecauseShoraka) {
          toast.error(generateLetterHelperText ?? "Tawarruq Certificate is required.");
          return;
        }
        await generateLetter.mutateAsync(withdrawal.id);
        toast.success("Trustee letter generated");
      } else if (confirmAction === "submit") {
        await markSubmitted.mutateAsync(withdrawal.id);
        toast.success(trusteeSubmitCopy.success);
      } else if (confirmAction === "resend") {
        await resendTrusteeEmail.mutateAsync(withdrawal.id);
        toast.success(trusteeResendCopy.success);
      } else if (confirmAction === "complete") {
        if (requiresDisbursementDate) {
          const dateError = disbursementValueDateError(disbursementValueDate);
          if (dateError) {
            setDisbursementDateError(dateError);
            return;
          }
          await markCompleted.mutateAsync({
            id: withdrawal.id,
            disbursementValueDate,
          });
        } else {
          await markCompleted.mutateAsync(withdrawal.id);
        }
        toast.success(
          kind === "DISBURSEMENT"
            ? "Issuer disbursement recorded — note is now active"
            : "Issuer residual disbursement recorded"
        );
      }
      setConfirmAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleSaveBeneficiary = async () => {
    try {
      await updateBeneficiary.mutateAsync({
        id: withdrawal.id,
        beneficiarySnapshot: { ...currentFields, ...beneficiaryDraft },
      });
      toast.success("Beneficiary details updated");
      setBeneficiaryDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update beneficiary");
    }
  };

  const letterDownloadFileName = `issuer-disbursement-trustee-${note.noteReference ?? note.id}-${withdrawal.id}.pdf`;

  const pendingAny =
    generateLetter.isPending ||
    markSubmitted.isPending ||
    resendTrusteeEmail.isPending ||
    markCompleted.isPending ||
    updateBeneficiary.isPending;

  const confirmCopy =
    confirmAction === "generate"
      ? {
          title: "Generate trustee letter?",
          description: `Generate a PDF instruction letter for the trustee to disburse ${formatCurrency(
            withdrawal.amount
          )} to the issuer. The withdrawal will move to "Letter generated". You can re-edit beneficiary details only while it is still in Draft.`,
          confirmLabel: "Generate Letter",
        }
      : confirmAction === "submit"
        ? {
            title: trusteeSubmitCopy.confirmTitle,
            description: trusteeSubmitCopy.description,
            confirmLabel: trusteeSubmitCopy.confirmLabel,
          }
        : confirmAction === "resend"
          ? {
              title: trusteeResendCopy.confirmTitle,
              description: trusteeResendCopy.description,
              confirmLabel: trusteeResendCopy.confirmLabel,
            }
        : confirmAction === "complete"
          ? {
              title:
                kind === "DISBURSEMENT"
                  ? "Mark issuer disbursement complete?"
                  : "Mark issuer residual disbursement complete?",
              description: kindCopy.completeConfirm(formatCurrency(withdrawal.amount)),
              confirmLabel: "Confirm Complete",
            }
          : null;

  const statusPanelTitle = kind === "DISBURSEMENT" ? "Issuer disbursement" : kindCopy.title;

  const statusPanelDescription = payoutComplete
    ? kind === "DISBURSEMENT"
      ? "Net funded proceeds have been disbursed to the issuer."
      : "Residual refund has been disbursed to the issuer."
    : kind === "DISBURSEMENT"
      ? "Funding has closed. Pay out the net amount to the issuer via the trustee before servicing begins."
      : kindCopy.description;

  const overviewSurfaceClass = payoutComplete
    ? SECTION_COMPLETE_CLASS
    : workflowInProgress
      ? workflowTaskSurfaceClass(payoutTone)
      : "border-border bg-card";

  return (
    <>
    <div className="space-y-6">
      <div className={cn("rounded-xl border p-4", overviewSurfaceClass)}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <WorkflowStepTitle
                complete={payoutComplete}
                completeLabel={
                  kind === "DISBURSEMENT"
                    ? "Issuer disbursement complete"
                    : "Issuer residual refund complete"
                }
                className="font-semibold"
              >
                {statusPanelTitle}
              </WorkflowStepTitle>
            </div>
            <p
              className={cn(
                "mt-0.5 text-xs",
                payoutComplete ? WORKFLOW_SUCCESS_COPY.body : "text-muted-foreground"
              )}
            >
              {statusPanelDescription}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Reference: <span className="font-mono">{withdrawalReference}</span>
            </p>
            {disbursementFlowStep ? (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Flow:{" "}
                <span
                  className={cn(disbursementFlowStep === "tawarruq" && "font-medium text-foreground")}
                >
                  Tawarruq certificate
                </span>
                {" → "}
                <span
                  className={cn(disbursementFlowStep === "trustee" && "font-medium text-foreground")}
                >
                  Trustee instruction
                </span>
                {" → "}
                <span
                  className={cn(
                    disbursementFlowStep === "disbursed" && "font-medium text-foreground"
                  )}
                >
                  Mark disbursed
                </span>
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] text-muted-foreground">
              {kind === "DISBURSEMENT" ? "Net to issuer" : "Amount"}
            </div>
            <div className="text-base font-semibold tabular-nums text-primary">
              {formatCurrency(withdrawal.amount)}
            </div>
          </div>
        </div>

      {withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT &&
      withdrawal.grossFundedAmount != null &&
      withdrawal.platformFeeAmount != null &&
      withdrawal.netIssuerDisbursement != null ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-muted-foreground">Disbursement summary</div>
          <p className="text-[11px] text-muted-foreground">
            Final amounts used to calculate issuer disbursement.
          </p>
          <div className="mt-1.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-4">
            <PoolSummaryCard
              label="Gross funded"
              value={withdrawal.grossFundedAmount}
              description="Total funded amount before deductions."
            />
            <PoolSummaryCard
              label="Drawdown fee"
              value={withdrawal.platformFeeAmount}
              description="Drawdown fee deducted from funded amount."
            />
            {withdrawal.facilityFeeCharged != null ? (
              <PoolSummaryCard
                label="Facility fee"
                value={withdrawal.facilityFeeCharged}
                description={
                  withdrawal.facilityFeeCollectionWaived
                    ? "Facility fee collection was waived for this note."
                    : "Facility fee deducted from funded amount, if applicable."
                }
              />
            ) : null}
            {(withdrawal.additionalFees ?? []).map((line) => (
              <PoolSummaryCard
                key={`${line.name}-${line.kind}`}
                label={line.name}
                value={line.chargedAmount}
                description={
                  line.kind === "percent_of_funded"
                    ? `${line.value}% of actual funds raised.`
                    : "Fixed amount deducted from funded amount."
                }
              />
            ))}
            <PoolSummaryCard
              label="Net to issuer"
              value={withdrawal.netIssuerDisbursement}
              description="Final amount disbursed to issuer."
              emphasized
            />
          </div>
        </div>
      ) : null}
      </div>

      {withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT ? (
        <div className={cn("rounded-xl border p-4", workflowTaskSurfaceClass(tawarruqTone))}>
          <div className="flex flex-wrap items-center gap-2">
            <WorkflowStepTitle
              complete={tawarruqTone === "success"}
              completeLabel="1. Tawarruq complete"
            >
              1. Tawarruq transaction
            </WorkflowStepTitle>
            {tawarruqTone === "success" ? null : shorakaStateQuery.isPending ? (
              <StatusBadge label="Checking…" status="neutral" />
            ) : hasShorakaCertificate ? (
              <StatusBadge
                label="Certificate ready"
                status={workflowToneToStatusToken(tawarruqTone)}
              />
            ) : shorakaStateQuery.data == null ? (
              <StatusBadge
                label="Not submitted"
                status={workflowToneToStatusToken(tawarruqTone)}
              />
            ) : (
              <StatusBadge
                label="In progress"
                status={workflowToneToStatusToken(tawarruqTone)}
              />
            )}
          </div>
          {hasShorakaCertificate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tawarruq certificate fetched and stored.
            </p>
          ) : null}

          {shorakaStateQuery.isPending ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Checking Tawarruq certificate status…
            </p>
          ) : shorakaStateQuery.data == null ? (
            <dl className="mt-2 space-y-1">
              <DetailRow label="Status" value="Not submitted" valueClassName="font-medium" />
            </dl>
          ) : shorakaOperationalStep && shorakaStateQuery.data ? (
            <>
              {(() => {
                const state = shorakaStateQuery.data;
                const tradeOrder = state.tradeOrder;
                const parsed = state.parsed;
                const step = shorakaOperationalStep;

                const callbackReceivedAt = tradeOrder.callback_received_at
                  ? new Date(tradeOrder.callback_received_at)
                  : null;
                const statusLastCheckedAt = tradeOrder.status_last_checked_at
                  ? new Date(tradeOrder.status_last_checked_at)
                  : null;

                const statusSource = callbackReceivedAt
                  ? statusLastCheckedAt &&
                      callbackReceivedAt.getTime() < statusLastCheckedAt.getTime()
                    ? "Updated by status query"
                    : "Updated by callback"
                  : null;

                return (
                  <>
                    <div className="mt-2 text-xs font-medium text-muted-foreground">Order details</div>
                    <dl className="mt-1 space-y-1">
                      <DetailRow label="Status" value={step.status} valueClassName="font-medium" />
                      {tradeOrder.provider_order_id ? (
                        <DetailRow
                          label="Order ID"
                          value={tradeOrder.provider_order_id}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {parsed.orderDate ? (
                        <DetailRow
                          label="Order date"
                          value={parsed.orderDate}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {parsed.valueDate ? (
                        <DetailRow
                          label="Value date"
                          value={parsed.valueDate}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {parsed.orderAmount ? (
                        <DetailRow
                          label="Order amount"
                          value={parsed.orderAmount}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {parsed.murabahaAmount ? (
                        <DetailRow
                          label="Murabaha amount"
                          value={parsed.murabahaAmount}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {statusSource ? (
                        <DetailRow
                          label="Status source"
                          value={statusSource}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {tradeOrder.callback_received_at ? (
                        <DetailRow
                          label="Callback received"
                          value={format(
                            new Date(tradeOrder.callback_received_at),
                            "dd MMM yyyy, h:mm a"
                          )}
                          valueClassName="font-medium"
                        />
                      ) : null}
                      {tradeOrder.status_last_checked_at ? (
                        <DetailRow
                          label="Last checked"
                          value={format(
                            new Date(tradeOrder.status_last_checked_at),
                            "dd MMM yyyy, h:mm a"
                          )}
                          valueClassName="font-medium"
                        />
                      ) : null}
                    </dl>
                    {parsed.orderDate || parsed.valueDate ? (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Order date = Tawarruq trade submission date. Value date = intended
                        disbursement date.
                      </p>
                    ) : null}
                    {state.cutoffWarning ? (
                      <div
                        className={cn(
                          "mt-2 rounded border px-2 py-1.5 text-xs text-status-action-text",
                          ACTION_CARD_CLASS
                        )}
                      >
                        {state.cutoffWarning}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </>
          ) : null}

          {isMalaysiaUnsafeShorakaSubmitWindow && shorakaStateQuery.data == null ? (
            <div
              className={cn(
                "mt-2 rounded border px-2 py-1.5 text-xs text-status-action-text",
                ACTION_CARD_CLASS
              )}
            >
              {shorakaUnsafeSubmitWindowMessage}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
            {shorakaStateQuery.data == null ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    if (servicingBlockedReason) {
                      toast.info(servicingBlockedReason);
                      return;
                    }
                    await submitShorakaOrder.mutateAsync();
                    toast.success("Tawarruq order submitted");
                    queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to submit Tawarruq order"
                    );
                  }
                }}
                disabled={
                  submitShorakaOrder.isPending || isMalaysiaUnsafeShorakaSubmitWindow || !canManage
                }
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                Submit Tawarruq Order
              </Button>
            ) : null}
            {shorakaStateQuery.data != null &&
            (shorakaStateQuery.data.operationalStatus.providerStatus === "Active" ||
              shorakaStateQuery.data.operationalStatus.providerStatus === "Pending Sell") ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    if (servicingBlockedReason) {
                      toast.info(servicingBlockedReason);
                      return;
                    }
                    await queryShorakaStatus.mutateAsync();
                    toast.success("Tawarruq transaction status queried");
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "Failed to query Tawarruq transaction status"
                    );
                  }
                }}
                disabled={queryShorakaStatus.isPending || !canManage}
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                Query Status
              </Button>
            ) : null}
            {shorakaStateQuery.data?.operationalStatus.canFetchCertificate ? (
              <Button
                size="sm"
                onClick={async () => {
                  try {
                    if (servicingBlockedReason) {
                      toast.info(servicingBlockedReason);
                      return;
                    }
                    await fetchShorakaCertificate.mutateAsync();
                    toast.success("Tawarruq certificate fetched");
                    queryClient.invalidateQueries({ queryKey: notesKeys.detail(note.id) });
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to fetch certificate");
                  }
                }}
                disabled={fetchShorakaCertificate.isPending || !canManage}
                title={!canManage ? "You do not have permission to perform this action." : undefined}
              >
                Fetch Tawarruq Certificate
              </Button>
            ) : null}
            {shorakaTradeOrder?.certificate_s3_key ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => {
                  const key = shorakaTradeOrder.certificate_s3_key;
                  if (!key) return;
                  void handleViewDocument(key);
                }}
                disabled={viewDocumentPending}
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                View Tawarruq Certificate
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={cn("rounded-xl border p-4", workflowTaskSurfaceClass(trusteeBadgeTone))}>
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowStepTitle
            complete={payoutComplete}
            completeLabel={
              kind === "DISBURSEMENT"
                ? "2. Trustee instruction complete"
                : "Trustee instruction complete"
            }
          >
            {kind === "DISBURSEMENT" ? "2. Trustee instruction" : "Trustee instruction"}
          </WorkflowStepTitle>
          {payoutComplete ? null : (
            <StatusBadge
              label={status === "DRAFT" ? "Not generated" : statusCopy.label}
              status={workflowToneToStatusToken(trusteeBadgeTone)}
            />
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {withdrawalTrusteeDescription(status, kind)}
        </p>
        {trusteeEmailedCopy ? (
          <p className="mt-1 text-meta text-muted-foreground">{trusteeEmailedCopy}</p>
        ) : null}
        {withdrawal.letterS3Key && withdrawal.generatedAt ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <DocumentTextIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium text-foreground">Issuer disbursement instruction</span>
            <span aria-hidden>·</span>
            <span>{format(new Date(withdrawal.generatedAt), "dd MMM yyyy, h:mm a")}</span>
          </div>
        ) : null}
        {status === "DRAFT" && generateLetterHelperText ? (
          <p className="mt-2 text-xs text-muted-foreground">{generateLetterHelperText}</p>
        ) : null}
        {status === "SUBMITTED_TO_TRUSTEE" && markDisbursedHelperText ? (
          <p className="mt-2 text-xs text-muted-foreground">{markDisbursedHelperText}</p>
        ) : null}
        <BeneficiaryDetailsBlock
          accountHolder={
            currentFields.account_holder || <span className="text-status-action-text">missing</span>
          }
          bankName={currentFields.bank_name || <span className="text-status-action-text">missing</span>}
          accountNumber={
            currentFields.account_number || <span className="text-status-action-text">missing</span>
          }
          showEdit={status === "DRAFT" && canManage}
          onEdit={() => setBeneficiaryDialogOpen(true)}
        />
        <CollapsibleDetailTimeline
          rows={[
            {
              label: "Created",
              value: format(new Date(withdrawal.createdAt), "dd MMM yyyy, h:mm a"),
            },
            ...(withdrawal.generatedAt
              ? [
                  {
                    label: "Letter generated",
                    value: format(new Date(withdrawal.generatedAt), "dd MMM yyyy, h:mm a"),
                  },
                ]
              : []),
            ...(withdrawal.submittedToTrusteeAt
              ? [
                  {
                    label: "Submitted to trustee",
                    value: format(
                      new Date(withdrawal.submittedToTrusteeAt),
                      "dd MMM yyyy, h:mm a"
                    ),
                  },
                ]
              : []),
            ...(trusteeEmailedAt
              ? [
                  {
                    label: TRUSTEE_EMAIL_DELIVERED_LABEL,
                    value: trusteeEmailedAt,
                  },
                ]
              : []),
            ...(withdrawal.completedAt
              ? [
                  {
                    label: "Completed",
                    value: format(new Date(withdrawal.completedAt), "dd MMM yyyy, h:mm a"),
                  },
                ]
              : []),
          ]}
        />
        <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          {withdrawal.letterS3Key ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => void handleViewDocument(withdrawal.letterS3Key!)}
                disabled={viewDocumentPending}
              >
                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                View
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() =>
                  void handleDownloadDocument(withdrawal.letterS3Key!, letterDownloadFileName)
                }
                disabled={viewDocumentPending}
              >
                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                Download
              </Button>
            </>
          ) : null}
          {status === "DRAFT" ? (
            <Button
              size="sm"
              variant={status === "DRAFT" && !generateLetterDisabledBecauseShoraka ? "default" : "outline"}
              onClick={() => guardedAction(() => setConfirmAction("generate"))}
              disabled={
                pendingAny || !beneficiaryComplete || generateLetterDisabledBecauseShoraka || !canManage
              }
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              className="gap-1.5"
            >
              <DocumentTextIcon className="h-4 w-4" />
              Generate Letter
            </Button>
          ) : null}
          {canResendTrusteeEmail ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => guardedAction(() => setConfirmAction("resend"))}
              disabled={pendingAny || !canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              className="gap-1.5"
            >
              <EnvelopeIcon className="h-4 w-4" />
              {trusteeResendCopy.button}
            </Button>
          ) : null}
          {status === "LETTER_GENERATED" ? (
            <Button
              size="sm"
              onClick={() => guardedAction(() => setConfirmAction("submit"))}
              disabled={pendingAny || !canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              className="gap-1.5"
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
              {trusteeSubmitCopy.button}
            </Button>
          ) : null}
          {status === "SUBMITTED_TO_TRUSTEE" ? (
            <Button
              size="sm"
              onClick={() =>
                guardedAction(() => {
                  if (requiresDisbursementDate) {
                    setDisbursementValueDate(defaultDisbursementValueDate());
                    setDisbursementDateError(null);
                  }
                  setConfirmAction("complete");
                })
              }
              disabled={pendingAny || markDisbursedDisabledBecauseShoraka || !canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              className="gap-1.5"
            >
              <CheckCircleIcon className="h-4 w-4" />
              Mark Disbursed
            </Button>
          ) : null}
          {pendingAny ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              Working…
            </span>
          ) : null}
        </div>
      </div>
    </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          {confirmCopy ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmCopy.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmCopy.description}</AlertDialogDescription>
              </AlertDialogHeader>
              {confirmAction === "complete" && requiresDisbursementDate ? (
                <DisbursementValueDateField
                  id="issuer-disbursement-value-date"
                  value={disbursementValueDate}
                  error={disbursementDateError}
                  onChange={(value) => {
                    setDisbursementValueDate(value);
                    setDisbursementDateError(null);
                  }}
                />
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingAny}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={pendingAny}
                  onClick={(event) => {
                    if (confirmAction === "complete" && requiresDisbursementDate) {
                      const dateError = disbursementValueDateError(disbursementValueDate);
                      if (dateError) {
                        event.preventDefault();
                        setDisbursementDateError(dateError);
                        return;
                      }
                    }
                    void confirmRun();
                  }}
                >
                  {confirmCopy.confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={beneficiaryDialogOpen} onOpenChange={setBeneficiaryDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit issuer beneficiary details</DialogTitle>
            <DialogDescription>
              Prefilled from{" "}
              {asString((withdrawal.beneficiarySnapshot as Record<string, unknown>)?.bank_name)
                ? "the issuer organization profile"
                : "your input"}
              . These details are snapshotted onto the trustee letter; subsequent changes to the
              issuer&apos;s organization profile won&apos;t propagate after generation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {(Object.keys(BENEFICIARY_LABELS) as Array<keyof BeneficiaryFields>).map((field) => (
              <div key={field} className="grid gap-1.5">
                <Label htmlFor={`beneficiary-${field}`}>{BENEFICIARY_LABELS[field]}</Label>
                <Input
                  id={`beneficiary-${field}`}
                  value={beneficiaryDraft[field]}
                  onChange={(event) =>
                    setBeneficiaryDraft((prev) => ({ ...prev, [field]: event.target.value }))
                  }
                  placeholder={
                    field === "reference_note"
                      ? `Residual refund for note ${note.noteReference ?? note.id}`
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBeneficiaryDialogOpen(false)}
              disabled={pendingAny}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveBeneficiary} disabled={pendingAny}>
              Save Beneficiary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
