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
import type { NoteDetail, ServiceFeeTrusteeInstructionStatus } from "@cashsouk/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type NoteLifecycleAction = "publish" | "unpublish" | "closeFunding" | "failFunding";

type StageId = "DRAFT" | "PUBLISHED" | "FUNDED" | "ACTIVE" | "REPAID";

interface LifecycleStage {
  id: StageId;
  label: string;
}

const STAGES: LifecycleStage[] = [
  { id: "DRAFT", label: "Draft" },
  { id: "PUBLISHED", label: "Published" },
  { id: "FUNDED", label: "Funded" },
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
      stageIndex: 3,
    };
  }
  return null;
}

function getActiveStageIndex(note: NoteDetail): number {
  const hasPostedSettlement = note.settlements.some((s) => s.status === "POSTED");
  if (note.status === "REPAID" || note.servicingStatus === "SETTLED" || hasPostedSettlement) {
    return 4;
  }
  if (
    note.status === "ACTIVE" ||
    note.status === "ARREARS" ||
    note.status === "DEFAULTED" ||
    note.servicingStatus === "CURRENT"
  ) {
    return 3;
  }
  if (note.status === "FUNDING" || note.fundingStatus === "FUNDED") {
    return 2;
  }
  if (note.status === "PUBLISHED") return 1;
  return 0;
}

type PayoutSubStep = {
  id: "INITIATED" | "LETTER" | "SUBMITTED" | "DISBURSED";
  label: string;
  status: "done" | "current" | "pending";
};

function buildPayoutSubSteps(withdrawalStatus: string, initiatedLabel: string): PayoutSubStep[] {
  const completedThrough =
    withdrawalStatus === "COMPLETED"
      ? 3
      : withdrawalStatus === "SUBMITTED_TO_TRUSTEE"
        ? 2
        : withdrawalStatus === "LETTER_GENERATED"
          ? 1
          : 0;
  const labels = [initiatedLabel, "Letter generated", "Submitted to trustee", "Disbursed"];
  const ids: Array<PayoutSubStep["id"]> = ["INITIATED", "LETTER", "SUBMITTED", "DISBURSED"];
  return labels.map((label, idx) => ({
    id: ids[idx],
    label,
    status: idx <= completedThrough ? "done" : idx === completedThrough + 1 ? "current" : "pending",
  }));
}

type ServiceFeeSubStep = {
  id: "POSTED" | "LETTER" | "SUBMITTED" | "COMPLETED";
  label: string;
  status: "done" | "current" | "pending";
};

function buildServiceFeeSubSteps(
  trusteeStatus: ServiceFeeTrusteeInstructionStatus | null
): ServiceFeeSubStep[] {
  const completedThrough =
    trusteeStatus === "COMPLETED"
      ? 3
      : trusteeStatus === "SUBMITTED_TO_TRUSTEE"
        ? 2
        : trusteeStatus === "LETTER_GENERATED"
          ? 1
          : 0;
  const labels = [
    "Settlement posted",
    "Trustee letter generated",
    "Submitted to trustee",
    "Instruction completed",
  ];
  const ids: ServiceFeeSubStep["id"][] = ["POSTED", "LETTER", "SUBMITTED", "COMPLETED"];
  return labels.map((label, idx) => ({
    id: ids[idx],
    label,
    status:
      idx <= completedThrough
        ? "done"
        : idx === completedThrough + 1
          ? "current"
          : "pending",
  }));
}

