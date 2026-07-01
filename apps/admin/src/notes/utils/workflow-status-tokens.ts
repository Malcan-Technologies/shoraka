/**
 * Note detail workflow colors:
 * - success (green): final / no further action
 * - active (red): current step / admin action required now
 * - warning (amber): monitoring / waiting on external party
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
      "border-transparent bg-status-rejected-bg text-status-rejected-text dark:bg-red-950/40 dark:text-red-300",
    dotClass: "bg-status-rejected-text dark:bg-red-300",
  },
  warning: {
    badgeClass:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    dotClass: "bg-amber-500 dark:bg-amber-300",
  },
  neutral: {
    badgeClass:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-status-neutral-text dark:bg-slate-300",
  },
  danger: {
    badgeClass:
      "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
    dotClass: "bg-destructive",
  },
};

export const WORKFLOW_CARD = {
  successSection: "border-emerald-200 bg-emerald-50/40",
  successPanel: "border-emerald-200 bg-emerald-50/80",
  activeSection:
    "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08),0_0_28px_hsl(var(--primary)/0.16)]",
  activeStep:
    "border-primary/35 bg-primary/5 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]",
  warningPanel: "border-amber-200 bg-amber-50/80",
  warningSection: "border-amber-200 bg-amber-50/50",
  neutralSection: "border-border bg-muted/20",
  neutralCard: "border-border bg-card",
} as const;

export const WORKFLOW_SUCCESS_COPY = {
  sectionHeader: "mb-2 text-xs font-medium uppercase tracking-wider text-emerald-900",
  title: "text-emerald-900",
  body: "text-emerald-800",
  badge: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
} as const;

export type SimpleTabStatus = "done" | "needs-action" | "not-started" | "view-only";

export const NOTE_WORKFLOW_TAB_BADGE: Record<
  SimpleTabStatus,
  { label: string } & WorkflowBadgeTokens
> = {
  done: { label: "Done", ...WORKFLOW_STATUS_BADGE.success },
  "needs-action": { label: "In progress", ...WORKFLOW_STATUS_BADGE.active },
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
  if (status === "DRAFT") return "neutral";
  if (status === "LETTER_GENERATED") return "active";
  if (status === "SUBMITTED_TO_TRUSTEE") return "warning";
  return "neutral";
}

/** Parent disbursement header: red while workflow is open; amber only when waiting on trustee confirmation. */
export function withdrawalHeaderBadgeTone(status: WithdrawalWorkflowStatus): WorkflowStatusTone {
  if (status === "COMPLETED") return "success";
  if (status === "CANCELLED") return "neutral";
  if (status === "SUBMITTED_TO_TRUSTEE") return "warning";
  return "active";
}

export function trusteeWorkflowTone(
  status: TrusteeWorkflowStatus,
  options?: { needsGeneration?: boolean }
): WorkflowStatusTone {
  if (status === "COMPLETED") return "success";
  if (status === "SUBMITTED_TO_TRUSTEE") return "warning";
  if (status === "LETTER_GENERATED") return "active";
  if (options?.needsGeneration || status === "PENDING_LETTER" || status === null) return "neutral";
  return "neutral";
}

export type TawarruqWorkflowState =
  | "checking"
  | "not-submitted"
  | "in-progress"
  | "certificate-ready";

/** Tawarruq sub-step badge only; parent disbursement card/tab stay active until COMPLETED. */
export function tawarruqWorkflowTone(state: TawarruqWorkflowState): WorkflowStatusTone {
  if (state === "certificate-ready") return "success";
  if (state === "in-progress") return "active";
  return "neutral";
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
  if (status === "VOID") return "danger";
  if (status === "PENDING") return "warning";
  if (status === "RECEIVED" || status === "RECONCILED") return "success";
  return "neutral";
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
  if (phase === "in-grace" || phase === "arrears") return "warning";
  if (phase === "default-eligible") return "active";
  if (phase === "defaulted") return "danger";
  return "neutral";
}

export function workflowBadgeClassName(tone: WorkflowStatusTone) {
  return WORKFLOW_STATUS_BADGE[tone].badgeClass;
}
