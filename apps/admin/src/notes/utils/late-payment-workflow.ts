import { malaysiaCalendarDaysRemaining, type NoteDetail } from "@cashsouk/types";
import {
  latePaymentPhaseTone,
  WORKFLOW_STATUS_BADGE,
} from "@/notes/utils/workflow-status-tokens";

export type LatePaymentWorkflowPhase =
  | "not-available"
  | "not-needed"
  | "in-grace"
  | "late"
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
  /** Payment due / maturity subtitle. */
  servicingTimingLabel: string;
  /** Primary timing line on the Late Payment tab. */
  latePaymentTimingLabel: string;
  /** Secondary timing detail on the Late Payment tab (unused; timing is single-line only). */
  latePaymentTimingDetail: string | null;
  /** Late fees section status badge on the Late Payment tab. */
  lateFeeStatusLabel: string;
  /** @deprecated Use context-specific label fields. */
  overdueLabel: string;
};

function latePaymentWorkflowBadge(phase: LatePaymentWorkflowPhase, label: string) {
  const tokens = WORKFLOW_STATUS_BADGE[latePaymentPhaseTone(phase)];
  return { label, className: tokens.badgeClass, dotClass: tokens.dotClass };
}

export const LATE_PAYMENT_WORKFLOW_BADGE: Record<
  LatePaymentWorkflowPhase,
  { label: string; className: string; dotClass: string }
> = {
  "not-available": latePaymentWorkflowBadge("not-available", "Not available"),
  "not-needed": latePaymentWorkflowBadge("not-needed", "Not needed"),
  "in-grace": latePaymentWorkflowBadge("in-grace", "Overdue"),
  late: latePaymentWorkflowBadge("late", "Late"),
  arrears: latePaymentWorkflowBadge("arrears", "Arrears"),
  "default-eligible": latePaymentWorkflowBadge("default-eligible", "Default eligible"),
  defaulted: latePaymentWorkflowBadge("defaulted", "Defaulted"),
};

function resolvePaymentDueDate(note: NoteDetail): string | null {
  const schedules = [...(note.paymentSchedules ?? [])].sort((a, b) => a.sequence - b.sequence);
  return schedules[0]?.dueDate ?? note.maturityDate ?? null;
}

export function getNotePaymentDueDate(note: NoteDetail): string | null {
  return resolvePaymentDueDate(note);
}

function dayCountLabel(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

function formatDueInLabel(daysUntilDue: number) {
  return daysUntilDue === 0 ? "Due today" : `Due in ${dayCountLabel(daysUntilDue, "day")}`;
}

function formatOverdueByLabel(daysPastMaturity: number) {
  return `Overdue by ${dayCountLabel(daysPastMaturity, "day")}`;
}

function buildInGraceLabels(daysPastMaturity: number) {
  const timing = formatOverdueByLabel(daysPastMaturity);
  return {
    workflowLabel: "Overdue",
    servicingTimingLabel: timing,
    latePaymentTimingLabel: timing,
    latePaymentTimingDetail: null,
    lateFeeStatusLabel: timing,
    overdueLabel: timing,
  };
}

function buildPastGraceLabels(
  daysPastMaturity: number,
  phase: "late" | "arrears" | "default-eligible"
) {
  const timing = formatOverdueByLabel(daysPastMaturity);
  return {
    workflowLabel:
      phase === "default-eligible" ? "Default eligible" : phase === "late" ? "Late" : "Arrears",
    servicingTimingLabel: timing,
    latePaymentTimingLabel: timing,
    latePaymentTimingDetail: null,
    lateFeeStatusLabel: timing,
    overdueLabel: timing,
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
    const persistedDpd = Math.max(0, Number(note.daysPastDue ?? 0));
    return {
      phase: "defaulted",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: persistedDpd,
      daysOverdue: persistedDpd,
      graceDaysLeft: 0,
      daysAfterGrace: persistedDpd,
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

  const signedDaysRemaining = malaysiaCalendarDaysRemaining(new Date(), dueDate) ?? 0;
  const daysUntilDue = Math.max(0, signedDaysRemaining);
  const daysPastMaturity = Math.max(0, -signedDaysRemaining);
  const daysOverdue = Math.max(0, daysPastMaturity - note.gracePeriodDays);
  const graceDaysLeft = Math.max(0, note.gracePeriodDays - daysPastMaturity);
  const daysAfterGrace = daysOverdue;

  const persistedDpd = Number(note.daysPastDue ?? daysPastMaturity);
  const timingDays = persistedDpd > 0 ? persistedDpd : daysPastMaturity;

  if (note.servicingStatus === "ARREARS") {
    return {
      phase: "default-eligible",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: timingDays,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...buildPastGraceLabels(timingDays, "default-eligible"),
    };
  }

  if (note.servicingStatus === "LATE") {
    return {
      phase: "late",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: timingDays,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...buildPastGraceLabels(timingDays, "late"),
    };
  }

  if (note.servicingStatus === "OVERDUE") {
    return {
      phase: "in-grace",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity: timingDays,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...buildInGraceLabels(timingDays),
    };
  }

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
    const inGrace = buildInGraceLabels(daysPastMaturity);
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
    const pastGrace = buildPastGraceLabels(daysPastMaturity, "late");
    return {
      phase: "late",
      dueDate,
      daysUntilDue: 0,
      daysPastMaturity,
      daysOverdue,
      graceDaysLeft,
      daysAfterGrace,
      ...pastGrace,
    };
  }

  const defaultEligible = buildPastGraceLabels(daysPastMaturity, "default-eligible");
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
      canGenerateDefaultLetter: canDefaultPermission && servicingOpen,
      canMarkDefault: false,
      arrearsHelperText: null,
      defaultHelperText:
        canDefaultPermission && servicingOpen
          ? "Generate the default notice if it was not emailed when default was marked."
          : null,
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

  if (timeline.phase === "late" || timeline.phase === "arrears") {
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
    canMarkDefault: servicingStatusArrears,
    arrearsHelperText: null,
    defaultHelperText: null,
    defaultReasonHelperText: reasonFilled
      ? null
      : "Enter a default reason before marking this note as default.",
  };
}
