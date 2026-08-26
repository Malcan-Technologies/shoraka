/**
 * Shared public timing copy for notes.
 * New tenure notes (`tenureDays` set) never show an invoice due date as maturity.
 */

import { isTenureBackedNote } from "./disbursement-value-date";
import {
  formatFinancingTenureFromDisbursement,
  malaysiaCalendarDaysRemaining,
  resolveFinancingTenureDays,
} from "./financing-tenure";

export const NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP =
  "Financing tenure is counted from disbursement. The maturity date is set on that day.";

export const NOTE_TIMING_ACTIVATED_TOOLTIP =
  "Set when funds are disbursed. Early settlement can clear the note before this date.";

export const EXPECTED_PERIOD_RETURN_UP_TO_TOOLTIP =
  "This is the profit if the note runs its full tenure. Early settlement pays for fewer days. After the 7-day grace, profit can continue until it reaches the invoice-minus-principal ceiling. A service fee is taken from gross profit.";

export const MARKETPLACE_RETURN_RATE_TOOLTIP =
  "Advertised return is the annualised gross rate before the service fee, if the note runs its full tenure. Early settlement pays for fewer days. After the 7-day grace, profit can continue until the invoice-minus-principal ceiling.";

export const NOTE_TIMING_GRACE_TOOLTIP =
  "The note has reached maturity. If repayment clears during this grace window, profit stays at the maturity date and no late charges apply.";

export const NOTE_TIMING_PAST_MATURITY_TOOLTIP =
  "Repayment has not cleared yet. Profit can continue until it reaches the invoice-minus-principal ceiling. Late charges are borne by the issuer.";

export const DEFAULT_NOTE_GRACE_PERIOD_DAYS = 7;

export function resolveNoteGracePeriodDays(note: {
  gracePeriodDays?: number | null;
}): number {
  if (
    typeof note.gracePeriodDays === "number" &&
    Number.isInteger(note.gracePeriodDays) &&
    note.gracePeriodDays >= 0
  ) {
    return note.gracePeriodDays;
  }
  return DEFAULT_NOTE_GRACE_PERIOD_DAYS;
}

export type NoteTimingKind = "tenure_pending" | "tenure_activated" | "legacy" | "unknown";

export type NoteTimingInput = {
  id?: string | null;
  tenureDays?: number | null;
  maturityDate?: string | Date | null;
};

export type NoteTimingDisplay = {
  kind: NoteTimingKind;
  isTenureNote: boolean;
  /** "Financing tenure" | "Maturity date" */
  label: string;
  /** "90 days from disbursement" | "18 Nov 2026" | "—" */
  value: string;
  /**
   * Marketplace KPI: tenure days for new notes; days left for legacy.
   * Portfolio uses a separate countdown-to-maturity helper.
   */
  compactValue: string;
  compactLabel: string;
  /** Marketplace KPI footnote for legacy compact dates. Tenure notes keep this off the KPI. */
  compactExtra: string | null;
  /** "90-day tenure" after activation — for detail / portfolio */
  secondary: string | null;
  tooltip: string | null;
  /** Marketplace/list filter days: fixed tenure for new notes; days remaining for legacy */
  filterDays: number | null;
  sortTime: number | null;
  tenureDays: number | null;
};

