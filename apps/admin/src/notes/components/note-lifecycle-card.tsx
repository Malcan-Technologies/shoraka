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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildNoteLifecycleActionPlan,
  findIssuerDisbursementWithdrawal,
  getNoteLifecycleCardTone,
  getNoteLifecycleStageCompletedAt,
  getNoteLifecycleStageIndex,
  getNoteLifecycleTerminalFailure,
  isDisbursementComplete,
  type NoteLifecycleAction,
} from "@/notes/utils/note-lifecycle-actions";
import { StatusBadge } from "@cashsouk/ui";
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
  type WorkflowStatusTone,
  WORKFLOW_CARD,
  disbursementLifecycleStripTone,
  settlementLifecycleStripTone,
  workflowToneToStatusToken,
} from "@/notes/utils/workflow-status-tokens";

export type { NoteLifecycleAction } from "@/notes/utils/note-lifecycle-actions";

const ACTION_ICONS: Record<NoteLifecycleAction, React.ComponentType<{ className?: string }>> = {
  publish: GlobeAltIcon,
  unpublish: ArrowUturnLeftIcon,
  closeFunding: ArrowRightCircleIcon,
  failFunding: ExclamationTriangleIcon,
};

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

const ACTION_CARD_CLASS = WORKFLOW_CARD.activeSection;

const LIFECYCLE_STEPPER_FILL = {
  success: "bg-status-success-bg text-status-success-text ring-status-success-text/20",
  active: "bg-status-active-bg text-status-active-text ring-status-active-text/20",
  action: "bg-status-action-bg text-status-action-text ring-status-action-text/20",
  submitted: "bg-status-submitted-bg text-status-submitted-text ring-status-submitted-text/20",
  rejected: "bg-status-rejected-bg text-status-rejected-text ring-status-rejected-text/20",
  neutral: "bg-status-neutral-bg text-status-neutral-text ring-status-neutral-text/15",
} as const;

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
      tone: "active",
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

  const tone = disbursementLifecycleStripTone(withdrawal.status);

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

  const trusteeSubmittedToTrustee = Boolean(
    postedSettlement && postedSettlement.serviceFeeTrusteeStatus === "SUBMITTED_TO_TRUSTEE"
  );

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

  const tone = settlementLifecycleStripTone({
    settledComplete,
    receiptsComplete,
    postedComplete,
    trusteeComplete,
    trusteeSubmittedToTrustee,
  });

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
    return "Settlement is posted. Complete the settlement trustee instruction — including any issuer refund allocation — from the Servicing tab.";
  }
  if (postedSettlement && trusteeComplete) {
    return "Settlement allocations are finishing on the ledger.";
  }
  if (receiptsComplete) {
    return "Receipts meet the settlement amount. Preview, approve, and post from the Servicing tab.";
  }
  return "Record and reconcile repayment receipts from the Servicing tab.";
}

function workflowStripSurfaceClass(tone: WorkflowStatusTone) {
  if (tone === "success") return WORKFLOW_CARD.successSection;
  if (tone === "warning") return WORKFLOW_CARD.warningSection;
  if (tone === "danger") return "border-status-rejected-text/20 bg-[hsl(var(--status-rejected-bg)/0.45)]";
  if (tone === "active") return WORKFLOW_CARD.activeSection;
  return WORKFLOW_CARD.neutralSection;
}

function workflowStripTitleClass(tone: WorkflowStatusTone) {
  if (tone === "success") return "text-status-success-text";
  if (tone === "danger") return "text-status-rejected-text";
  if (tone === "warning") return "text-status-submitted-text";
  if (tone === "active") return "text-status-action-text";
  return "text-muted-foreground";
}

