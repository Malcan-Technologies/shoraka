/**
 * SECTION: Resubmit comparison modal tab list
 * WHY: The modal must show the same tabs as the live review page (Offer & acceptance merged),
 *      built from the frozen product workflow in the revision snapshot.
 * INPUT: Snapshot / live workflow, after-snapshot app shape, backend section statuses
 * OUTPUT: Collapsed tab descriptors, tab-strip statuses, per-tab Diff resolution
 * WHERE USED: ResubmitComparisonModal; ApplicationReviewTabs (shared tab Diff rule)
 */

import { collapseOfferAcceptanceDescriptors } from "@/components/application-review/offer-acceptance/unified-tab-descriptor";
import type {
  ReviewSectionId,
  ReviewTabDescriptor,
} from "@/components/application-review/review-registry";
import {
  getEffectiveReviewTabDescriptors,
  type TabDescriptorVisibilityApp,
} from "@/lib/effective-review-tab-descriptors";

/**
 * Frozen `product.workflow` stored in the after (next) revision snapshot; falls back to the live
 * catalog workflow only when the snapshot has none (same rule as the live page's product_workflow).
 */
export function resolveResubmitComparisonWorkflow(
  nextSnapshot: unknown,
  liveWorkflow: unknown
): unknown[] | undefined {
  const frozen = (nextSnapshot as { product?: { workflow?: unknown } | null } | null | undefined)
    ?.product?.workflow;
  if (Array.isArray(frozen) && frozen.length > 0) return frozen;
  return Array.isArray(liveWorkflow) ? liveWorkflow : undefined;
}

/** Same tab list as the live page: effective descriptors with Offer & acceptance collapsed. */
export function getResubmitComparisonTabDescriptors(
  workflow: unknown[] | null | undefined,
  app: TabDescriptorVisibilityApp | null | undefined
): ReviewTabDescriptor[] {
  return collapseOfferAcceptanceDescriptors(getEffectiveReviewTabDescriptors(workflow, app));
}

/** Backend sections a tab stands for (merged tab → every merged section). */
export function resubmitTabSections(
  descriptor: Pick<ReviewTabDescriptor, "reviewSection" | "mergedSections">
): ReviewSectionId[] {
  return descriptor.mergedSections?.length ? descriptor.mergedSections : [descriptor.reviewSection];
}

/**
 * One status row per backend section behind each tab, so ApplicationReviewTabs can derive the
 * merged Offer & acceptance dot itself. A synthetic `offer_acceptance` status from the parent is kept.
 */
export function buildResubmitTabStripSections(
  descriptors: readonly ReviewTabDescriptor[],
  reviewTabSections: readonly { section: string; status: string }[] | undefined
): { section: string; status: string }[] {
  const statusBySection = new Map((reviewTabSections ?? []).map((s) => [s.section, s.status]));
  const rows = new Map<string, string>();
  for (const descriptor of descriptors) {
    const tabStatus = statusBySection.get(descriptor.id);
    if (tabStatus !== undefined) rows.set(descriptor.id, tabStatus);
    for (const section of resubmitTabSections(descriptor)) {
      rows.set(section, statusBySection.get(section) ?? "PENDING");
    }
  }
  return Array.from(rows, ([section, status]) => ({ section, status }));
}

/** Same rule as the tab-strip Diff badge: a merged tab differs when any merged section does. */
export function resubmitTabDescriptorHasChanges(
  descriptor: Pick<ReviewTabDescriptor, "reviewSection" | "mergedSections">,
  sectionHasChanges: (section: ReviewSectionId) => boolean
): boolean {
  return resubmitTabSections(descriptor).some(sectionHasChanges);
}
