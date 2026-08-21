import {
  ADMIN_ACTION_SURFACE_CLASS,
  ADMIN_WAITING_SURFACE_CLASS,
} from "@/lib/admin-status-token";

/**
 * Note detail workflow colors — same tokens as StatusBadge:
 * - success (green): final / no further action
 * - active (yellow): current step / admin action required now
 * - warning (blue): monitoring / waiting on an external party
 * - neutral (gray): not started / unavailable / blocked
 * - danger (red): negative final outcomes (e.g. defaulted)
 */

export type WorkflowStatusTone = "success" | "active" | "warning" | "neutral" | "danger";

export type WorkflowBadgeTokens = {
  badgeClass: string;
  dotClass: string;
};

export const WORKFLOW_STATUS_BADGE: Record<WorkflowStatusTone, WorkflowBadgeTokens> = {
  success: {
    badgeClass:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClass: "bg-status-success-text dark:bg-emerald-300",
  },
  active: {
    badgeClass:
      "border-transparent bg-status-action-bg text-status-action-text dark:bg-amber-950/40 dark:text-amber-300",
    dotClass: "bg-status-action-text dark:bg-amber-300",
  },
  warning: {
    badgeClass:
      "border-transparent bg-status-submitted-bg text-status-submitted-text dark:bg-blue-950/40 dark:text-blue-300",
    dotClass: "bg-status-submitted-text dark:bg-blue-300",
  },
  neutral: {
    badgeClass:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-status-neutral-text dark:bg-slate-300",
  },
  danger: {
    badgeClass:
      "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    dotClass: "bg-status-rejected-text dark:bg-red-300",
  },
};

/** Same 45% wash as the note-detail next-action banner. */
const ACTION_WASH = ADMIN_ACTION_SURFACE_CLASS;
const WAITING_WASH = ADMIN_WAITING_SURFACE_CLASS;
const SUCCESS_WASH = "border-status-success-text/20 bg-status-success-bg/40";

export const WORKFLOW_CARD = {
  successSection: SUCCESS_WASH,
  successPanel: SUCCESS_WASH,
  activeSection: ACTION_WASH,
  activeStep: ACTION_WASH,
  warningPanel: WAITING_WASH,
  warningSection: WAITING_WASH,
  neutralSection: "border-border bg-muted/20",
  neutralCard: "border-border bg-card",
} as const;

export function workflowTaskSurfaceClass(tone: WorkflowStatusTone) {
  if (tone === "success") return WORKFLOW_CARD.successSection;
  if (tone === "active") return WORKFLOW_CARD.activeSection;
  if (tone === "warning") return WORKFLOW_CARD.warningSection;
  if (tone === "danger") {
    return "border-status-rejected-text/20 bg-[hsl(var(--status-rejected-bg)/0.45)]";
  }
  return WORKFLOW_CARD.neutralSection;
}

export const WORKFLOW_SUCCESS_COPY = {
  sectionHeader: "text-sm font-medium text-status-success-text",
  title: "text-status-success-text",
  body: "text-status-success-text/80",
  badge: "border-status-success-text/20 bg-status-success-bg text-status-success-text",
} as const;

export type SimpleTabStatus =
  | "done"
  | "needs-action"
  | "in-progress"
  | "not-started"
  | "view-only";

export const NOTE_WORKFLOW_TAB_BADGE: Record<
  SimpleTabStatus,
  { label: string } & WorkflowBadgeTokens
> = {
  done: { label: "Done", ...WORKFLOW_STATUS_BADGE.success },
  "needs-action": { label: "In progress", ...WORKFLOW_STATUS_BADGE.active },
  "in-progress": { label: "In progress", ...WORKFLOW_STATUS_BADGE.warning },
  "not-started": { label: "Not started", ...WORKFLOW_STATUS_BADGE.neutral },
  "view-only": { label: "View only", ...WORKFLOW_STATUS_BADGE.neutral },
};

export type WithdrawalWorkflowStatus =
  | "DRAFT"
  | "LETTER_GENERATED"
  | "SUBMITTED_TO_TRUSTEE"
  | "COMPLETED"
  | "CANCELLED";

export type TrusteeWorkflowStatus =
  | "PENDING_LETTER"
  | "LETTER_GENERATED"
  | "SUBMITTED_TO_TRUSTEE"
  | "COMPLETED"
  | null;