export function parseNoteDisplayDate(value: string | Date | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatNoteDateEnMy(value: string | Date | null | undefined): string | null {
  const date = parseNoteDisplayDate(value);
  if (!date) return null;
  return date.toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTenureDaysSecondary(tenureDays: number): string {
  return `${tenureDays}-day tenure`;
}

export function formatMaturesOnLabel(dateLabel: string): string {
  return `Matures ${dateLabel}`;
}

export const NOTE_MATURITY_PENDING_VALUE = "Set when funds are disbursed";

export function formatIssuerFinancingTenure(timing: NoteTimingDisplay): string | null {
  return timing.tenureDays != null ? `${timing.tenureDays} days` : null;
}

export function formatIssuerNoteMaturity(timing: NoteTimingDisplay): string {
  if (timing.kind === "tenure_pending") return NOTE_MATURITY_PENDING_VALUE;
  if (timing.kind === "unknown") return "—";
  return timing.value;
}

export function formatIssuerMaturityCountdown(
  maturityDate: string | null | undefined,
  options: {
    tenureDays?: number | null;
    gracePeriodDays?: number | null;
    now?: Date;
  } = {}
): string | null {
  if (!maturityDate) return null;
  const days = malaysiaCalendarDaysRemaining(options.now ?? new Date(), maturityDate);
  if (days == null) return null;
  if (days === 0) return "Due today";
  if (days > 0) {
    return `${days} day${days === 1 ? "" : "s"} remaining`;
  }
  const elapsed = Math.abs(days);
  if (isTenureBackedNote(options.tenureDays) && elapsed <= resolveNoteGracePeriodDays(options)) {
    return elapsed === 1 ? "1 day in grace" : `${elapsed} days in grace`;
  }
  return elapsed === 1 ? "1 day overdue" : `${elapsed} days overdue`;
}

export function joinNoteTimingExtra(
  ...parts: Array<string | null | undefined>
): string | undefined {
  const present = parts.map((part) => part?.trim()).filter((part): part is string => Boolean(part));
  return present.length ? present.join(" · ") : undefined;
}

/** Marketplace KPI stays large for tenure/countdown numbers; shrink dates and long tokens. */
export function isCompactNoteTimingValueShort(value: string): boolean {
  return /^\d+$/.test(value) || value === "—" || value === "Today";
}

export function resolveIssuerInvoiceNoteTiming(input: {
  note?: { tenureDays?: number | null; maturityDate?: string | null } | null;
  offerDetails?: unknown;
  invoiceDetails?: unknown;
}): NoteTimingDisplay | null {
  if (input.note) {
    const timing = resolveNoteTimingDisplay({
      tenureDays: input.note.tenureDays,
      maturityDate: input.note.maturityDate,
    });
    return timing.kind === "unknown" ? null : timing;
  }
  const tenureDays = resolveFinancingTenureDays(input.offerDetails, input.invoiceDetails);
  if (tenureDays == null) return null;
  return resolveNoteTimingDisplay({ tenureDays, maturityDate: null });
}

function legacyMarketplaceCompact(
  signedDays: number | null,
  maturityLabel: string
): Pick<NoteTimingDisplay, "compactValue" | "compactLabel" | "compactExtra"> {
  if (signedDays == null) {
    return {
      compactValue: maturityLabel,
      compactLabel: "Maturity date",
      compactExtra: formatMaturesOnLabel(maturityLabel),
    };
  }
  if (signedDays === 0) {
    return {
      compactValue: "Today",
      compactLabel: "Matures",
      compactExtra: maturityLabel,
    };
  }
  if (signedDays > 0) {
    return {
      compactValue: String(signedDays),
      compactLabel: signedDays === 1 ? "day left" : "days left",
      compactExtra: formatMaturesOnLabel(maturityLabel),
    };
  }
  const elapsed = Math.abs(signedDays);
  return {
    compactValue: String(elapsed),
    compactLabel: elapsed === 1 ? "day past due" : "days past due",
    compactExtra: formatMaturesOnLabel(maturityLabel),
  };
}

export function resolveNoteTimingDisplay(
  input: NoteTimingInput,
  now: Date = new Date()
): NoteTimingDisplay {
  const tenureDays = isTenureBackedNote(input.tenureDays) ? input.tenureDays! : null;
  const maturity = parseNoteDisplayDate(input.maturityDate);
  const maturityLabel = formatNoteDateEnMy(maturity);

  if (tenureDays != null) {
    if (!maturity) {
      const fromDisbursement = formatFinancingTenureFromDisbursement(tenureDays);
      return {
        kind: "tenure_pending",
        isTenureNote: true,
        label: "Financing tenure",
        value: fromDisbursement,
        compactValue: String(tenureDays),
        compactLabel: "days",
        compactExtra: null,
        secondary: null,
        tooltip: NOTE_TIMING_FROM_DISBURSEMENT_TOOLTIP,
        filterDays: tenureDays,
        sortTime: null,
        tenureDays,
      };
    }
    return {
      kind: "tenure_activated",
      isTenureNote: true,
      label: "Maturity date",
      value: maturityLabel ?? "—",
      compactValue: String(tenureDays),
      compactLabel: "days",
      compactExtra: maturityLabel ? formatMaturesOnLabel(maturityLabel) : null,
      secondary: formatTenureDaysSecondary(tenureDays),
      tooltip: NOTE_TIMING_ACTIVATED_TOOLTIP,
      filterDays: tenureDays,
      sortTime: maturity.getTime(),
      tenureDays,
    };
  }

  if (maturity && maturityLabel) {
    const signedDays = malaysiaCalendarDaysRemaining(now, maturity);
    const compact = legacyMarketplaceCompact(signedDays, maturityLabel);
    return {
      kind: "legacy",
      isTenureNote: false,
      label: "Maturity date",
      value: maturityLabel,
      ...compact,
      secondary: null,
      tooltip: null,
      filterDays: signedDays,
      sortTime: maturity.getTime(),
      tenureDays: null,
    };
  }

  return {
    kind: "unknown",
    isTenureNote: false,
    label: "Maturity date",
    value: "—",
    compactValue: "—",
    compactLabel: "days",
    compactExtra: null,
    secondary: null,
    tooltip: null,
    filterDays: null,
    sortTime: null,
    tenureDays: null,
  };
}

/** Marketplace/list filters: new notes use stored tenure; legacy uses days remaining. */
export function resolveMarketplaceFilterDays(
  input: NoteTimingInput,
  now: Date = new Date()
): number | null {
  return resolveNoteTimingDisplay(input, now).filterDays;
}

export function compareNoteTimingSort(left: NoteTimingInput, right: NoteTimingInput): number {
  const a = resolveNoteTimingDisplay(left);
  const b = resolveNoteTimingDisplay(right);
  const aTime = a.sortTime ?? Number.POSITIVE_INFINITY;
  const bTime = b.sortTime ?? Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  const aTenure = a.tenureDays ?? Number.POSITIVE_INFINITY;
  const bTenure = b.tenureDays ?? Number.POSITIVE_INFINITY;
  if (aTenure !== bTenure) return aTenure - bTenure;
  return String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

/** Tenure notes that are not yet settled should not imply a guaranteed full-tenure profit. */
export function shouldLabelExpectedReturnAsUpTo(input: {
  tenureDays?: number | null;
  maturityDate?: string | Date | null;
  settled?: boolean;
}): boolean {
  if (input.settled) return false;
  return isTenureBackedNote(input.tenureDays);
}