function serviceFeeTrusteeHelperText(trusteeStatus: ServiceFeeTrusteeInstructionStatus | null): string {
  if (trusteeStatus === "COMPLETED") {
    return "Service fee trustee instruction workflow is complete for this settlement.";
  }
  if (trusteeStatus === "SUBMITTED_TO_TRUSTEE") {
    return "Mark the instruction complete in section 3 of the settlement panel once the trustee has processed the internal pool allocation.";
  }
  if (trusteeStatus === "LETTER_GENERATED") {
    return "Submit the PDF to the trustee, then mark submitted and complete from the settlement panel below.";
  }
  return `Generate the PDF from Trustee instruction — service fee (internal pools) in section 3 of the settlement panel below. This documents the Repayment pool to Operating account allocation; it is not an external bank payout.`;
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
    contextHelper = "Servicing is active. Manage receipts and settlement in the panels below.";
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

export function NoteLifecycleCard({ note, pending, onRequestAction }: NoteLifecycleCardProps) {
  const activeIndex = getActiveStageIndex(note);
  const isComplete = note.status === "REPAID" || note.servicingStatus === "SETTLED";
  const { primary, secondary, contextHelper, isFundingOpen } = buildActionPlan(note);
  const anyPending = Object.values(pending).some(Boolean);
  const currentStage = STAGES[activeIndex];
  const autoClose = isFundingOpen ? getAutoCloseInfo(note) : null;
  const pendingResidualWithdrawal =
    (note.withdrawals ?? []).find(
      (w) =>
        w.withdrawalType === "ISSUER_RESIDUAL_RETURN" &&
        w.status !== "COMPLETED" &&
        w.status !== "CANCELLED"
    ) ?? null;
  const pendingDisbursementWithdrawal =
    (note.withdrawals ?? []).find(
      (w) =>
        w.withdrawalType === "ISSUER_DISBURSEMENT" &&
        w.status !== "COMPLETED" &&
        w.status !== "CANCELLED"
    ) ?? null;
  const hasPostedSettlement = note.settlements.some((s) => s.status === "POSTED");
  const awaitingResidual = !isComplete && hasPostedSettlement && pendingResidualWithdrawal !== null;
  const terminalFailure = awaitingResidual ? null : getTerminalFailure(note, activeIndex);
  const awaitingDisbursement =
    !isComplete && !terminalFailure && activeIndex === 2 && pendingDisbursementWithdrawal !== null;

  const postedSettlementWithServiceFee =
    note.settlements.find(
      (s) => s.status === "POSTED" && s.serviceFeeAmount > 0.005
    ) ?? null;
  const serviceFeeTrusteeStatus = postedSettlementWithServiceFee?.serviceFeeTrusteeStatus ?? null;
  const serviceFeeWorkflowComplete = serviceFeeTrusteeStatus === "COMPLETED";
  const showServiceFeeSubStepper =
    postedSettlementWithServiceFee !== null && !terminalFailure;
  const serviceFeeSubSteps = showServiceFeeSubStepper
    ? buildServiceFeeSubSteps(serviceFeeTrusteeStatus)
    : null;

  const payoutSubSteps =
    awaitingResidual && pendingResidualWithdrawal
      ? buildPayoutSubSteps(pendingResidualWithdrawal.status, "Waterfall posted")
      : awaitingDisbursement && pendingDisbursementWithdrawal
        ? buildPayoutSubSteps(pendingDisbursementWithdrawal.status, "Funding closed")
        : null;
  const payoutLabel = awaitingResidual
    ? "Issuer residual refund · awaiting disbursement"
    : awaitingDisbursement
      ? "Issuer disbursement · awaiting payout to start servicing"
      : null;

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
    ? "All investor obligations satisfied and issuer residual disbursed. The note lifecycle is complete."
    : terminalFailure
      ? terminalFailure.description
      : awaitingResidual
        ? "Settlement waterfall posted. Investors have been paid. The issuer residual refund must be disbursed to close the lifecycle."
        : awaitingDisbursement
          ? "Funding has closed and investor commitments are confirmed. The net disbursement to the issuer must be paid out before servicing begins."
          : null;

  const contextLines: string[] = [];
  if (!terminalFailure && !isComplete && !awaitingDisbursement && !awaitingResidual) {
    if (isFundingOpen) {
      contextLines.push(
        `${note.fundingPercent.toFixed(1)}% of ${formatCurrency(note.targetAmount)} funded`
      );
      contextLines.push(
        `${note.investments.length} commitment${note.investments.length === 1 ? "" : "s"}`
      );
      contextLines.push(`Minimum ${note.minimumFundingPercent}% to close`);
    } else if (activeIndex === 3) {
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
                <Badge variant="destructive" className="uppercase">
                  Terminal
                </Badge>
              ) : awaitingDisbursement ? (
                <Badge variant="secondary" className="uppercase">
                  Pending Disbursement
                </Badge>
              ) : awaitingResidual ? (
                <Badge variant="secondary" className="uppercase">
                  Pending Refund
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

        {serviceFeeSubSteps ? (
          <div
            className={cn(
              "rounded-xl border p-3",
              serviceFeeWorkflowComplete
                ? "border-emerald-200 bg-emerald-50/60"
                : "border-amber-200 bg-amber-50/60"
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className={cn(
                  "text-xs font-medium uppercase tracking-wider",
                  serviceFeeWorkflowComplete ? "text-emerald-900" : "text-amber-900"
                )}
              >
                Service fee · internal pool instruction
              </div>
              <div
                className={cn(
                  "text-xs",
                  serviceFeeWorkflowComplete ? "text-emerald-900/80" : "text-amber-900/80"
                )}
              >
                {serviceFeeSubSteps.filter((step) => step.status === "done").length} of{" "}
                {serviceFeeSubSteps.length} steps complete
              </div>
            </div>
            <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {serviceFeeSubSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <li className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ring-1",
                        step.status === "done"
                          ? "bg-emerald-500 text-white ring-emerald-500"
                          : step.status === "current"
                            ? "bg-amber-500 text-white ring-amber-500"
                            : "bg-white text-amber-700 ring-amber-200"
                      )}
                    >
                      {step.status === "done" ? <CheckIcon className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span
                      className={cn(
                        step.status === "pending"
                          ? "text-amber-700/70"
                          : serviceFeeWorkflowComplete
                            ? "font-medium text-emerald-950"
                            : "font-medium text-amber-950"
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                  {idx < serviceFeeSubSteps.length - 1 ? (
                    <span
                      className={cn(
                        "h-px w-4",
                        step.status === "done" ? "bg-emerald-500" : "bg-amber-200"
                      )}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </ol>
            <p
              className={cn(
                "mt-2 text-xs",
                serviceFeeWorkflowComplete ? "text-emerald-900/80" : "text-amber-900/80"
              )}
            >
              {serviceFeeTrusteeHelperText(serviceFeeTrusteeStatus)}
            </p>
          </div>
        ) : null}

        {payoutSubSteps ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium uppercase tracking-wider text-amber-900">
                {payoutLabel}
              </div>
              <div className="text-xs text-amber-900/80">
                {payoutSubSteps.filter((step) => step.status === "done").length} of{" "}
                {payoutSubSteps.length} steps complete
              </div>
            </div>
            <ol className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              {payoutSubSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  <li className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ring-1",
                        step.status === "done"
                          ? "bg-emerald-500 text-white ring-emerald-500"
                          : step.status === "current"
                            ? "bg-amber-500 text-white ring-amber-500"
                            : "bg-white text-amber-700 ring-amber-200"
                      )}
                    >
                      {step.status === "done" ? <CheckIcon className="h-3 w-3" /> : idx + 1}
                    </span>
                    <span
                      className={cn(
                        step.status === "pending"
                          ? "text-amber-700/70"
                          : "font-medium text-amber-950"
                      )}
                    >
                      {step.label}
                    </span>
                  </li>
                  {idx < payoutSubSteps.length - 1 ? (
                    <span
                      className={cn(
                        "h-px w-4",
                        step.status === "done" ? "bg-emerald-500" : "bg-amber-200"
                      )}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </ol>
            <p className="mt-2 text-xs text-amber-900/80">
              Progress this from the{" "}
              <span className="font-medium">
                {awaitingDisbursement ? "Issuer Disbursement" : "Issuer Residual Refund"}
              </span>{" "}
              card in the settlement panel below.
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
                return (
                  <Button
                    key={action.key}
                    size="sm"
                    variant={action.variant}
                    onClick={() => onRequestAction(action.key)}
                    disabled={anyPending}
                    className="gap-1.5"
                  >
                    <Icon className="h-4 w-4" />
                    {action.label}
                  </Button>
                );
              })}
              {primary ? (
                <Button
                  size="sm"
                  variant={primary.variant}
                  onClick={() => onRequestAction(primary.key)}
                  disabled={anyPending || pending[primary.key]}
                  className="gap-1.5"
                >
                  {pending[primary.key] ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <primary.icon className="h-4 w-4" />
                  )}
                  {primary.label}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