export function withdrawalWorkflowTone(status: WithdrawalWorkflowStatus): WorkflowStatusTone {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "neutral";
  if (status === "SUBMITTED_TO_TRUSTEE") return "warning";
  return "active";
}

/** Parent disbursement header: yellow while CashSouk must act; blue when waiting on trustee. */
export function withdrawalHeaderBadgeTone(status: WithdrawalWorkflowStatus): WorkflowStatusTone {
  return withdrawalWorkflowTone(status);
}

export function trusteeWorkflowTone(
  status: TrusteeWorkflowStatus,
  options?: { needsGeneration?: boolean }
): WorkflowStatusTone {
  if (status === "COMPLETED") return "success";
  if (status === "SUBMITTED_TO_TRUSTEE") return "warning";
  if (status === "LETTER_GENERATED") return "active";
  if (options?.needsGeneration || status === "PENDING_LETTER" || status === null) return "active";
  return "neutral";
}

export type TawarruqWorkflowState =
  | "checking"
  | "not-submitted"
  | "in-progress"
  | "certificate-ready";

/** Tawarruq sub-step: yellow until the certificate is in, then green. */
export function tawarruqWorkflowTone(state: TawarruqWorkflowState): WorkflowStatusTone {
  if (state === "certificate-ready") return "success";
  if (state === "checking") return "neutral";
  return "active";
}

export type ServicingStageLabel =
  | "Waiting for servicing"
  | "Repayment collection"
  | "Settlement preparation"
  | "Settlement posted";

export function servicingStageTone(stage: ServicingStageLabel): WorkflowStatusTone {
  if (stage === "Settlement posted") return "success";
  if (stage === "Waiting for servicing") return "neutral";
  return "active";
}

export type SettlementPanelTone = "success" | "active" | "neutral";

export function settlementPanelTone(tone: SettlementPanelTone): WorkflowStatusTone {
  if (tone === "success") return "success";
  if (tone === "active") return "active";
  return "neutral";
}

export function paymentReceiptTone(status: string): WorkflowStatusTone {
  if (status === "VOID" || status === "REJECTED") return "danger";
  if (status === "PENDING" || status === "PARTIAL") return "active";
  if (status === "RECEIVED" || status === "RECONCILED" || status === "SETTLED") return "success";
  return "neutral";
}

const PAYMENT_RECEIPT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  RECEIVED: "Received",
  RECONCILED: "Reconciled",
  SETTLED: "Settled",
  VOID: "Void",
  REJECTED: "Rejected",
};

export function paymentReceiptStatusLabel(status: string): string {
  return (
    PAYMENT_RECEIPT_STATUS_LABEL[status] ??
    status
      .toLowerCase()
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

export function disbursementLifecycleStripTone(
  status: WithdrawalWorkflowStatus | null
): WorkflowStatusTone {
  if (status == null) return "active";
  return withdrawalWorkflowTone(status);
}

export function settlementLifecycleStripTone(input: {
  settledComplete: boolean;
  receiptsComplete: boolean;
  postedComplete: boolean;
  trusteeComplete: boolean;
  trusteeSubmittedToTrustee: boolean;
}): WorkflowStatusTone {
  if (input.settledComplete || (input.postedComplete && input.trusteeComplete)) {
    return "success";
  }
  if (input.postedComplete && input.trusteeSubmittedToTrustee && !input.trusteeComplete) {
    return "warning";
  }
  return "active";
}

export function latePaymentPhaseTone(
  phase:
    | "not-available"
    | "not-needed"
    | "in-grace"
    | "arrears"
    | "default-eligible"
    | "defaulted"
): WorkflowStatusTone {
  if (phase === "not-needed") return "success";
  if (phase === "not-available") return "neutral";
  if (phase === "in-grace") return "warning";
  if (phase === "arrears" || phase === "default-eligible" || phase === "defaulted") {
    return "danger";
  }
  return "neutral";
}

export function workflowBadgeClassName(tone: WorkflowStatusTone) {
  return WORKFLOW_STATUS_BADGE[tone].badgeClass;
}

export function workflowToneToStatusToken(
  tone: WorkflowStatusTone
): "success" | "action" | "submitted" | "rejected" | "neutral" {
  switch (tone) {
    case "success":
      return "success";
    case "active":
      return "action";
    case "warning":
      return "submitted";
    case "danger":
      return "rejected";
    default:
      return "neutral";
  }
}
