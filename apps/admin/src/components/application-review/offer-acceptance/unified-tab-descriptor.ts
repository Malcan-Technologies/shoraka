/**
 * Collapse Facility / Invoice / Acceptance review tabs into one live descriptor.
 * Comparison modal keeps getEffectiveReviewTabDescriptors uncollapsed.
 */

import type { ReviewSectionId, ReviewTabDescriptor } from "../review-registry";
import { OFFER_ACCEPTANCE_TAB_KIND } from "../review-registry";

export const OFFER_ACCEPTANCE_TAB_ID = "offer_acceptance";
export const OFFER_ACCEPTANCE_TAB_LABEL = "Offer & acceptance";

export const OFFER_ACCEPTANCE_MERGED_SECTION_IDS = [
  "contract_details",
  "invoice_details",
  "acceptance_documents",
] as const satisfies readonly ReviewSectionId[];

const MERGEABLE_SECTIONS = new Set<string>(OFFER_ACCEPTANCE_MERGED_SECTION_IDS);

/**
 * Worst-to-best rank for tab status dots. Unknown values rank with PENDING
 * so they stay in existing review vocabulary (PENDING, AMENDMENT_REQUESTED,
 * REJECTED, APPROVED, OFFER_SENT, OFFER_EXPIRED).
 */
const MERGED_STATUS_RANK: Record<string, number> = {
  REJECTED: 0,
  AMENDMENT_REQUESTED: 1,
  PENDING: 2,
  OFFER_EXPIRED: 3,
  OFFER_SENT: 4,
  APPROVED: 5,
};

const UNKNOWN_STATUS_RANK = MERGED_STATUS_RANK.PENDING;

export function isOfferAcceptanceTabDescriptor(
  descriptor: Pick<ReviewTabDescriptor, "kind" | "mergedSections" | "id">
): boolean {
  return (
    descriptor.kind === OFFER_ACCEPTANCE_TAB_KIND ||
    descriptor.id === OFFER_ACCEPTANCE_TAB_ID ||
    (descriptor.mergedSections?.length ?? 0) > 0
  );
}

export function deriveMergedSectionStatus(statuses: readonly string[]): string {
  if (statuses.length === 0) return "PENDING";
  let worst = statuses[0] ?? "PENDING";
  let worstRank = MERGED_STATUS_RANK[worst] ?? UNKNOWN_STATUS_RANK;
  for (const status of statuses.slice(1)) {
    const rank = MERGED_STATUS_RANK[status] ?? UNKNOWN_STATUS_RANK;
    if (rank < worstRank) {
      worst = status;
      worstRank = rank;
    }
  }
  return worst;
}

export function resolveReviewTabStatus(
  tab: Pick<ReviewTabDescriptor, "reviewSection" | "mergedSections">,
  sectionMap: ReadonlyMap<string, string>
): string {
  if (tab.mergedSections && tab.mergedSections.length > 0) {
    return deriveMergedSectionStatus(
      tab.mergedSections.map((section) => sectionMap.get(section) ?? "PENDING")
    );
  }
  return sectionMap.get(tab.reviewSection) ?? "PENDING";
}

/**
 * Replace contract_details, invoice_details, and acceptance_documents with a
 * single Offer & acceptance descriptor at the first original position.
 * Descriptors that are already merged are left in place.
 */
export function collapseOfferAcceptanceDescriptors(
  descriptors: readonly ReviewTabDescriptor[]
): ReviewTabDescriptor[] {
  const mergedSource: ReviewTabDescriptor[] = [];
  const kept: ReviewTabDescriptor[] = [];
  let insertAt = -1;

  for (const descriptor of descriptors) {
    const isMergeable =
      !descriptor.mergedSections?.length && MERGEABLE_SECTIONS.has(descriptor.reviewSection);
    if (isMergeable) {
      if (insertAt === -1) insertAt = kept.length;
      mergedSource.push(descriptor);
      continue;
    }
    kept.push(descriptor);
  }

  if (mergedSource.length === 0) return [...descriptors];

  const first = mergedSource[0]!;
  const unified: ReviewTabDescriptor = {
    id: OFFER_ACCEPTANCE_TAB_ID,
    kind: OFFER_ACCEPTANCE_TAB_KIND,
    label: OFFER_ACCEPTANCE_TAB_LABEL,
    reviewSection: first.reviewSection,
    stepKey: OFFER_ACCEPTANCE_TAB_ID,
    stepId: OFFER_ACCEPTANCE_TAB_ID,
    mergedSections: mergedSource.map((descriptor) => descriptor.reviewSection),
  };

  const next = [...kept];
  next.splice(insertAt < 0 ? next.length : insertAt, 0, unified);
  return next;
}
