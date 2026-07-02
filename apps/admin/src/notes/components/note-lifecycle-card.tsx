"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowPathIcon,
  ArrowRightCircleIcon,
  ArrowUturnLeftIcon,
  CheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import type { NoteDetail, ShorakaWithdrawalState, WithdrawalInstruction } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { resolveLatePaymentTimeline, LATE_PAYMENT_WORKFLOW_BADGE } from "@/notes/utils/late-payment-workflow";
import { useShorakaWithdrawalState } from "@/notes/hooks/use-notes";
import {
  areAllPostedSettlementTrusteeInstructionsComplete,
  isNoteLifecycleVisuallyComplete,
  isSettlementWrappingUp,
} from "@/notes/utils/settlement-trustee-workflow";
import {
  trusteeWorkflowTone,
  withdrawalHeaderBadgeTone,
  type WorkflowStatusTone,
  WORKFLOW_CARD,
  workflowBadgeClassName,
} from "@/notes/utils/workflow-status-tokens";

export type NoteLifecycleAction = "publish" | "unpublish" | "closeFunding" | "failFunding";

type StageId = "DRAFT" | "PUBLISHED" | "FUNDED" | "DISBURSEMENT" | "ACTIVE" | "REPAID";

interface LifecycleStage {
  id: StageId;
  label: string;
}

const STAGES: LifecycleStage[] = [
  { id: "DRAFT", label: "Draft" },
  { id: "PUBLISHED", label: "Published" },
  { id: "FUNDED", label: "Funded" },
  { id: "DISBURSEMENT", label: "Disbursement" },
  { id: "ACTIVE", label: "Active" },
  { id: "REPAID", label: "Repaid" },
];

const ACTION_CARD_CLASS =
  "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]";

interface TerminalFailure {
  label: string;
  description: string;
  stageIndex: number;
}

function getTerminalFailure(note: NoteDetail, activeIndex: number): TerminalFailure | null {
  if (note.status === "FAILED_FUNDING" || note.fundingStatus === "FAILED") {
    return {
      label: "Funding failed",
      description:
        "Marketplace did not reach the minimum funding threshold. Commitments must be released.",
      stageIndex: 1,
    };
  }
  if (note.status === "CANCELLED") {
    return {
      label: "Cancelled",
      description: "This note has been cancelled and is no longer active.",
      stageIndex: activeIndex,
    };
  }
  if (note.status === "DEFAULTED") {
    return {
      label: "Defaulted",
      description:
        "Servicing has reached default. Settle outstanding obligations via the servicing panel.",
      stageIndex: 4,
    };
  }
  return null;
}

function findIssuerDisbursementWithdrawal(note: NoteDetail): WithdrawalInstruction | null {
  return (
    (note.withdrawals ?? []).find(
      (withdrawal) =>
        withdrawal.withdrawalType === "ISSUER_DISBURSEMENT" && withdrawal.status !== "CANCELLED"
    ) ?? null
  );
}

function isDisbursementComplete(withdrawal: WithdrawalInstruction | null): boolean {
  return withdrawal?.status === "COMPLETED";
}

function getActiveStageIndex(note: NoteDetail): number {
  const hasPostedSettlement = note.settlements.some((s) => s.status === "POSTED");
  if (note.status === "REPAID" || note.servicingStatus === "SETTLED" || hasPostedSettlement) {
    return 5;
  }
  const servicingActive =
    note.status === "ACTIVE" ||
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.servicingStatus === "CURRENT" ||
    note.servicingStatus === "LATE" ||
    note.servicingStatus === "ARREARS" ||
    note.servicingStatus === "DEFAULTED";
  if (servicingActive) {
    return 4;
  }
  if (note.fundingStatus === "FUNDED") {
    return isDisbursementComplete(findIssuerDisbursementWithdrawal(note)) ? 4 : 3;
  }
  if (note.status === "FUNDING") {
    return 2;
  }
  if (note.status === "PUBLISHED") {
    return 1;
  }
  return 0;
}

type FlowSubStep = {
  id: string;
  label: string;
  status: "done" | "current" | "pending";
};

