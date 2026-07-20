/**
 * Helpers for offer_details.offer_acceptance phase updates.
 */

import {
  createInitialOfferAcceptanceDetails,
  getOfferAcceptanceFromOfferDetails,
  parseOfferAcceptanceDetails,
  withOfferAcceptance,
  type OfferAcceptanceDetails,
  type OfferAcceptanceStatus,
  type OfferAcknowledgementRecord,
} from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";

/** Allowed phase moves. Terminal states have no outbound edges. */
const ALLOWED_TRANSITIONS: Record<OfferAcceptanceStatus, readonly OfferAcceptanceStatus[]> = {
  PENDING_ISSUER: ["PENDING_ADMIN_REVIEW", "APPROVED_FOR_SIGNING", "DECLINED", "REJECTED"],
  PENDING_ADMIN_REVIEW: ["CHANGES_REQUESTED", "APPROVED_FOR_SIGNING", "REJECTED", "DECLINED"],
  CHANGES_REQUESTED: ["PENDING_ADMIN_REVIEW", "APPROVED_FOR_SIGNING", "DECLINED", "REJECTED"],
  APPROVED_FOR_SIGNING: [
    "SIGNING_IN_PROGRESS",
    "COMPLETED",
    "DECLINED",
    "REJECTED",
    "PENDING_ADMIN_REVIEW",
    "CHANGES_REQUESTED",
  ],
  SIGNING_IN_PROGRESS: ["APPROVED_FOR_SIGNING", "COMPLETED", "REJECTED", "DECLINED"],
  REJECTED: [],
  DECLINED: [],
  COMPLETED: [],
};

export function canTransitionOfferAcceptance(
  from: OfferAcceptanceStatus,
  to: OfferAcceptanceStatus
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertCanTransitionOfferAcceptance(
  from: OfferAcceptanceStatus,
  to: OfferAcceptanceStatus
): void {
  if (canTransitionOfferAcceptance(from, to)) return;
  throw new AppError(
    400,
    "INVALID_STATE",
    `Cannot move offer acceptance from ${from} to ${to}.`
  );
}

export function ensureOfferAcceptanceOnSend(
  offerDetails: Record<string, unknown>
): Record<string, unknown> {
  const existing = getOfferAcceptanceFromOfferDetails(offerDetails);
  if (existing) return offerDetails;
  return withOfferAcceptance(offerDetails, createInitialOfferAcceptanceDetails());
}

export function patchOfferAcceptance(
  offerDetails: Record<string, unknown>,
  patch: Partial<OfferAcceptanceDetails> & { status: OfferAcceptanceStatus }
): Record<string, unknown> {
  const current =
    parseOfferAcceptanceDetails(offerDetails.offer_acceptance) ?? createInitialOfferAcceptanceDetails();
  if (patch.status !== current.status) {
    assertCanTransitionOfferAcceptance(current.status, patch.status);
  }
  return withOfferAcceptance(offerDetails, { ...current, ...patch });
}

/**
 * Patch without enforcing the transition matrix — use only for repair / historical backfill.
 */
export function patchOfferAcceptanceUnchecked(
  offerDetails: Record<string, unknown>,
  patch: Partial<OfferAcceptanceDetails> & { status: OfferAcceptanceStatus }
): Record<string, unknown> {
  const current =
    parseOfferAcceptanceDetails(offerDetails.offer_acceptance) ?? createInitialOfferAcceptanceDetails();
  return withOfferAcceptance(offerDetails, { ...current, ...patch });
}

export function buildAcknowledgementRecords(input: {
  documentKeys: string[];
  userId: string;
  acceptedAt: string;
}): OfferAcknowledgementRecord[] {
  return input.documentKeys.map((document_key) => ({
    document_key,
    accepted_at: input.acceptedAt,
    accepted_by_user_id: input.userId,
  }));
}

/**
 * Merge acknowledgement keys on Step 1 / resubmit.
 * - Rejects keys not in `allowedKeys`
 * - Preserves original accepted_at / accepted_by for keys already recorded
 * - Stamps new keys with the current user/time
 */
export function mergeAcknowledgementRecords(input: {
  existing: OfferAcknowledgementRecord[] | undefined;
  documentKeys: string[];
  allowedKeys: string[];
  userId: string;
  acceptedAt: string;
}): OfferAcknowledgementRecord[] {
  const allowed = new Set(input.allowedKeys);
  for (const key of input.documentKeys) {
    if (!allowed.has(key)) {
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        `Unknown acknowledgement key: ${key}`
      );
    }
  }
  const previousByKey = new Map(
    (input.existing ?? []).map((row) => [row.document_key, row] as const)
  );
  return input.documentKeys.map((document_key) => {
    const prior = previousByKey.get(document_key);
    if (prior) {
      return {
        document_key,
        accepted_at: prior.accepted_at,
        accepted_by_user_id: prior.accepted_by_user_id,
      };
    }
    return {
      document_key,
      accepted_at: input.acceptedAt,
      accepted_by_user_id: input.userId,
    };
  });
}
