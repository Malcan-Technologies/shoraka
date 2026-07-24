/**
 * Shared Accept by / Complete signing by / Expired display for issuer + admin.
 * Keep portal UIs on these helpers so copy and urgency do not drift.
 */

import { format } from "date-fns";
import { addDaysIso, DEFAULT_ACCEPTANCE_DEADLINE } from "./deadline-config";
import {
  getOfferAcceptanceFromOfferDetails,
  resolveAcceptanceDeadlineFromWorkflow,
  resolveActiveOfferDeadlineIso,
  workflowUsesOfferAcceptanceFlow,
  type OfferAcceptanceStatus,
} from "./offer-acceptance";

/** Visual urgency for phase deadlines. */
export type PhaseDeadlineUrgency = "none" | "soon" | "past";

/** Show an urgency cue when the deadline is past or within this many days. */
export const PHASE_DEADLINE_SOON_DAYS = 2;

export type OfferPhaseDeadlineDisplay = {
  iso: string;
  /** Live: "Accept by" | "Complete signing by". Past: "Expired". */
  label: string;
  absolute: string;
  relative: string;
  isPast: boolean;
  urgency: PhaseDeadlineUrgency;
  /**
   * Compact one-liner for cards:
   * live — "Accept by 29 Jul 2026, 2:36 PM · 6 days left"
   * past — "Expired 22 Jul 2026, 2:36 PM"
   */
  summary: string;
};

/** Preview shown on admin Send Offer confirm (before stamp). */
export type AcceptanceDeadlinePreview = {
  days: number;
  acceptByIso: string;
  absolute: string;
  /** e.g. "Issuer has 7 days · Accept by 29 Jul 2026, 2:36 PM" */
  summary: string;
};

export function phaseDeadlineLabel(status: OfferAcceptanceStatus | string | null | undefined): string {
  if (status === "APPROVED_FOR_SIGNING" || status === "SIGNING_IN_PROGRESS") {
    return "Complete signing by";
  }
  return "Accept by";
}

export function formatPhaseDeadline(
  iso: string,
  now: Date = new Date()
): {
  absolute: string;
  relative: string;
  isPast: boolean;
  daysRemaining: number;
} {
  const deadline = new Date(iso);
  const isPast = deadline.getTime() < now.getTime();
  const absolute = format(deadline, "dd MMM yyyy, h:mm a");
  const dayMs = 24 * 60 * 60 * 1000;
  const days = Math.ceil(Math.abs(deadline.getTime() - now.getTime()) / dayMs);
  if (isPast) {
    return {
      absolute,
      // Label already says "Expired"; only add age when useful.
      relative: days <= 1 ? "" : `${days} days ago`,
      isPast: true,
      daysRemaining: 0,
    };
  }
  if (days <= 0) {
    return { absolute, relative: "Expires today", isPast: false, daysRemaining: 0 };
  }
  if (days === 1) {
    return { absolute, relative: "1 day left", isPast: false, daysRemaining: 1 };
  }
  return { absolute, relative: `${days} days left`, isPast: false, daysRemaining: days };
}

export function getPhaseDeadlineUrgency(
  iso: string,
  now: Date = new Date()
): PhaseDeadlineUrgency {
  const { isPast, daysRemaining } = formatPhaseDeadline(iso, now);
  if (isPast) return "past";
  if (daysRemaining <= PHASE_DEADLINE_SOON_DAYS) return "soon";
  return "none";
}

/** Active phase deadline for an OFFER_SENT offer_details blob, if stamped. */
export function getOfferPhaseDeadlineDisplay(
  offerDetails: unknown,
  now: Date = new Date()
): OfferPhaseDeadlineDisplay | null {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  const iso = resolveActiveOfferDeadlineIso(acceptance);
  if (!iso) return null;
  const formatted = formatPhaseDeadline(iso, now);
  const label = formatted.isPast ? "Expired" : phaseDeadlineLabel(acceptance?.status);
  return {
    iso,
    label,
    absolute: formatted.absolute,
    relative: formatted.relative,
    isPast: formatted.isPast,
    urgency: getPhaseDeadlineUrgency(iso, now),
    summary: formatted.isPast
      ? `Expired ${formatted.absolute}`
      : `${label} ${formatted.absolute} · ${formatted.relative}`,
  };
}

/**
 * Admin Send Offer confirm preview from product acceptance_deadline.
 * Returns null when the product does not use the offer-acceptance flow.
 */
export function previewAcceptanceDeadlineFromWorkflow(
  workflow: unknown,
  sentAt: Date = new Date()
): AcceptanceDeadlinePreview | null {
  if (!workflowUsesOfferAcceptanceFlow(workflow)) return null;
  const deadline = resolveAcceptanceDeadlineFromWorkflow(workflow) ?? DEFAULT_ACCEPTANCE_DEADLINE;
  const acceptByIso = addDaysIso(sentAt, deadline.days);
  const absolute = format(new Date(acceptByIso), "dd MMM yyyy, h:mm a");
  const dayLabel = deadline.days === 1 ? "1 day" : `${deadline.days} days`;
  return {
    days: deadline.days,
    acceptByIso,
    absolute,
    summary: `Issuer has ${dayLabel} · Accept by ${absolute}`,
  };
}
