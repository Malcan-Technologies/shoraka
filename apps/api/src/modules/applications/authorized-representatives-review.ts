import { AppError } from "../../lib/http/error-handler";
import {
  AUTHORIZED_REPRESENTATIVES_ITEM_TYPE,
  authorizedPartyListFingerprint,
  authorizedRepresentativeReviewItemId,
  findSubmittedPartyForSnapshotParty,
  isAuthorizedRepresentativesItemId,
  type AuthorizedPartiesSnapshot,
  type AuthorizedParty,
  type AuthorizedPartyGuarantorLookup,
} from "@cashsouk/types";
import type { AcceptanceReviewItemRow } from "./acceptance-document-issuer-lock";

export { AUTHORIZED_REPRESENTATIVES_ITEM_TYPE };

/** Review item ids flagged for issuer replacement when offer phase is CHANGES_REQUESTED. */
export function collectFlaggedAuthorizedRepresentativeItemIds(
  reviewItems: AcceptanceReviewItemRow[] | null | undefined
): Set<string> {
  const ids = new Set<string>();
  for (const item of reviewItems ?? []) {
    if (item.item_type !== AUTHORIZED_REPRESENTATIVES_ITEM_TYPE) continue;
    if (item.status !== "AMENDMENT_REQUESTED") continue;
    if (!isAuthorizedRepresentativesItemId(item.item_id)) continue;
    ids.add(item.item_id);
  }
  return ids;
}

export function assertAuthorizedPartyItemEditableInChangesRequested(
  itemId: string,
  flaggedItemIds: Set<string>
): void {
  if (flaggedItemIds.has(itemId)) return;
  throw new AppError(
    403,
    "EDIT_NOT_ALLOWED",
    "This representative list cannot be edited until CashSouk requests a change on it"
  );
}

/**
 * Keys to reset to PENDING on Step 1 submit.
 * First submit: all snapshot party keys.
 * Resubmit from CHANGES_REQUESTED: only items still AMENDMENT_REQUESTED.
 */
export function resolveAuthorizedRepresentativeReviewKeysToResetOnSubmit(
  offerAcceptanceStatus: string | null | undefined,
  allPartyKeys: string[],
  reviewItems: AcceptanceReviewItemRow[] | null | undefined,
  remap?: {
    previous: AuthorizedPartiesSnapshot;
    nextParties: AuthorizedParty[];
    guarantors: AuthorizedPartyGuarantorLookup[];
  }
): string[] {
  if (offerAcceptanceStatus !== "CHANGES_REQUESTED") {
    return allPartyKeys;
  }
  const amendmentKeys = collectFlaggedAuthorizedRepresentativeItemIds(reviewItems);
  if (!remap) {
    return allPartyKeys.filter((key) => amendmentKeys.has(key));
  }
  const flaggedNewKeys = new Set<string>();
  for (const previousParty of remap.previous.parties) {
    const oldId = authorizedRepresentativeReviewItemId(previousParty);
    if (!amendmentKeys.has(oldId)) continue;
    const next = findSubmittedPartyForSnapshotParty(
      previousParty,
      remap.previous.parties,
      remap.nextParties,
      remap.guarantors
    );
    flaggedNewKeys.add(next ? authorizedRepresentativeReviewItemId(next) : oldId);
  }
  return allPartyKeys.filter((key) => flaggedNewKeys.has(key));
}

export function authorizedRepresentativeReviewItemIdRemap(
  previous: AuthorizedPartiesSnapshot,
  nextParties: AuthorizedParty[],
  guarantors: AuthorizedPartyGuarantorLookup[]
): Array<{ from: string; to: string }> {
  const remaps: Array<{ from: string; to: string }> = [];
  const seenFrom = new Set<string>();
  for (const previousParty of previous.parties) {
    const from = authorizedRepresentativeReviewItemId(previousParty);
    const next = findSubmittedPartyForSnapshotParty(
      previousParty,
      previous.parties,
      nextParties,
      guarantors
    );
    if (!next) continue;
    const to = authorizedRepresentativeReviewItemId(next);
    if (from === to || seenFrom.has(from)) continue;
    seenFrom.add(from);
    remaps.push({ from, to });
  }
  return remaps;
}

export function assertUnflaggedAuthorizedPartiesUnchanged(
  previous: AuthorizedPartiesSnapshot | null | undefined,
  nextParties: AuthorizedParty[],
  flaggedItemIds: Set<string>,
  guarantors: AuthorizedPartyGuarantorLookup[] = []
): void {
  if (!previous) return;
  for (const previousParty of previous.parties) {
    const itemId = authorizedRepresentativeReviewItemId(previousParty);
    if (flaggedItemIds.has(itemId)) continue;
    const nextParty = findSubmittedPartyForSnapshotParty(
      previousParty,
      previous.parties,
      nextParties,
      guarantors
    );
    if (
      !nextParty ||
      authorizedPartyListFingerprint(previousParty) !== authorizedPartyListFingerprint(nextParty)
    ) {
      assertAuthorizedPartyItemEditableInChangesRequested(itemId, flaggedItemIds);
    }
  }
}
