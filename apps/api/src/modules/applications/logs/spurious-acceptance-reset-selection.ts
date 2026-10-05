/**
 * Pure selection for `scripts/cleanup-spurious-acceptance-reset-logs.ts`.
 *
 * Invariant: a candidate is selected only when all four conditions hold; a missing map entry or
 * missing sibling means "not selected".
 */

export type SpuriousResetCandidate = {
  id: string;
  application_id: string;
  user_id: string;
  created_at: Date;
};

export type SiblingItemLog = {
  application_id: string;
  user_id: string;
  created_at: Date;
  scopeKey: string | null;
};

export const SIBLING_ITEM_WINDOW_MS = 5000;

const ACCEPTANCE_HUB_SCOPE_KEY_PREFIXES = ["acceptance_documents:", "authorized_representatives"];

export function isAcceptanceHubScopeKey(scopeKey: string | null): boolean {
  if (scopeKey === null) return false;
  return ACCEPTANCE_HUB_SCOPE_KEY_PREFIXES.some((prefix) => scopeKey.startsWith(prefix));
}

function siblingKey(applicationId: string, userId: string): string {
  return `${applicationId}\u0000${userId}`;
}

/** Timestamps of non-acceptance item reviews, grouped by application and acting user. */
function indexNonAcceptanceItemTimes(
  siblingItemLogs: readonly SiblingItemLog[]
): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (const log of siblingItemLogs) {
    if (log.scopeKey === null || isAcceptanceHubScopeKey(log.scopeKey)) continue;
    const key = siblingKey(log.application_id, log.user_id);
    const times = index.get(key) ?? [];
    times.push(log.created_at.getTime());
    index.set(key, times);
  }
  return index;
}

function hasSiblingItemReview(
  candidate: SpuriousResetCandidate,
  itemTimes: ReadonlyMap<string, number[]>
): boolean {
  const times = itemTimes.get(siblingKey(candidate.application_id, candidate.user_id));
  if (!times) return false;
  const end = candidate.created_at.getTime();
  const start = end - SIBLING_ITEM_WINDOW_MS;
  return times.some((time) => time >= start && time <= end);
}

/**
 * Keeps the candidates (admin acceptance-section APPROVED -> PENDING rows, filtered by the caller's
 * query) that were logged strictly after the application's first offer acceptance, whose
 * application's offer is still accepted, and that follow a non-acceptance item review by the same
 * admin within SIBLING_ITEM_WINDOW_MS. Input order is preserved.
 */
export function selectSpuriousAcceptanceResets(input: {
  candidates: readonly SpuriousResetCandidate[];
  firstOfferAcceptedAt: ReadonlyMap<string, Date>;
  offerAcceptedNow: ReadonlyMap<string, boolean>;
  siblingItemLogs: readonly SiblingItemLog[];
}): SpuriousResetCandidate[] {
  const itemTimes = indexNonAcceptanceItemTimes(input.siblingItemLogs);
  return input.candidates.filter((candidate) => {
    const acceptedAt = input.firstOfferAcceptedAt.get(candidate.application_id);
    return (
      acceptedAt !== undefined &&
      acceptedAt.getTime() < candidate.created_at.getTime() &&
      input.offerAcceptedNow.get(candidate.application_id) === true &&
      hasSiblingItemReview(candidate, itemTimes)
    );
  });
}