function buildDisbursementSubSteps(
  withdrawal: WithdrawalInstruction | null,
  shorakaState: ShorakaWithdrawalState | null | undefined
): {
  steps: FlowSubStep[];
  tone: WorkflowStatusTone;
} {
  const labels = ["Tawarruq order", "Certificate", "Trustee instruction", "Disbursed"];
  const ids = ["TAWARRUQ", "CERTIFICATE", "TRUSTEE", "DISBURSED"];

  if (!withdrawal) {
    return {
      steps: labels.map((label, idx) => ({
        id: ids[idx] ?? `STEP_${idx}`,
        label,
        status: idx === 0 ? "current" : "pending",
      })),
      tone: "neutral",
    };
  }

  const tawarruqOrderComplete = shorakaState != null;
  const hasCertificate = Boolean(
    shorakaState?.tradeOrder.certificate_s3_key ?? (withdrawal.hasShorakaCertificate ? true : false)
  );

  let completedThrough = -1;
  if (withdrawal.status === "COMPLETED") {
    completedThrough = 3;
  } else if (hasCertificate) {
    completedThrough = 1;
  } else if (tawarruqOrderComplete) {
    completedThrough = 0;
  }

  const steps = labels.map((label, idx) => ({
    id: ids[idx] ?? `STEP_${idx}`,
    label,
    status:
      idx <= completedThrough
        ? ("done" as const)
        : idx === completedThrough + 1
          ? ("current" as const)
          : ("pending" as const),
  }));

  let tone: WorkflowStatusTone = withdrawalHeaderBadgeTone(withdrawal.status);
  if (withdrawal.status !== "COMPLETED") {
    if (!tawarruqOrderComplete) {
      tone = "active";
    } else if (!hasCertificate) {
      tone = "active";
    } else if (
      withdrawal.status === "LETTER_GENERATED" ||
      withdrawal.status === "SUBMITTED_TO_TRUSTEE"
    ) {
      tone = withdrawalHeaderBadgeTone(withdrawal.status);
    } else {
      tone = "active";
    }
  }

  return { steps, tone };
}

function getSettlementAmount(note: NoteDetail): number {
  const extended = note as NoteDetail & { settlementAmount?: number; invoiceAmount?: number };
  return extended.settlementAmount ?? extended.invoiceAmount ?? note.requestedAmount;
}

function settlementReceiptThresholdMet(note: NoteDetail): boolean {
  const settlementAmount = getSettlementAmount(note);
  if (settlementAmount <= 0.005) {
    return false;
  }
  if (note.payments.some((payment) => payment.status === "PENDING")) {
    return false;
  }
  const eligibleReceiptTotal = note.payments
    .filter((payment) =>
      ["RECEIVED", "RECONCILED", "PARTIAL", "SETTLED"].includes(payment.status)
    )
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  const settledReceiptTotal = note.payments
    .filter((payment) => payment.status === "SETTLED")
    .reduce((sum, payment) => sum + payment.receiptAmount, 0);
  return (
    eligibleReceiptTotal + 0.005 >= settlementAmount ||
    settledReceiptTotal + 0.005 >= settlementAmount
  );
}

function buildSettlementSubSteps(note: NoteDetail): {
  steps: FlowSubStep[];
  tone: WorkflowStatusTone;
} {
  const receiptsComplete = settlementReceiptThresholdMet(note);
  const postedSettlement =
    note.settlements.find((settlement) => settlement.status === "POSTED") ?? null;
  const postedComplete = postedSettlement != null;
  const trusteeComplete =
    postedComplete && areAllPostedSettlementTrusteeInstructionsComplete(note.settlements);
  const settledComplete = isNoteLifecycleVisuallyComplete(note);

  const labels = [
    "Receipts collected",
    "Settlement posted",
    "Trustee instruction",
    "Settled",
  ];
  const ids = ["RECEIPTS", "POSTED", "TRUSTEE", "SETTLED"];

  let completedThrough = -1;
  if (settledComplete) {
    completedThrough = 3;
  } else if (trusteeComplete && postedComplete) {
    completedThrough = 2;
  } else if (postedComplete) {
    completedThrough = 1;
  } else if (receiptsComplete) {
    completedThrough = 0;
  }

  const steps = labels.map((label, idx) => ({
    id: ids[idx] ?? `STEP_${idx}`,
    label,
    status:
      idx <= completedThrough
        ? ("done" as const)
        : idx === completedThrough + 1
          ? ("current" as const)
          : ("pending" as const),
  }));

  let tone: WorkflowStatusTone = "warning";
  if (settledComplete) {
    tone = "success";
  } else if (postedComplete && !trusteeComplete) {
    tone = trusteeWorkflowTone(postedSettlement?.serviceFeeTrusteeStatus ?? null, {
      needsGeneration:
        postedSettlement?.serviceFeeTrusteeStatus === "PENDING_LETTER" ||
        postedSettlement?.serviceFeeTrusteeStatus === null,
    });
  } else if (receiptsComplete && !postedComplete) {
    tone = "active";
  }

  return { steps, tone };
}

