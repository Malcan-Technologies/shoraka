import type { NoteDetail } from "@cashsouk/types";

export type LatePaymentWorkflowPhase =
  | "not-available"
  | "not-needed"
  | "in-grace"
  | "arrears"
  | "default-eligible"
  | "defaulted";

export type LatePaymentTimeline = {
  phase: LatePaymentWorkflowPhase;
  dueDate: string | null;
  daysUntilDue: number;
  daysPastMaturity: number;
  /** Calendar days past the grace period end (late-fee / arrears clock). */
  daysOverdue: number;
  graceDaysLeft: number;
  daysAfterGrace: number;
  /** Workflow Status badge and tab header. */
  workflowLabel: string;
  /** Payment due / maturity subtitle on Servicing & Settlement. */
  servicingTimingLabel: string;
  /** Primary timing line on the Late Payment tab. */
  latePaymentTimingLabel: string;
  /** Secondary timing detail on the Late Payment tab (e.g. grace ended). */
  latePaymentTimingDetail: string | null;
  /** Late fees section status badge on the Late Payment tab. */
  lateFeeStatusLabel: string;
  /** @deprecated Use context-specific label fields. */
  overdueLabel: string;
};

export const LATE_PAYMENT_WORKFLOW_BADGE: Record<
  LatePaymentWorkflowPhase,
  { label: string; className: string; dotClass: string }
> = {
  "not-available": {
    label: "Not available",
    className:
      "border-transparent bg-status-neutral-bg text-status-neutral-text dark:bg-slate-800/50 dark:text-slate-300",
    dotClass: "bg-status-neutral-text dark:bg-slate-300",
  },
  "not-needed": {
    label: "Not needed",
    className:
      "border-transparent bg-status-success-bg text-status-success-text dark:bg-emerald-950/40 dark:text-emerald-300",
    dotClass: "bg-status-success-text dark:bg-emerald-300",
  },
  "in-grace": {
    label: "In grace",
    className:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    dotClass: "bg-amber-500 dark:bg-amber-300",
  },
  arrears: {
    label: "Arrears",
    className:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    dotClass: "bg-amber-500 dark:bg-amber-300",
  },
  "default-eligible": {
    label: "Default eligible",
    className:
      "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    dotClass: "bg-amber-500 dark:bg-amber-300",
  },
  defaulted: {
    label: "Defaulted",
    className:
      "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive",
    dotClass: "bg-destructive",
  },
};

