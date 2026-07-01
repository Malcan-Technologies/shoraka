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
  /** Payment due / maturity subtitle (Servicing & Late Payment overview). */
  timingLabel: string;
  /** Late fees section status badge — never uses "0 days overdue". */
  lateFeeStatusLabel: string;
  /** @deprecated Use workflowLabel, timingLabel, or lateFeeStatusLabel. */
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

function formatGraceRemainingLabel(graceDaysLeft: number) {
  return `${dayCountLabel(graceDaysLeft, "day")} of grace left`;
}

function formatPastGraceLabel(daysAfterGrace: number) {
  return `${dayCountLabel(daysAfterGrace, "day")} past grace`;
}

function formatInGraceLabels(graceDaysLeft: number) {
  const graceRemaining = formatGraceRemainingLabel(graceDaysLeft);
  return {
    workflowLabel: "In grace",
    timingLabel: `Past due · ${graceRemaining}`,
    lateFeeStatusLabel: `Past due · ${graceRemaining}`,
    overdueLabel: `Within grace period (${graceRemaining})`,
  };
}

function formatPastGraceLabels(daysPastMaturity: number, daysAfterGrace: number) {
  const pastGrace = formatPastGraceLabel(daysAfterGrace);
  const timingLabel = `${dayCountLabel(daysPastMaturity, "day")} past due · ${pastGrace}`;
  return {
    timingLabel,
    lateFeeStatusLabel: pastGrace,
    overdueLabel: pastGrace,
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
      workflowLabel: "Defaulted",
      timingLabel: "Defaulted",
      lateFeeStatusLabel: "Defaulted",
      overdueLabel: "Defaulted",
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
      workflowLabel: "Not available",
      timingLabel: "Servicing not started",
      lateFeeStatusLabel: "Not available yet",
      overdueLabel: "Not available yet",
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
      workflowLabel: "Not needed",
      timingLabel: "Settled or repaid",
      lateFeeStatusLabel: "Not needed",
      overdueLabel: "Not needed",
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
      workflowLabel: "Not needed",
      timingLabel: "No payment due date set",
      lateFeeStatusLabel: "No payment due date set",
      overdueLabel: "No payment due date set",
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
    const timingLabel =
      daysUntilDue === 0
        ? "Due today"
        : `${dayCountLabel(daysUntilDue, "day")} until due`;
    return {
      phase: "not-needed",
      dueDate,
      daysUntilDue,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      workflowLabel: "Not needed",
      timingLabel,
      lateFeeStatusLabel: "Not overdue",
      overdueLabel: "Not overdue",
    };
  }

  if (daysOverdue <= 0) {
    const inGrace = formatInGraceLabels(graceDaysLeft);
    return {
      phase: "in-grace",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      workflowLabel: inGrace.workflowLabel,
      timingLabel: inGrace.timingLabel,
      lateFeeStatusLabel: inGrace.lateFeeStatusLabel,
      overdueLabel: inGrace.overdueLabel,
    };
  }

  const pastGrace = formatPastGraceLabels(daysPastMaturity, daysAfterGrace);

  if (daysAfterGrace < note.arrearsThresholdDays) {
    return {
      phase: "arrears",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      workflowLabel: "Arrears",
      timingLabel: pastGrace.timingLabel,
      lateFeeStatusLabel: pastGrace.lateFeeStatusLabel,
      overdueLabel: pastGrace.overdueLabel,
    };
  }

  return {
    phase: "default-eligible",
    dueDate,
    daysUntilDue: 0,
    daysPastMaturity,
    daysOverdue,
    graceDaysLeft,
    daysAfterGrace,
    workflowLabel: "Default eligible",
    timingLabel: pastGrace.timingLabel,
    lateFeeStatusLabel: pastGrace.lateFeeStatusLabel,
    overdueLabel: pastGrace.overdueLabel,
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
