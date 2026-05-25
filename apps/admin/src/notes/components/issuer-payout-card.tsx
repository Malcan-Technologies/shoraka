"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ArrowPathIcon,
  ArrowRightCircleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  PencilSquareIcon,
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
  DRAFT: { label: "Draft — letter not yet generated", tone: "draft" },
  LETTER_GENERATED: { label: "Letter generated — awaiting trustee submission", tone: "progress" },
  SUBMITTED_TO_TRUSTEE: { label: "Submitted to trustee — awaiting confirmation", tone: "progress" },
  COMPLETED: { label: "Disbursed", tone: "complete" },
  CANCELLED: { label: "Cancelled", tone: "cancelled" },
};

const ACTION_CARD_CLASS =
  "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]";
const SECTION_COMPLETE_CLASS = "border-emerald-200 bg-emerald-50/40";
const SECTION_COMPLETE_HEADER_CLASS =
  "mb-2 text-xs font-medium uppercase tracking-wider text-emerald-900";

type IssuerPayoutKind = "DISBURSEMENT" | "RESIDUAL";

interface IssuerPayoutCardProps {
  note: NoteDetail;
  withdrawal: WithdrawalInstruction;
  kind: IssuerPayoutKind;
  servicingBlockedReason: string | null;
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
}: IssuerPayoutCardProps) {
  const kindCopy = KIND_COPY[kind];
  const generateLetter = useGenerateWithdrawalLetter();
  const markSubmitted = useMarkWithdrawalSubmitted();
  const markCompleted = useMarkWithdrawalCompleted();
  const updateBeneficiary = useUpdateWithdrawalBeneficiary();
  const { handleViewDocument, viewDocumentPending } = useAdminS3DocumentViewDownload();

  const shorakaStateQuery = useShorakaWithdrawalState(withdrawal.id);
  const submitShorakaOrder = useSubmitShorakaOrder(withdrawal.id);
  const queryShorakaStatus = useQueryShorakaStatus(withdrawal.id);
  const fetchShorakaCertificate = useFetchShorakaCertificate(withdrawal.id);

  const shorakaUnsafeSubmitWindowMessage =
    "Shoraka orders cannot be submitted between 11:30 PM and 12:30 AM MYT because orders may remain Active and require cancellation. Please submit after 12:30 AM.";
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
        "Checking Shoraka certificate status…"
      ) : shorakaStateQuery.isError ? (
        "Unable to verify Shoraka certificate status. Please refresh or try again."
      ) : (
        "Shoraka certificate must be fetched before marking issuer disbursement as completed."
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
  const actionAvailable =
    !payoutComplete &&
    (status === "LETTER_GENERATED" ||
      status === "SUBMITTED_TO_TRUSTEE" ||
      (status === "DRAFT" && beneficiaryComplete));
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

  const handleDownload = () => {
    if (!withdrawal.letterS3Key) return;
    void handleViewDocument(withdrawal.letterS3Key);
  };

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

  return (
    <div
      className={cn(
        "mt-4 rounded-xl border p-4",
        payoutComplete
          ? SECTION_COMPLETE_CLASS
          : actionAvailable
            ? ACTION_CARD_CLASS
            : "bg-card"
      )}
    >
      {payoutComplete ? (
        <div className={SECTION_COMPLETE_HEADER_CLASS}>
          {kind === "RESIDUAL"
            ? "Issuer residual refund complete"
            : "Issuer disbursement complete"}
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium">{kindCopy.title}</div>
            <Badge
              variant={
                statusCopy.tone === "complete"
                  ? "default"
                  : statusCopy.tone === "cancelled"
                    ? "destructive"
                    : "secondary"
              }
              className={
                statusCopy.tone === "complete"
                  ? "bg-emerald-500 text-white hover:bg-emerald-500"
                  : undefined
              }
            >
              {statusCopy.label}
            </Badge>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {formatCurrency(withdrawal.amount)} — {kindCopy.description}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Amount</div>
          <div className="text-base font-semibold tabular-nums text-primary">
            {formatCurrency(withdrawal.amount)}
          </div>
        </div>
      </div>

      {withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT &&
      withdrawal.grossFundedAmount != null &&
      withdrawal.platformFeeAmount != null &&
      withdrawal.netIssuerDisbursement != null ? (
        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium uppercase tracking-wider text-muted-foreground">
              Disbursement breakdown
            </div>
          </div>
          <div className="mt-2 space-y-1 text-foreground">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Gross funded</span>
              <span className="font-medium">{formatCurrency(withdrawal.grossFundedAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Platform fee</span>
              <span className="font-medium">{formatCurrency(withdrawal.platformFeeAmount)}</span>
            </div>
            {withdrawal.facilityFeeCharged != null ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Facility fee</span>
                <span className="font-medium">{formatCurrency(withdrawal.facilityFeeCharged)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-4 pt-1">
              <span className="text-muted-foreground">Net to issuer</span>
              <span className="font-semibold text-primary">
                {formatCurrency(withdrawal.netIssuerDisbursement)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {withdrawal.withdrawalType === WithdrawalType.ISSUER_DISBURSEMENT ? (
        <div className="mt-4 rounded-lg border bg-muted/20 p-3 text-[11px]">
          <div className="flex items-center justify-between">
            <div className="font-medium uppercase tracking-wider text-muted-foreground">Shoraka STP</div>
          </div>

          {shorakaStateQuery.isPending ? (
            <div className="mt-2 text-muted-foreground">Checking Shoraka certificate status…</div>
          ) : shorakaStateQuery.data == null ? (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">Not submitted</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Next action</span>
                <span className="text-foreground">Submit Shoraka order</span>
              </div>
              <div className="mt-2">
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={async () => {
                    try {
                      if (servicingBlockedReason) {
                        toast.info(servicingBlockedReason);
                        return;
                      }
                      await submitShorakaOrder.mutateAsync();
                      toast.success("Shoraka order submitted");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to submit Shoraka order");
                    }
                  }}
                  disabled={submitShorakaOrder.isPending || isMalaysiaUnsafeShorakaSubmitWindow}
                >
                  Submit Shoraka Order
                </Button>
              </div>

              {isMalaysiaUnsafeShorakaSubmitWindow ? (
                <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                  {shorakaUnsafeSubmitWindowMessage}
                </div>
              ) : null}
            </div>
          ) : (
            (() => {
              const state = shorakaStateQuery.data;
              const tradeOrder = state.tradeOrder;
              const parsed = state.parsed;
              const operational = state.operationalStatus;
              const hasCertificate = Boolean(tradeOrder.certificate_s3_key);

              const step =
                operational.providerStatus === "Active"
                  ? { status: "Matching in progress", nextAction: "Query status again later" }
                  : operational.providerStatus === "Pending Sell"
                    ? {
                        status: "Pending sell",
                        nextAction: "Query status again later; contact operations if stuck",
                      }
                    : operational.providerStatus === "Completed" && !hasCertificate
                      ? { status: "Completed", nextAction: "Fetch certificate" }
                      : operational.providerStatus === "Completed" && hasCertificate
                        ? { status: "Certificate ready", nextAction: "You may proceed with disbursement" }
                        : {
                            status: "Manual review required",
                            nextAction: "Check with Shoraka/Tawarruq operations",
                          };

              const callbackReceivedAt = tradeOrder.callback_received_at
                ? new Date(tradeOrder.callback_received_at)
                : null;
              const statusLastCheckedAt = tradeOrder.status_last_checked_at
                ? new Date(tradeOrder.status_last_checked_at)
                : null;

              const statusSource = callbackReceivedAt
                ? statusLastCheckedAt && callbackReceivedAt.getTime() < statusLastCheckedAt.getTime()
                  ? "Updated by status query"
                  : "Updated by callback"
                : null;

              return (
                <>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-medium">{step.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted-foreground">Next action</span>
                      <span className="text-foreground">{step.nextAction}</span>
                    </div>
                    {tradeOrder.provider_order_id ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Order ID</span>
                        <span className="font-medium">{tradeOrder.provider_order_id}</span>
                      </div>
                    ) : null}
                    {parsed.orderDate ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Order date</span>
                        <span className="font-medium">{parsed.orderDate}</span>
                      </div>
                    ) : null}
                    {parsed.valueDate ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Value date</span>
                        <span className="font-medium">{parsed.valueDate}</span>
                      </div>
                    ) : null}
                    {parsed.orderDate || parsed.valueDate ? (
                      <div className="pt-1 text-[11px] text-muted-foreground">
                        Order date = Shoraka trade submission date. Value date = intended disbursement date.
                      </div>
                    ) : null}
                    {parsed.orderAmount ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Order amount</span>
                        <span className="font-medium">{parsed.orderAmount}</span>
                      </div>
                    ) : null}
                    {parsed.murabahaAmount ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Murabaha amount</span>
                        <span className="font-medium">{parsed.murabahaAmount}</span>
                      </div>
                    ) : null}
                    {statusSource ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Status source</span>
                        <span className="font-medium">{statusSource}</span>
                      </div>
                    ) : null}
                    {tradeOrder.callback_received_at ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Callback received</span>
                        <span className="font-medium">
                          {format(new Date(tradeOrder.callback_received_at), "dd MMM yyyy, h:mm a")}
                        </span>
                      </div>
                    ) : null}
                    {tradeOrder.status_last_checked_at ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground">Last checked</span>
                        <span className="font-medium">
                          {format(new Date(tradeOrder.status_last_checked_at), "dd MMM yyyy, h:mm a")}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  {state.cutoffWarning ? (
                    <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-900">
                      {state.cutoffWarning}
                    </div>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {operational.providerStatus === "Active" || operational.providerStatus === "Pending Sell" ? (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={async () => {
                          try {
                            if (servicingBlockedReason) {
                              toast.info(servicingBlockedReason);
                              return;
                            }
                            await queryShorakaStatus.mutateAsync();
                            toast.success("Shoraka status queried");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to query Shoraka status");
                          }
                        }}
                        disabled={queryShorakaStatus.isPending}
                      >
                        Query Status
                      </Button>
                    ) : null}

                    {operational.canFetchCertificate ? (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={async () => {
                          try {
                            if (servicingBlockedReason) {
                              toast.info(servicingBlockedReason);
                              return;
                            }
                            await fetchShorakaCertificate.mutateAsync();
                            toast.success("Shoraka certificate fetched");
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to fetch certificate");
                          }
                        }}
                        disabled={fetchShorakaCertificate.isPending}
                      >
                        Fetch Certificate
                      </Button>
                    ) : null}

                    {tradeOrder.certificate_s3_key ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          const key = tradeOrder.certificate_s3_key;
                          if (!key) return;
                          void handleViewDocument(key);
                        }}
                        disabled={viewDocumentPending}
                      >
                        View Certificate
                      </Button>
                    ) : null}
                  </div>
                </>
              );
            })()
          )}
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Beneficiary
            </div>
            {status === "DRAFT" ? (
              <button
                type="button"
                onClick={() => setBeneficiaryDialogOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <PencilSquareIcon className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : null}
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-foreground">
            <div>
              <span className="text-muted-foreground">Bank: </span>
              {currentFields.bank_name || <span className="text-amber-700">missing</span>}
            </div>
            <div>
              <span className="text-muted-foreground">Account: </span>
              {currentFields.account_number || <span className="text-amber-700">missing</span>}
            </div>
            {currentFields.account_holder ? (
              <div>
                <span className="text-muted-foreground">Holder: </span>
                {currentFields.account_holder}
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Timeline
          </div>
          <div className="mt-2 space-y-0.5 text-[11px] leading-snug text-foreground">
            <div>
              <span className="text-muted-foreground">Created: </span>
              {format(new Date(withdrawal.createdAt), "dd MMM yyyy, h:mm a")}
            </div>
            {withdrawal.generatedAt ? (
              <div>
                <span className="text-muted-foreground">Letter generated: </span>
                {format(new Date(withdrawal.generatedAt), "dd MMM yyyy, h:mm a")}
              </div>
            ) : null}
            {withdrawal.submittedToTrusteeAt ? (
              <div>
                <span className="text-muted-foreground">Submitted to trustee: </span>
                {format(new Date(withdrawal.submittedToTrusteeAt), "dd MMM yyyy, h:mm a")}
              </div>
            ) : null}
            {withdrawal.completedAt ? (
              <div>
                <span className="text-muted-foreground">Completed: </span>
                {format(new Date(withdrawal.completedAt), "dd MMM yyyy, h:mm a")}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {withdrawal.letterS3Key ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={viewDocumentPending}
            className="gap-1.5"
          >
            <DocumentTextIcon className="h-4 w-4" />
            {viewDocumentPending ? "Opening…" : "View Letter"}
          </Button>
        ) : null}
        {status === "DRAFT" ? (
          <Button
            size="sm"
            onClick={() => guardedAction(() => setConfirmAction("generate"))}
            disabled={pendingAny || !beneficiaryComplete}
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
            disabled={pendingAny}
            className="gap-1.5"
          >
            <ArrowRightCircleIcon className="h-4 w-4" />
            Mark Submitted to Trustee
          </Button>
        ) : null}
        {status === "SUBMITTED_TO_TRUSTEE" ? (
          <Button
            size="sm"
            onClick={() => guardedAction(() => setConfirmAction("complete"))}
            disabled={pendingAny || markDisbursedDisabledBecauseShoraka}
            className="gap-1.5"
          >
            <CheckCircleIcon className="h-4 w-4" />
            Mark Disbursed
          </Button>
        ) : null}
        {status === "SUBMITTED_TO_TRUSTEE" && markDisbursedHelperText ? (
          <div className="w-full text-right text-xs text-muted-foreground">{markDisbursedHelperText}</div>
        ) : null}
        {pendingAny ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
            Working…
          </span>
        ) : null}
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
