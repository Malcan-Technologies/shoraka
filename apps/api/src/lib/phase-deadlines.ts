/**
 * Phase deadline stamps and API gates for acceptance / signing clocks.
 */

import {
  addDaysIso,
  createInitialOfferAcceptanceDetails,
  DEFAULT_ACCEPTANCE_DEADLINE,
  DEFAULT_SIGNING_DEADLINE,
  getOfferAcceptanceFromOfferDetails,
  resolveAcceptanceDeadlineFromWorkflow,
  resolveSigningDeadlineFromWorkflow,
  type OfferAcceptanceDetails,
  type OfferAcceptanceStatus,
} from "@cashsouk/types";
import { AppError } from "./http/error-handler";

/** Issuer-facing acceptance clock. Paused while CashSouk reviews submitted docs. */
const ACCEPTANCE_ACTIVE: ReadonlySet<OfferAcceptanceStatus> = new Set([
  "PENDING_ISSUER",
  "CHANGES_REQUESTED",
]);

const SIGNING_ACTIVE: ReadonlySet<OfferAcceptanceStatus> = new Set([
  "APPROVED_FOR_SIGNING",
  "SIGNING_IN_PROGRESS",
]);

export function buildOfferAcceptanceOnSend(
  workflow: unknown,
  sentAtIso: string
): OfferAcceptanceDetails {
  const deadline = resolveAcceptanceDeadlineFromWorkflow(workflow) ?? DEFAULT_ACCEPTANCE_DEADLINE;
  return createInitialOfferAcceptanceDetails({
    acceptance_expires_at: addDaysIso(sentAtIso, deadline.days),
  });
}

/** Fields to merge when entering APPROVED_FOR_SIGNING (preserves existing signing_expires_at). */
export function signingDeadlinePatchOnApprove(
  workflow: unknown,
  nowIso: string,
  current: OfferAcceptanceDetails | null | undefined
): Partial<OfferAcceptanceDetails> {
  if (typeof current?.signing_expires_at === "string" && current.signing_expires_at) {
    return {};
  }
  const deadline = resolveSigningDeadlineFromWorkflow(workflow) ?? DEFAULT_SIGNING_DEADLINE;
  return { signing_expires_at: addDaysIso(nowIso, deadline.days) };
}

/**
 * Fresh acceptance window when admin requests changes on acceptance docs.
 * Clears prior acceptance reminder keys so the new window can remind again.
 */
export function acceptanceDeadlinePatchOnChangesRequested(
  workflow: unknown,
  nowIso: string,
  current: OfferAcceptanceDetails | null | undefined
): Partial<OfferAcceptanceDetails> {
  const deadline = resolveAcceptanceDeadlineFromWorkflow(workflow) ?? DEFAULT_ACCEPTANCE_DEADLINE;
  const keptReminders: Record<string, string> = {};
  for (const [key, value] of Object.entries(current?.deadline_reminders_sent ?? {})) {
    if (!key.startsWith("acceptance:")) {
      keptReminders[key] = value;
    }
  }
  return {
    acceptance_expires_at: addDaysIso(nowIso, deadline.days),
    deadline_reminders_sent: keptReminders,
  };
}

/**
 * Fresh signing window when admin extends after the signing clock expired.
 * Clears prior signing reminder keys so the new window can remind again.
 */
export function signingDeadlinePatchOnExtend(
  workflow: unknown,
  nowIso: string,
  current: OfferAcceptanceDetails | null | undefined
): Partial<OfferAcceptanceDetails> {
  const deadline = resolveSigningDeadlineFromWorkflow(workflow) ?? DEFAULT_SIGNING_DEADLINE;
  const keptReminders: Record<string, string> = {};
  for (const [key, value] of Object.entries(current?.deadline_reminders_sent ?? {})) {
    if (!key.startsWith("signing:")) {
      keptReminders[key] = value;
    }
  }
  return {
    signing_expires_at: addDaysIso(nowIso, deadline.days),
    deadline_reminders_sent: keptReminders,
  };
}

export function assertAcceptanceDeadlineOpen(
  acceptance: OfferAcceptanceDetails | null | undefined,
  now: Date = new Date()
): void {
  if (!acceptance || !ACCEPTANCE_ACTIVE.has(acceptance.status)) return;
  const expiresAt = acceptance.acceptance_expires_at;
  if (typeof expiresAt !== "string" || !expiresAt) return;
  if (new Date(expiresAt) < now) {
    throw new AppError(
      400,
      "OFFER_EXPIRED",
      "This offer's acceptance deadline has passed. Wait for CashSouk to send a new offer."
    );
  }
}

export function assertSigningDeadlineOpen(
  acceptance: OfferAcceptanceDetails | null | undefined,
  now: Date = new Date()
): void {
  if (!acceptance || !SIGNING_ACTIVE.has(acceptance.status)) return;
  const expiresAt = acceptance.signing_expires_at;
  if (typeof expiresAt !== "string" || !expiresAt) return;
  if (new Date(expiresAt) < now) {
    throw new AppError(
      400,
      "OFFER_EXPIRED",
      "This offer's signing deadline has passed. Wait for CashSouk to send a new offer."
    );
  }
}

export function assertOfferAcceptanceDeadlinesForAction(
  offerDetails: unknown,
  action: "acceptance" | "signing",
  now: Date = new Date()
): void {
  const acceptance = getOfferAcceptanceFromOfferDetails(offerDetails);
  if (action === "acceptance") {
    assertAcceptanceDeadlineOpen(acceptance, now);
    return;
  }
  assertSigningDeadlineOpen(acceptance, now);
}

export { ACCEPTANCE_ACTIVE, SIGNING_ACTIVE };