function workflowStripBodyClass(tone: WorkflowStatusTone) {
  if (tone === "success") return "text-status-success-text/80";
  if (tone === "danger") return "text-status-rejected-text/80";
  if (tone === "warning") return "text-status-submitted-text/80";
  if (tone === "active") return "text-status-action-text/80";
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
                    ? LIFECYCLE_STEPPER_FILL.success
                    : step.status === "current"
                      ? tone === "danger"
                        ? LIFECYCLE_STEPPER_FILL.rejected
                        : tone === "neutral"
                          ? LIFECYCLE_STEPPER_FILL.neutral
                          : tone === "warning"
                            ? LIFECYCLE_STEPPER_FILL.submitted
                            : tone === "success"
                              ? LIFECYCLE_STEPPER_FILL.success
                              : LIFECYCLE_STEPPER_FILL.action
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
                      ? "font-medium text-status-success-text"
                      : tone === "warning"
                        ? "font-medium text-status-submitted-text"
                        : tone === "active"
                          ? "font-medium text-status-action-text"
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
                  step.status === "done" ? "bg-status-success-bg" : "bg-border"
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
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-1",
        failed && active
          ? LIFECYCLE_STEPPER_FILL.rejected
          : past
            ? LIFECYCLE_STEPPER_FILL.success
            : active
              ? LIFECYCLE_STEPPER_FILL.active
              : LIFECYCLE_STEPPER_FILL.neutral
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
  /** Body only, for callers that already provide the card frame and heading. */
  unframed?: boolean;
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

export function NoteLifecycleCard({
  note,
  pending,
  onRequestAction,
  canManage = true,
  unframed = false,
}: NoteLifecycleCardProps) {
  const activeIndex = getNoteLifecycleStageIndex(note);
  const isComplete = isNoteLifecycleVisuallyComplete(note);
  const { primary, secondary, contextHelper, isFundingOpen } = buildNoteLifecycleActionPlan(note);
  const lifecycleCardTone = getNoteLifecycleCardTone(note);
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
  const hasPostedSettlement = note.settlements.some((settlement) => settlement.status === "POSTED");
  const pendingResidualWithdrawal =
    (note.withdrawals ?? []).find(
      (withdrawal) =>
        withdrawal.withdrawalType === "ISSUER_RESIDUAL_RETURN" &&
        withdrawal.status !== "COMPLETED" &&
        withdrawal.status !== "CANCELLED"
    ) ?? null;
  const awaitingResidual =
    !isComplete && hasPostedSettlement && pendingResidualWithdrawal !== null;
  const terminalFailure = getNoteLifecycleTerminalFailure(note, activeIndex);
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
      : awaitingResidual
        ? "Repayment in progress"
        : awaitingDisbursement
          ? "Awaiting issuer disbursement"
          : `Currently ${currentStage.label}`;
  const headerDescription = isComplete
    ? "All settlement allocations are complete. The note lifecycle is complete."
    : terminalFailure
      ? defaultedWithSettlementTrusteeWork
        ? "The note has defaulted. Settlement has been posted and recovery is in progress. Complete the settlement trustee instruction — including any issuer refund allocation — from the Servicing tab."
        : terminalFailure.description
      : awaitingResidual
        ? "Settlement waterfall posted. Investors have been paid. The issuer residual refund must be disbursed to close the lifecycle."
        : awaitingDisbursement
          ? "Funding has closed. Complete issuer disbursement (Tawarruq, certificate, trustee instruction) before servicing begins."
          : null;

  const contextLines: string[] = [];
  if (!terminalFailure && !isComplete && !awaitingDisbursement && !awaitingResidual) {
    if (isFundingOpen) {
      contextLines.push(
        `${note.investments.length} commitment${note.investments.length === 1 ? "" : "s"}`
      );
    } else if (activeIndex >= 4) {
      contextLines.push(`${formatCurrency(note.fundedAmount)} disbursed`);
      contextLines.push(
        `${note.investments.length} investor${note.investments.length === 1 ? "" : "s"}`
      );
    }
  }
  const body = (
    <>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {unframed ? null : (
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Note Lifecycle
              </div>
            )}
            <div className="mt-1 flex items-center gap-2">
              <h3 className="text-lg font-semibold">{headerTitle}</h3>
              {isComplete ? (
                <StatusBadge label="Complete" status="success" />
              ) : terminalFailure ? (
                <StatusBadge label="Terminal" status="rejected" />
              ) : awaitingDisbursement ? (
                <StatusBadge label="Pending disbursement" status="action" />
              ) : awaitingResidual ? (
                <StatusBadge label="Pending refund" status="action" />
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

        <div className="flex items-start gap-1 overflow-x-auto px-1 py-1 sm:gap-2">
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
            const completedAt =
              isPast || isComplete ? getNoteLifecycleStageCompletedAt(note, stage.id) : null;
            return (
              <React.Fragment key={stage.id}>
                <div className="flex shrink-0 flex-col">
                  <div className="flex h-8 items-center gap-2">
                    <StageDot
                      index={idx}
                      active={isCurrent || isFailureStage}
                      past={isPast && !isFailureStage}
                      failed={isFailureStage}
                    />
                    <span
                      className={cn(
                        "text-sm",
                        isFailureStage
                          ? "font-semibold text-status-rejected-text"
                          : isCurrent
                            ? "font-semibold text-status-active-text"
                            : isPast
                              ? "text-status-success-text"
                              : "text-muted-foreground"
                      )}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {completedAt ? (
                    <p className="mt-1 pl-10 text-meta text-muted-foreground">
                      {format(new Date(completedAt), "dd MMM yyyy")}
                    </p>
                  ) : null}
                </div>
                {idx < STAGES.length - 1 ? (
                  <div
                    className={cn(
                      "mt-3.5 h-1 min-w-4 flex-1 rounded-full",
                      connectorActive ? "bg-status-success-bg" : "bg-border"
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
            helperText="Continue this from the Disbursement tab."
          />
        ) : null}

        {showLatePaymentStrip ? (
          <div className={cn("rounded-xl border p-3", workflowStripSurfaceClass(latePaymentStripTone))}>
            <div className="flex flex-wrap items-center gap-2">
              <div
                className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  workflowStripTitleClass(latePaymentStripTone)
                )}
              >
                Late payment
              </div>
              <StatusBadge
                label={LATE_PAYMENT_WORKFLOW_BADGE[latePaymentTimeline.phase].label}
                status={workflowToneToStatusToken(latePaymentStripTone)}
              />
            </div>
            <p className={cn("mt-2 text-xs", workflowStripBodyClass(latePaymentStripTone))}>
              Manage this from the Late Payment tab.
            </p>
          </div>
        ) : null}

        {autoClose ? (
          <div
            className={cn(
              "flex flex-wrap items-center gap-2 rounded-xl border p-3 text-sm",
              autoClose.fullyFunded
                ? "border-status-success-text/25 bg-status-success-bg text-status-success-text"
                  : autoClose.overdue
                    ? "border-status-action-text/25 bg-status-action-bg text-status-action-text"
                  : "border-border bg-card text-muted-foreground"
            )}
          >
            <ClockIcon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "font-medium",
                  autoClose.fullyFunded ? "text-status-success-text" : "text-foreground"
                )}
              >
                {autoClose.label}
              </div>
              <div
                className={cn(
                  "text-xs",
                  autoClose.fullyFunded ? "text-status-success-text/80" : "text-muted-foreground"
                )}
              >
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
                {primary ? "Next Step" : "Actions"}
              </div>
              <div className="mt-1 text-sm font-medium">
                {primary ? primary.label : contextHelper ?? "No forward action available"}
              </div>
              {primary?.helper ? (
                <p className="mt-1 text-xs text-muted-foreground">{primary.helper}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {secondary.map((action) => {
                const Icon = ACTION_ICONS[action.key];
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
                  const PrimaryIcon = ACTION_ICONS[primary.key];
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
                        <PrimaryIcon className="h-4 w-4" />
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
    </>
  );

  if (unframed) {
    return <div className="space-y-5">{body}</div>;
  }

  return (
    <Card
      className={cn(
        "rounded-2xl",
        lifecycleCardTone === "action" && ACTION_CARD_CLASS,
        lifecycleCardTone === "waiting" && WORKFLOW_CARD.warningSection
      )}
    >
      <CardContent className="space-y-5 p-5">{body}</CardContent>
    </Card>
  );
}