function settlementStripHelperText(note: NoteDetail): string {
  const receiptsComplete = settlementReceiptThresholdMet(note);
  const postedSettlement =
    note.settlements.find((settlement) => settlement.status === "POSTED") ?? null;
  const trusteeComplete =
    postedSettlement != null &&
    areAllPostedSettlementTrusteeInstructionsComplete(note.settlements);

  if (isNoteLifecycleVisuallyComplete(note)) {
    return "Settlement is complete.";
  }
  if (postedSettlement && !trusteeComplete) {
    return "Settlement is posted. Complete the settlement trustee instruction — including any issuer refund allocation — from the Servicing & Settlement tab.";
  }
  if (postedSettlement && trusteeComplete) {
    return "Settlement allocations are finishing on the ledger.";
  }
  if (receiptsComplete) {
    return "Receipts meet the settlement amount. Preview, approve, and post from the Servicing & Settlement tab.";
  }
  return "Record and reconcile repayment receipts from the Servicing & Settlement tab.";
}

interface ActionConfig {
  key: NoteLifecycleAction;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: "default" | "outline" | "destructive";
  helper?: string;
}

function buildActionPlan(note: NoteDetail) {
  const publishableListingStatuses = ["NOT_LISTED", "DRAFT", "UNPUBLISHED"];
  const canPublish =
    note.status === "DRAFT" &&
    note.fundingStatus === "NOT_OPEN" &&
    publishableListingStatuses.includes(note.listingStatus);
  const isFundingOpen = note.status === "PUBLISHED" && note.fundingStatus === "OPEN";
  const meetsMinimumFunding = note.fundingPercent + 0.005 >= note.minimumFundingPercent;
  const canUnpublish =
    note.status === "PUBLISHED" &&
    note.listingStatus === "PUBLISHED" &&
    note.fundingStatus === "OPEN" &&
    note.investments.length === 0;
  const canCloseFunding = isFundingOpen && meetsMinimumFunding;
  const canFailFunding = isFundingOpen && !meetsMinimumFunding;

  let primary: ActionConfig | null = null;
  const secondary: ActionConfig[] = [];
  let contextHelper: string | null = null;

  if (canPublish) {
    primary = {
      key: "publish",
      label: "Publish to Marketplace",
      icon: GlobeAltIcon,
      variant: "default",
      helper: "Confirm source data, terms, and risk disclosure before publishing.",
    };
  } else if (canCloseFunding) {
    primary = {
      key: "closeFunding",
      label: "Close Funding",
      icon: ArrowRightCircleIcon,
      variant: "default",
      helper: `Minimum funding reached (${note.fundingPercent.toFixed(1)}% of target). Closing locks allocations and activates servicing in a single step.`,
    };
    if (canUnpublish) {
      secondary.push({
        key: "unpublish",
        label: "Unpublish",
        icon: ArrowUturnLeftIcon,
        variant: "outline",
      });
    }
  } else if (canFailFunding) {
    primary = {
      key: "failFunding",
      label: "Fail Funding",
      icon: ExclamationTriangleIcon,
      variant: "destructive",
      helper: `Minimum ${note.minimumFundingPercent}% not yet met (currently ${note.fundingPercent.toFixed(1)}%). Failing releases all commitments.`,
    };
    if (canUnpublish) {
      secondary.push({
        key: "unpublish",
        label: "Unpublish",
        icon: ArrowUturnLeftIcon,
        variant: "outline",
      });
    }
  } else if (note.status === "ACTIVE" || note.servicingStatus !== "NOT_STARTED") {
    contextHelper = "Servicing is active. Manage receipts and settlement in the Servicing & Settlement tab.";
  } else if (note.status === "PUBLISHED" || note.status === "FUNDING") {
    contextHelper = isFundingOpen
      ? `Awaiting commitments — ${note.fundingPercent.toFixed(1)}% of target funded.`
      : "Awaiting funding to open.";
    if (canUnpublish) {
      secondary.push({
        key: "unpublish",
        label: "Unpublish",
        icon: ArrowUturnLeftIcon,
        variant: "outline",
      });
    }
  }

  return { primary, secondary, contextHelper, meetsMinimumFunding, isFundingOpen };
}

