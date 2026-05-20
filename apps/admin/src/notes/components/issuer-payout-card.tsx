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
  const actionAvailable =
    status === "LETTER_GENERATED" ||
    status === "SUBMITTED_TO_TRUSTEE" ||
    (status === "DRAFT" && beneficiaryComplete);
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
    <div className={cn("mt-4 rounded-xl border bg-card p-4", actionAvailable && ACTION_CARD_CLASS)}>
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
          <p className="mt-1 text-xs text-muted-foreground">
            {formatCurrency(withdrawal.amount)} — {kindCopy.description}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Amount</div>
          <div className="text-xl font-semibold text-primary">
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
            {withdrawal.facilityFeeCharged != null && withdrawal.facilityFeeCharged > 0 ? (
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

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-muted/20 p-3 text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium uppercase tracking-wider text-muted-foreground">
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
          <div className="mt-2 space-y-1 text-foreground">
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
        <div className="rounded-lg border bg-muted/20 p-3 text-xs">
          <div className="font-medium uppercase tracking-wider text-muted-foreground">Timeline</div>
          <ul className="mt-2 space-y-1 text-foreground">
            <li>
              <span className="text-muted-foreground">Created: </span>
              {format(new Date(withdrawal.createdAt), "dd MMM yyyy, h:mm a")}
            </li>
            {withdrawal.generatedAt ? (
              <li>
                <span className="text-muted-foreground">Letter generated: </span>
                {format(new Date(withdrawal.generatedAt), "dd MMM yyyy, h:mm a")}
              </li>
            ) : null}
            {withdrawal.submittedToTrusteeAt ? (
              <li>
                <span className="text-muted-foreground">Submitted to trustee: </span>
                {format(new Date(withdrawal.submittedToTrusteeAt), "dd MMM yyyy, h:mm a")}
              </li>
            ) : null}
            {withdrawal.completedAt ? (
              <li>
                <span className="text-muted-foreground">Completed: </span>
                {format(new Date(withdrawal.completedAt), "dd MMM yyyy, h:mm a")}
              </li>
            ) : null}
          </ul>
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
            disabled={pendingAny}
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
