/**
 * Helpers for offer_details.offer_acceptance phase updates.
 */

import {
  createInitialOfferAcceptanceDetails,
  getOfferAcceptanceFromOfferDetails,
  parseOfferAcceptanceDetails,
  withOfferAcceptance,
  type AuthorizedPartiesSnapshot,
  type OfferAcceptanceDetails,
  type OfferAcceptanceStatus,
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
  patch: Omit<Partial<OfferAcceptanceDetails>, "authorized_parties_draft"> & {
    status: OfferAcceptanceStatus;
    authorized_parties_draft?: AuthorizedPartiesSnapshot | null;
  }
): Record<string, unknown> {
  const current =
    parseOfferAcceptanceDetails(offerDetails.offer_acceptance) ?? createInitialOfferAcceptanceDetails();
  if (patch.status !== current.status) {
    assertCanTransitionOfferAcceptance(current.status, patch.status);
  }
  const { authorized_parties_draft: draftPatch, ...rest } = patch;
  const merged: OfferAcceptanceDetails = { ...current, ...rest };
  if ("authorized_parties_draft" in patch) {
    if (draftPatch) merged.authorized_parties_draft = draftPatch;
    else delete merged.authorized_parties_draft;
  }
  return withOfferAcceptance(offerDetails, merged);
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
