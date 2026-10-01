/**
 * SECTION: Remarks shown in a resubmit comparison tab's Remark bar (pure)
 * WHY: Kept out of the .tsx bar so the filtering + merge is jest-testable.
 * INPUT: tab review section(s), full amendment_remarks, optional additional remarks (Documents tab:
 *        item remarks that match no comparison row — unmatchedDocumentAmendmentRemarks)
 * OUTPUT: Remarks for the bar, API order, additional ones appended without duplicates
 * WHERE USED: ResubmitTabAmendmentNotesBar
 *
 * Per-document item remarks are dropped here because comparison rows show them; the only ones the
 * bar shows are those passed as additional (no row matched them).
 */

import {
  amendmentRemarksForReviewTab,
  type ResubmitAmendmentRemarkRow,
} from "@/lib/resubmit-amendment-remarks-for-tab";
import type { ReviewSection } from "@cashsouk/types";

function remarkIdentity(r: ResubmitAmendmentRemarkRow): string {
  return `${r.scope}\u0000${r.scope_key}\u0000${r.remark}`;
}

export function resubmitTabBarRemarks(
  reviewSection: ReviewSection,
  reviewSections: readonly ReviewSection[] | undefined,
  remarks: ResubmitAmendmentRemarkRow[] | undefined,
  additionalRemarks?: readonly ResubmitAmendmentRemarkRow[]
): ResubmitAmendmentRemarkRow[] {
  const forTab = remarks?.length ? amendmentRemarksForReviewTab(reviewSections ?? reviewSection, remarks) : [];
  const withoutPerDocSlots = forTab.filter(
    (r) => !(r.scope === "item" && r.scope_key.startsWith("supporting_documents:"))
  );
  const notes =
    reviewSection === "supporting_documents"
      ? withoutPerDocSlots.filter((r) => r.scope === "section" && r.scope_key === "supporting_documents")
      : withoutPerDocSlots;
  if (!additionalRemarks?.length) return notes;
  const seen = new Set(notes.map(remarkIdentity));
  const merged = [...notes];
  for (const r of additionalRemarks) {
    const id = remarkIdentity(r);
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(r);
  }
  return merged;
}