function workflowStripSurfaceClass(tone: WorkflowStatusTone) {
  if (tone === "success") return WORKFLOW_CARD.successPanel;
  if (tone === "warning") return WORKFLOW_CARD.warningPanel;
  if (tone === "danger") return "border-destructive/30 bg-destructive/5";
  if (tone === "active") return WORKFLOW_CARD.warningPanel;
  return WORKFLOW_CARD.neutralSection;
}

function workflowStripTitleClass(tone: WorkflowStatusTone) {
  if (tone === "success") return "text-emerald-900";
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-amber-900";
  if (tone === "active") return "text-amber-900";
  return "text-muted-foreground";
}

function workflowStripBodyClass(tone: WorkflowStatusTone) {
  if (tone === "success") return "text-emerald-900/80";
  if (tone === "danger") return "text-destructive/80";
  if (tone === "warning" || tone === "active") return "text-amber-900/80";
  return "text-muted-foreground";
}

function WorkflowSubFlowStrip({
  title,
  steps,
  tone,
  helperText,
}: {
  title: string;
  steps: FlowSubStep[];
  tone: WorkflowStatusTone;
  helperText: string;
}) {
  const doneCount = steps.filter((step) => step.status === "done").length;
  return (
    <div className={cn("rounded-xl border p-3", workflowStripSurfaceClass(tone))}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          className={cn("text-xs font-medium uppercase tracking-wider", workflowStripTitleClass(tone))}
        >
          {title}
        </div>
        <div className={cn("text-xs", workflowStripBodyClass(tone))}>
          {doneCount} of {steps.length} steps complete
        </div>
      </div>
      <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <li className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ring-1",
                  step.status === "done"
                    ? "bg-emerald-500 text-white ring-emerald-500"
                    : step.status === "current"
                      ? tone === "active"
                        ? "bg-primary text-primary-foreground ring-primary"
                        : tone === "warning"
                          ? "bg-amber-500 text-white ring-amber-500"
                          : "bg-muted-foreground text-background ring-muted-foreground"
                      : "bg-white text-muted-foreground ring-border"
                )}
              >
                {step.status === "done" ? <CheckIcon className="h-3 w-3" /> : idx + 1}
              </span>
              <span
                className={cn(
                  step.status === "pending"
                    ? "text-muted-foreground"
                    : tone === "success"
                      ? "font-medium text-emerald-950"
                      : "font-medium text-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
            {idx < steps.length - 1 ? (
              <span
                className={cn(
                  "h-px w-4",
                  step.status === "done" ? "bg-emerald-500" : "bg-border"
                )}
              />
            ) : null}
          </React.Fragment>
        ))}
      </ol>
      <p className={cn("mt-2 text-xs", workflowStripBodyClass(tone))}>{helperText}</p>
    </div>
  );
}

function StageDot({
  index,
  active,
  past,
  failed,
}: {
  index: number;
  active: boolean;
  past: boolean;
  failed: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-2 ring-background",
        failed && active
          ? "bg-destructive text-destructive-foreground"
          : past
            ? "bg-emerald-500 text-white"
            : active
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
      )}
    >
      {failed && active ? (
        <XMarkIcon className="h-4 w-4" />
      ) : past ? (
        <CheckIcon className="h-4 w-4" />
      ) : (
        index + 1
      )}
    </div>
  );
}