function resolvePaymentDueDate(note: NoteDetail): string | null {
  const schedules = [...(note.paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  return schedules[0]?.dueDate ?? note.maturityDate ?? null;
}

function utcStartOfDayMs(date: Date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function calculateCalendarDayCount(startDate: Date, endDate: Date) {
  if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) return 0;
  return Math.max(
    0,
    Math.floor((utcStartOfDayMs(endDate) - utcStartOfDayMs(startDate)) / 86_400_000)
  );
}

function dayCountLabel(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function formatDueInLabel(daysUntilDue: number) {
  return daysUntilDue === 0 ? "Due today" : `Due in ${dayCountLabel(daysUntilDue, "day")}`;
}

function formatGraceRemainingLabel(graceDaysLeft: number) {
  return `${dayCountLabel(graceDaysLeft, "day")} of grace left`;
}

function formatGraceEndedDetail(daysAfterGrace: number) {
  return `Grace period ended ${dayCountLabel(daysAfterGrace, "day")} ago`;
}

const PAYMENT_OVERDUE = "Payment overdue";

function buildInGraceLabels(graceDaysLeft: number) {
  const graceRemaining = formatGraceRemainingLabel(graceDaysLeft);
  return {
    workflowLabel: "In grace",
    servicingTimingLabel: "Past due · within grace period",
    latePaymentTimingLabel: `Past due · ${graceRemaining}`,
    latePaymentTimingDetail: null,
    lateFeeStatusLabel: `Past due · ${graceRemaining}`,
    overdueLabel: `Past due · ${graceRemaining}`,
  };
}

function buildPastGraceLabels(daysAfterGrace: number, phase: "arrears" | "default-eligible") {
  const graceEndedDetail = formatGraceEndedDetail(daysAfterGrace);
  const latePaymentTimingLabel =
    phase === "default-eligible" ? "Default threshold reached" : PAYMENT_OVERDUE;
  return {
    workflowLabel: phase === "default-eligible" ? "Default eligible" : "Arrears",
    servicingTimingLabel: PAYMENT_OVERDUE,
    latePaymentTimingLabel,
    latePaymentTimingDetail: graceEndedDetail,
    lateFeeStatusLabel: latePaymentTimingLabel,
    overdueLabel: graceEndedDetail,
  };
}

function buildTimelineLabels(input: {
  workflowLabel: string;
  servicingTimingLabel: string;
  latePaymentTimingLabel: string;
  latePaymentTimingDetail?: string | null;
  lateFeeStatusLabel: string;
}) {
  return {
    workflowLabel: input.workflowLabel,
    servicingTimingLabel: input.servicingTimingLabel,
    latePaymentTimingLabel: input.latePaymentTimingLabel,
    latePaymentTimingDetail: input.latePaymentTimingDetail ?? null,
    lateFeeStatusLabel: input.lateFeeStatusLabel,
    overdueLabel: input.lateFeeStatusLabel,
  };
}

export function resolveLatePaymentTimeline(note: NoteDetail): LatePaymentTimeline {
  const dueDate = resolvePaymentDueDate(note);

  const isDefaulted =
    note.servicingStatus === "DEFAULTED" || note.status === "DEFAULTED";

  if (isDefaulted) {
    return {
      phase: "defaulted",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      ...buildTimelineLabels({
        workflowLabel: "Defaulted",
        servicingTimingLabel: "Defaulted",
        latePaymentTimingLabel: "Defaulted",
        lateFeeStatusLabel: "Defaulted",
      }),
    };
  }

  const servicingWorkflowAvailable =
    note.fundingStatus === "FUNDED" && note.servicingStatus !== "NOT_STARTED";
  if (!servicingWorkflowAvailable) {
    return {
      phase: "not-available",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      ...buildTimelineLabels({
        workflowLabel: "Not available",
        servicingTimingLabel: "Servicing not started",
        latePaymentTimingLabel: "Not available yet",
        lateFeeStatusLabel: "Not available yet",
      }),
    };
  }

  const settledWithoutDefault =
    note.status === "REPAID" || note.servicingStatus === "SETTLED";
  if (settledWithoutDefault) {
    return {
      phase: "not-needed",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      ...buildTimelineLabels({
        workflowLabel: "Not needed",
        servicingTimingLabel: "Settled or repaid",
        latePaymentTimingLabel: "Settled or repaid",
        lateFeeStatusLabel: "Not needed",
      }),
    };
  }

  if (!dueDate) {
    return {
      phase: "not-needed",
      dueDate: null,
      daysUntilDue: 0,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      ...buildTimelineLabels({
        workflowLabel: "Not needed",
        servicingTimingLabel: "No payment due date set",
        latePaymentTimingLabel: "No payment due date set",
        lateFeeStatusLabel: "No payment due date set",
      }),
    };
  }

  const dueDateValue = new Date(dueDate);
  const today = new Date();
  const daysPastMaturity = calculateCalendarDayCount(dueDateValue, today);
  const daysUntilDue = calculateCalendarDayCount(today, dueDateValue);
  const daysOverdue = Math.max(0, daysPastMaturity - note.gracePeriodDays);
  const graceDaysLeft = Math.max(0, note.gracePeriodDays - daysPastMaturity);
  const daysAfterGrace = daysOverdue;

  if (daysPastMaturity <= 0) {
    const dueLabel = formatDueInLabel(daysUntilDue);
    return {
      phase: "not-needed",
      dueDate,
      daysUntilDue,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...buildTimelineLabels({
        workflowLabel: "Not needed",
        servicingTimingLabel: dueLabel,
        latePaymentTimingLabel: dueLabel,
        lateFeeStatusLabel: "Not overdue",
      }),
    };
  }

  if (daysOverdue <= 0) {
    const inGrace = buildInGraceLabels(graceDaysLeft);
    return {
      phase: "in-grace",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...inGrace,
    };
  }

  if (daysAfterGrace < note.arrearsThresholdDays) {
    const pastGrace = buildPastGraceLabels(daysAfterGrace, "arrears");
    return {
      phase: "arrears",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...pastGrace,
    };
  }

  const defaultEligible = buildPastGraceLabels(daysAfterGrace, "default-eligible");
  return {
    phase: "default-eligible",
    dueDate,
    daysUntilDue: 0,
    daysPastMaturity,
    daysOverdue,
    graceDaysLeft,
    daysAfterGrace,
    ...defaultEligible,
  };
}

export type LatePaymentActionGates = {
  canGenerateArrearsLetter: boolean;
  canGenerateDefaultLetter: boolean;
  canMarkDefault: boolean;
  arrearsHelperText: string | null;
  defaultHelperText: string | null;
  defaultReasonHelperText: string | null;
};

export function resolveLatePaymentActionGates(input: {
  timeline: LatePaymentTimeline;
  servicingOpen: boolean;
  canDefaultPermission: boolean;
  servicingStatusArrears: boolean;
  defaultReason: string;
}): LatePaymentActionGates {
  const { timeline, servicingOpen, canDefaultPermission, servicingStatusArrears, defaultReason } =
    input;
  const reasonFilled = defaultReason.trim().length > 0;

  if (timeline.phase === "defaulted") {
    return {
      canGenerateArrearsLetter: false,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText: null,
      defaultReasonHelperText: null,
    };
  }

  if (!canDefaultPermission) {
    return {
      canGenerateArrearsLetter: false,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText: null,
      defaultReasonHelperText: null,
    };
  }

  if (!servicingOpen) {
    return {
      canGenerateArrearsLetter: false,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText: null,
      defaultReasonHelperText: null,
    };
  }

  if (timeline.phase === "not-available" || timeline.phase === "not-needed") {
    return {
      canGenerateArrearsLetter: false,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText: null,
      defaultReasonHelperText: null,
    };
  }

  if (timeline.phase === "in-grace") {
    return {
      canGenerateArrearsLetter: false,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: "Arrears actions will be available after the grace period ends.",
      defaultHelperText:
        "Default actions will be available after the arrears threshold is reached.",
      defaultReasonHelperText: null,
    };
  }

  if (timeline.phase === "arrears") {
    return {
      canGenerateArrearsLetter: true,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText:
        "Default actions will be available after the arrears threshold is reached.",
      defaultReasonHelperText: null,
    };
  }

  return {
    canGenerateArrearsLetter: true,
    canGenerateDefaultLetter: true,
    canMarkDefault: servicingStatusArrears && reasonFilled,
    arrearsHelperText: null,
    defaultHelperText: null,
    defaultReasonHelperText: reasonFilled
      ? null
      : "Enter a default reason before marking this note as default.",
  };
}
