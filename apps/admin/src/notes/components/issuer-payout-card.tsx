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
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail, WithdrawalInstruction } from "@cashsouk/types";
import { WithdrawalType } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  BeneficiaryDetailsBlock,
  CollapsibleDetailTimeline,
  PoolSummaryCard,
} from "@/notes/components/note-detail-ui-blocks";

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
  { label: string; tone: "draft" | "progress" | "complete" | "cancelled" }
> = {
  DRAFT: { label: "Not generated", tone: "draft" },
  LETTER_GENERATED: { label: "Pending trustee submission", tone: "progress" },
  SUBMITTED_TO_TRUSTEE: { label: "Submitted to trustee", tone: "progress" },
  COMPLETED: { label: "Disbursed", tone: "complete" },
  CANCELLED: { label: "Cancelled", tone: "cancelled" },
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

function tawarruqNextActionCallout(input: {
  isPending: boolean;
  hasStoredCertificate: boolean;
  data:
    | {
        tradeOrder: { certificate_s3_key?: string | null };
        operationalStatus: { providerStatus: string; canFetchCertificate?: boolean };
      }
    | null
    | undefined;
}): { title: string; description: string } | null {
  if (input.isPending || input.hasStoredCertificate) return null;

  if (input.data == null) {
    return {
      title: "Next: Submit Tawarruq Order",
      description: "Submit the Tawarruq order before the certificate can be fetched.",
    };
  }

  const hasCertificate = Boolean(input.data.tradeOrder.certificate_s3_key);
  const step = resolveShorakaOperationalStep(
    input.data.operationalStatus.providerStatus,
    hasCertificate
  );

  if (step.nextAction === "You may proceed with disbursement") {
    return null;
  }

  if (
    input.data.operationalStatus.canFetchCertificate ||
    step.nextAction === "Fetch certificate"
  ) {
    return {
      title: "Next: Fetch Tawarruq Certificate",
      description:
        "The Tawarruq order is completed. Fetch the certificate before generating the trustee letter.",
    };
  }

  if (
    input.data.operationalStatus.providerStatus === "Active" ||
    input.data.operationalStatus.providerStatus === "Pending Sell"
  ) {
    return {
      title: "Next: Query Tawarruq status",
      description: step.nextAction,
    };
  }

  if (step.nextAction === "Check with Tawarruq operations") {
    return {
      title: "Next: Check with Tawarruq operations",
      description: step.nextAction,
    };
  }

  return {
    title: `Next: ${step.nextAction}`,
    description: step.nextAction,
  };
}

function TawarruqNextActionCallout({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-2">
      <div className="text-xs font-semibold text-foreground">{title}</div>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

const ACTION_CARD_CLASS =
  "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]";
const SECTION_COMPLETE_CLASS = "border-emerald-200 bg-emerald-50/40";

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
  const tawarruqNextAction = tawarruqNextActionCallout({
    isPending: shorakaStateQuery.isPending,
    hasStoredCertificate: hasShorakaCertificate,
    data: shorakaStateQuery.data,
  });
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
    "generate" | "submit" | "complete" | null
  >(null);
  const [beneficiaryDialogOpen, setBeneficiaryDialogOpen] = React.useState(false);
  const [beneficiaryDraft, setBeneficiaryDraft] = React.useState<BeneficiaryFields>(() =>
    snapshotToFields(withdrawal.beneficiarySnapshot)
  );

  React.useEffect(() => {
    if (!beneficiaryDialogOpen) {
      setBeneficiaryDraft(snapshotToFields(withdrawal.beneficiarySnapshot));
    }
  }, [withdrawal.beneficiarySnapshot, beneficiaryDialogOpen]);

  const status = withdrawal.status;
  const statusCopy = STATUS_COPY[status] ?? STATUS_COPY.DRAFT;
  const currentFields = snapshotToFields(withdrawal.beneficiarySnapshot);
  const beneficiaryComplete =
    currentFields.bank_name.trim() !== "" && currentFields.account_number.trim() !== "";
  const payoutComplete = status === "COMPLETED";
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
        toast.success("Marked as submitted to trustee");
      } else if (confirmAction === "complete") {
        await markCompleted.mutateAsync(withdrawal.id);
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
            title: "Mark letter as submitted to trustee?",
            description: `Confirm that the trustee letter has been delivered. The withdrawal will move to "Submitted to trustee" and await confirmation of physical disbursement.`,
            confirmLabel: "Mark Submitted",
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

  const statusPanelTitle = payoutComplete
    ? kind === "DISBURSEMENT"
      ? "Issuer disbursement complete"
      : "Issuer residual refund complete"
    : kind === "DISBURSEMENT"
      ? "Issuer disbursement"
      : kindCopy.title;

  const statusPanelDescription = payoutComplete
    ? kind === "DISBURSEMENT"
      ? "Net funded proceeds have been disbursed to the issuer."
      : "Residual refund has been disbursed to the issuer."
    : kind === "DISBURSEMENT"
      ? "Funding has closed. Pay out the net amount to the issuer via the trustee before servicing begins."
      : kindCopy.description;

  const surfaceClass = payoutComplete
    ? SECTION_COMPLETE_CLASS
    : workflowInProgress
      ? ACTION_CARD_CLASS
      : "border-border bg-card";

  return (
    <div className={cn("rounded-xl border p-4", surfaceClass)}>
      <div
        className={cn(
          "rounded-lg border px-3 py-2.5",
          payoutComplete
            ? "border-emerald-200 bg-emerald-50/80"
            : workflowInProgress
              ? "border-primary/35 bg-primary/5"
              : "border-border bg-muted/20"
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  "text-sm font-semibold",
                  payoutComplete && "text-emerald-900"
                )}
              >
                {statusPanelTitle}
              </div>
              <Badge
                variant={
                  statusCopy.tone === "complete"
                    ? "outline"
                    : statusCopy.tone === "cancelled"
                      ? "destructive"
                      : "outline"
                }
                className={
                  statusCopy.tone === "complete"
                    ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
                    : undefined
                }
              >
                {statusCopy.label}
              </Badge>
            </div>
            <p
              className={cn(
                "mt-0.5 text-xs",
                payoutComplete ? "text-emerald-800" : "text-muted-foreground"
              )}
            >
              {statusPanelDescription}
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
              label="Platform fee"
              value={withdrawal.platformFeeAmount}
              description="Platform fee deducted from funded amount."
            />
            {withdrawal.facilityFeeCharged != null ? (
              <PoolSummaryCard
                label="Facility fee"
                value={withdrawal.facilityFeeCharged}
                description="Facility fee deducted from funded amount, if applicable."
              />
            ) : null}
            <PoolSummaryCard
              label="Net to issuer"
              value={withdrawal.netIssuerDisbursement}
              description="Final amount disbursed to issuer."
              emphasized
            />
          </div>
        </div>
      ) : null}

      {withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT ? (
        <div className="mt-3 rounded-lg border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-medium">Tawarruq transaction</div>
            {shorakaStateQuery.isPending ? (
              <Badge variant="outline">Checking…</Badge>
            ) : shorakaStateQuery.data == null ? (
              <Badge variant="outline">Not submitted</Badge>
            ) : hasShorakaCertificate ? (
              <Badge variant="secondary">Certificate ready</Badge>
            ) : (
              <Badge variant="outline">In progress</Badge>
            )}
          </div>
          {hasShorakaCertificate ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Tawarruq certificate fetched and stored.
            </p>
          ) : null}

          {tawarruqNextAction ? (
            <TawarruqNextActionCallout
              title={tawarruqNextAction.title}
              description={tawarruqNextAction.description}
            />
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
                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
                        {state.cutoffWarning}
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </>
          ) : null}

          {isMalaysiaUnsafeShorakaSubmitWindow && shorakaStateQuery.data == null ? (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900">
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

      <div
        className={cn(
          "mt-3 rounded-lg border bg-card p-3",
          payoutComplete && "border-emerald-200/60"
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium">Trustee submission</div>
          <Badge
            variant={
              status === "COMPLETED"
                ? "secondary"
                : status === "DRAFT"
                  ? "destructive"
                  : "outline"
            }
          >
            {status === "DRAFT" ? "Not generated" : statusCopy.label}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {withdrawalTrusteeDescription(status, kind)}
        </p>
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
            currentFields.account_holder || <span className="text-amber-700">missing</span>
          }
          bankName={currentFields.bank_name || <span className="text-amber-700">missing</span>}
          accountNumber={
            currentFields.account_number || <span className="text-amber-700">missing</span>
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
          {status === "LETTER_GENERATED" ? (
            <Button
              size="sm"
              onClick={() => guardedAction(() => setConfirmAction("submit"))}
              disabled={pendingAny || !canManage}
              title={!canManage ? "You do not have permission to perform this action." : undefined}
              className="gap-1.5"
            >
              <ArrowRightCircleIcon className="h-4 w-4" />
              Mark submitted to trustee
            </Button>
          ) : null}
          {status === "SUBMITTED_TO_TRUSTEE" ? (
            <Button
              size="sm"
              onClick={() => guardedAction(() => setConfirmAction("complete"))}
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
              <AlertDialogFooter>
                <AlertDialogCancel disabled={pendingAny}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmRun} disabled={pendingAny}>
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
    </div>
  );
}