interface NoteLifecycleCardProps {
  note: NoteDetail;
  pending: Partial<Record<NoteLifecycleAction, boolean>>;
  onRequestAction: (action: NoteLifecycleAction) => void;
  canManage?: boolean;
}

function getAutoCloseInfo(note: NoteDetail) {
  const closesAtIso = note.listing?.closesAt ?? null;
  if (!closesAtIso) return null;
  const closesAt = new Date(closesAtIso);
  if (Number.isNaN(closesAt.getTime())) return null;
  const now = new Date();
  const diffMs = closesAt.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const days = Math.floor(absMs / 86_400_000);
  const hours = Math.floor((absMs % 86_400_000) / 3_600_000);
  const overdue = diffMs <= 0;
  const formatted = format(closesAt, "dd MMM yyyy, h:mm a");
  const fundingRemaining = Math.max(note.targetAmount - note.fundedAmount, 0);
  const fullyFunded = note.targetAmount > 0 && fundingRemaining < 0.01;
  let relative: string;
  if (days >= 1) {
    relative = `${days} day${days === 1 ? "" : "s"}`;
  } else if (hours >= 1) {
    relative = `${hours} hour${hours === 1 ? "" : "s"}`;
  } else {
    relative = "less than an hour";
  }
  return {
    closesAt,
    formatted,
    relative,
    overdue,
    fullyFunded,
    fundingRemaining,
    label: fullyFunded
      ? "Fully funded — auto-closing on next cycle"
      : overdue
        ? `Listing past auto-close (${relative} ago, ${formatted})`
        : `Auto-closes in ${relative} (${formatted})`,
  };
}

function hasActiveSettlementWork(note: NoteDetail): boolean {
  return note.settlements.some(
    (settlement) =>
      settlement.status === "PREVIEW" ||
      settlement.status === "APPROVED" ||
      settlement.status === "POSTED"
  );
}

