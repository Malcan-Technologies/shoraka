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
  daysPastMaturity: number;
  daysOverdue: number;
  graceDaysLeft: number;
  daysAfterGrace: number;
  overdueLabel: string;
};

export const LATE_PAYMENT_WORKFLOW_BADGE: Record<
  LatePaymentWorkflowPhase,
  { label: string; className: string; dotClass: string }
> = {
  "not-available": {
    label: "Not needed",
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

export function resolveLatePaymentTimeline(note: NoteDetail): LatePaymentTimeline {
  const dueDate = resolvePaymentDueDate(note);

  const isDefaulted =
    note.servicingStatus === "DEFAULTED" || note.status === "DEFAULTED";

  if (isDefaulted) {
    return {
      phase: "defaulted",
      dueDate,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      overdueLabel: "Defaulted",
    };
  }

  const servicingWorkflowAvailable =
    note.fundingStatus === "FUNDED" && note.servicingStatus !== "NOT_STARTED";
  if (!servicingWorkflowAvailable) {
    return {
      phase: "not-available",
      dueDate,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      overdueLabel: "Not available yet",
    };
  }

  const settledWithoutDefault =
    note.status === "REPAID" || note.servicingStatus === "SETTLED";
  if (settledWithoutDefault) {
    return {
      phase: "not-needed",
      dueDate,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      overdueLabel: "Not needed",
    };
  }

  if (!dueDate) {
    return {
      phase: "not-needed",
      dueDate: null,
      daysPastMaturity: 0,
      daysOverdue: 0,
      graceDaysLeft: 0,
      daysAfterGrace: 0,
      overdueLabel: "No payment due date set",
    };
  }

  const dueDateValue = new Date(dueDate);
  const today = new Date();
  const daysPastMaturity = calculateCalendarDayCount(dueDateValue, today);
  const daysOverdue = Math.max(0, daysPastMaturity - note.gracePeriodDays);
  const graceDaysLeft = Math.max(0, note.gracePeriodDays - daysPastMaturity);
  const daysAfterGrace = daysOverdue;

  if (daysPastMaturity <= 0) {
    return {
      phase: "not-needed",
      dueDate,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      overdueLabel: "Not overdue",
    };
  }

  if (daysOverdue <= 0) {
    return {
      phase: "in-grace",
      dueDate,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      overdueLabel: `Within grace period (${graceDaysLeft} day${graceDaysLeft === 1 ? "" : "s"} left)`,
    };
  }

  if (daysAfterGrace < note.arrearsThresholdDays) {
    const overdueLabel = `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`;
    return {
      phase: "arrears",
      dueDate,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      overdueLabel,
    };
  }

  const overdueLabel = `${daysOverdue} day${daysOverdue === 1 ? "" : "s"} overdue`;
  return {
    phase: "default-eligible",
    dueDate,
    daysPastMaturity,
    daysOverdue,
    graceDaysLeft,
    daysAfterGrace,
    overdueLabel,
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
      defaultHelperText: "Default actions will be available after the arrears threshold is reached.",
      defaultReasonHelperText: null,
    };
  }

  if (timeline.phase === "arrears") {
    return {
      canGenerateArrearsLetter: true,
      canGenerateDefaultLetter: false,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText: "Default actions will be available after the arrears threshold is reached.",
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