export function NoteLifecycleCard({ note, pending, onRequestAction, canManage = true }: NoteLifecycleCardProps) {
  const activeIndex = getActiveStageIndex(note);
  const isComplete = isNoteLifecycleVisuallyComplete(note);
  const { primary, secondary, contextHelper, isFundingOpen } = buildActionPlan(note);
  const anyPending = Object.values(pending).some(Boolean);
  const currentStage = STAGES[activeIndex];
  const autoClose = isFundingOpen ? getAutoCloseInfo(note) : null;
  const latePaymentTimeline = React.useMemo(() => resolveLatePaymentTimeline(note), [note]);
  const disbursementWithdrawal = findIssuerDisbursementWithdrawal(note);
  const disbursementComplete = isDisbursementComplete(disbursementWithdrawal);
  const shorakaStateQuery = useShorakaWithdrawalState(
    disbursementWithdrawal && !disbursementComplete ? disbursementWithdrawal.id : null
  );
  const settlementInProgress = isSettlementWrappingUp(note);
  const terminalFailure = getTerminalFailure(note, activeIndex);
  const defaultedWithSettlementTrusteeWork =
    terminalFailure?.label === "Defaulted" && settlementInProgress;
  const showDisbursementStrip =
    !isComplete &&
    !terminalFailure &&
    note.fundingStatus === "FUNDED" &&
    !disbursementComplete;
  const awaitingDisbursement = showDisbursementStrip;
  const servicingStarted = note.servicingStatus !== "NOT_STARTED";
  const settlementWorkExists = hasActiveSettlementWork(note) || settlementInProgress;
  const showSettlementStrip =
    !isComplete &&
    !awaitingDisbursement &&
    (terminalFailure == null || terminalFailure.label === "Defaulted") &&
    (servicingStarted || settlementWorkExists);
  const settlementSubFlow = showSettlementStrip ? buildSettlementSubSteps(note) : null;

  const disbursementSubFlow = showDisbursementStrip
    ? buildDisbursementSubSteps(disbursementWithdrawal, shorakaStateQuery.data)
    : null;

  const showLatePaymentStrip =
    !terminalFailure &&
    !isComplete &&
    (latePaymentTimeline.phase === "in-grace" ||
      latePaymentTimeline.phase === "arrears" ||
      latePaymentTimeline.phase === "default-eligible" ||
      latePaymentTimeline.phase === "defaulted");
  const latePaymentStripTone =
    latePaymentTimeline.phase === "defaulted"
      ? "danger"
      : latePaymentTimeline.phase === "default-eligible"
        ? "active"
        : "warning";

  const headerTitle = isComplete
    ? "Note fully repaid"
    : terminalFailure
      ? terminalFailure.label
      : settlementInProgress
        ? "Completing settlement"
        : awaitingDisbursement
          ? "Awaiting issuer disbursement"
          : `Currently ${currentStage.label}`;
  const headerDescription = isComplete
    ? "All settlement allocations are complete. The note lifecycle is complete."
    : terminalFailure
      ? defaultedWithSettlementTrusteeWork
        ? "The note has defaulted. Settlement has been posted and recovery is in progress. Complete the settlement trustee instruction — including any issuer refund allocation — from the Servicing & Settlement tab."
        : terminalFailure.description
      : settlementInProgress
        ? "Settlement has been posted to the ledger. Finish the settlement trustee instruction — including any issuer refund allocation — from the Servicing & Settlement tab."
        : awaitingDisbursement
          ? "Funding has closed. Complete issuer disbursement (Tawarruq, certificate, trustee instruction) before servicing begins."
          : null;

  const contextLines: string[] = [];
  if (!terminalFailure && !isComplete && !awaitingDisbursement && !settlementInProgress) {
    if (isFundingOpen) {
      contextLines.push(
        `${note.fundingPercent.toFixed(1)}% of ${formatCurrency(note.targetAmount)} funded`
      );
      contextLines.push(
        `${note.investments.length} commitment${note.investments.length === 1 ? "" : "s"}`
      );
      contextLines.push(`Minimum ${note.minimumFundingPercent}% to close`);
    } else if (activeIndex >= 4) {
      contextLines.push(`${formatCurrency(note.fundedAmount)} disbursed`);
      contextLines.push(
        `${note.investments.length} investor${note.investments.length === 1 ? "" : "s"}`
      );
    }
  }
  const hasAvailableAction = !terminalFailure && !isComplete && (primary || secondary.length > 0);

  return (
    <Card className={cn("rounded-2xl", hasAvailableAction && ACTION_CARD_CLASS)}>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Note Lifecycle
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-lg font-semibold">{headerTitle}</h3>
              {isComplete ? (
                <Badge className="bg-emerald-500 uppercase text-white hover:bg-emerald-500">
                  Complete
                </Badge>
              ) : terminalFailure ? (
                <>
                  <Badge variant="destructive" className="uppercase">
                    Terminal
                  </Badge>
                  {defaultedWithSettlementTrusteeWork ? (
                    <Badge variant="secondary" className="uppercase">
                      Settlement in progress
                    </Badge>
                  ) : null}
                </>
              ) : awaitingDisbursement ? (
                <Badge variant="secondary" className="uppercase">
                  Pending Disbursement
                </Badge>
              ) : settlementInProgress ? (
                <Badge variant="secondary" className="uppercase">
                  Settlement in progress
                </Badge>
              ) : null}
            </div>
            {headerDescription ? (
              <p className="mt-1 text-sm text-muted-foreground">{headerDescription}</p>
            ) : contextLines.length > 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">{contextLines.join(" · ")}</p>
            ) : contextHelper ? (
              <p className="mt-1 text-sm text-muted-foreground">{contextHelper}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto sm:gap-2">
          {STAGES.map((stage, idx) => {
            const isFailureStage = terminalFailure?.stageIndex === idx;
            const isPast = isComplete
              ? true
              : terminalFailure
                ? idx < terminalFailure.stageIndex
                : idx < activeIndex;
            const isCurrent = !isComplete && !terminalFailure && idx === activeIndex;
            const connectorActive = isComplete
              ? true
              : terminalFailure
                ? idx < terminalFailure.stageIndex
                : idx < activeIndex;
            return (
              <React.Fragment key={stage.id}>
                <div className="flex shrink-0 items-center gap-2">
                  <StageDot
                    index={idx}
                    active={isCurrent || isFailureStage}
                    past={isPast && !isFailureStage}
                    failed={isFailureStage}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      isCurrent || isFailureStage
                        ? "font-semibold text-foreground"
                        : isPast
                          ? "text-foreground"
                          : "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>
                </div>
                {idx < STAGES.length - 1 ? (
                  <div
                    className={cn(
                      "h-px min-w-4 flex-1",
                      connectorActive ? "bg-emerald-500" : "bg-border"
                    )}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>

        {settlementSubFlow ? (
          <WorkflowSubFlowStrip
            title="Settlement"
            steps={settlementSubFlow.steps}
            tone={settlementSubFlow.tone}
            helperText={settlementStripHelperText(note)}
          />
        ) : null}

        {disbursementSubFlow ? (
          <WorkflowSubFlowStrip
            title="Issuer disbursement"
            steps={disbursementSubFlow.steps}
            tone={disbursementSubFlow.tone}
            helperText="Continue this from the Disbursement tab below."
          />
        ) : null}

        {showLatePaymentStrip ? (
          <div className={cn("rounded-xl border p-3", workflowStripSurfaceClass(latePaymentStripTone))}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  workflowStripTitleClass(latePaymentStripTone)
                )}
              >
                Late payment
              </div>
              <Badge
                variant="outline"
                className={workflowBadgeClassName(latePaymentStripTone)}
              >
                {LATE_PAYMENT_WORKFLOW_BADGE[latePaymentTimeline.phase].label}
              </Badge>
            </div>
            <p className={cn("mt-2 text-xs", workflowStripBodyClass(latePaymentStripTone))}>
              Manage this from the Late Payment tab below.
            </p>
          </div>
        ) : null}

        {autoClose ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm",
              autoClose.fullyFunded
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : autoClose.overdue
                  ? "border-amber-300 bg-amber-50 text-amber-950"
                  : "border-border bg-card text-muted-foreground"
            )}
          >
            <ClockIcon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-foreground">{autoClose.label}</div>
              <div className="text-xs text-muted-foreground">
                {autoClose.fullyFunded
                  ? `Target ${formatCurrency(note.targetAmount)} reached. Funding is being closed automatically; you can also close manually to proceed immediately.`
                  : autoClose.overdue
                    ? "The hourly auto-close job will finalise the listing on its next run. You can close or fail manually now to override."
                    : `Listing closes automatically at this time or as soon as the target ${formatCurrency(note.targetAmount)} is fully funded. Closing or failing manually overrides the schedule.`}
              </div>
            </div>
          </div>
        ) : null}

        {!terminalFailure && !isComplete && (primary || secondary.length > 0) ? (
          <div className="flex flex-col gap-3 rounded-xl border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Next Step
              </div>
              <div className="mt-1 text-sm font-medium">
                {primary ? primary.label : "No forward action available"}
              </div>
              {primary?.helper ? (
                <p className="mt-1 text-xs text-muted-foreground">{primary.helper}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {secondary.map((action) => {
                const Icon = action.icon;
                const btn = (
                  <Button
                    key={action.key}
                    size="sm"
                    variant={action.variant}
                    onClick={() => onRequestAction(action.key)}
                    disabled={anyPending || !canManage}
                    className="gap-1.5"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
                if (!canManage) {
                  return (
                    <TooltipProvider key={action.key}>
                      <Tooltip>
                        <TooltipTrigger asChild><span className="inline-flex cursor-not-allowed">{btn}</span></TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-xs">You do not have permission to perform this action.</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                }
                return btn;
              })}
              {primary ? (
                (() => {
                  const btn = (
                    <Button
                      size="sm"
                      variant={primary.variant}
                      onClick={() => onRequestAction(primary.key)}
                      disabled={anyPending || pending[primary.key] || !canManage}
                      className="gap-1.5"
                    >
                      {pending[primary.key] ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin" />
                      ) : (
                        <primary.icon className="h-4 w-4" />
                      )}
                      {primary.label}
                    </Button>
                  );
                  if (!canManage) {
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild><span className="inline-flex cursor-not-allowed">{btn}</span></TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">You do not have permission to perform this action.</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }
                  return btn;
                })()
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
