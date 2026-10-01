/**
 * SECTION: Map stored amendment remarks to a review tab
 * WHY: Resubmit comparison shows notes per tab (chat popover), not one global list.
 * INPUT: tab review section (or every section a merged tab stands for) + amendment_remarks from API
 * OUTPUT: Filtered remarks for that tab only
 * WHERE USED: ResubmitComparisonModal → ApplicationReviewTabs
 */

import {
  getSectionForPendingAmendment,
  type ReviewSection,
} from "@cashsouk/types";

export type ResubmitAmendmentRemarkRow = {
  scope: string;
  scope_key: string;
  remark: string;
};

function reviewSectionForRemark(r: ResubmitAmendmentRemarkRow): ReviewSection {
  if (r.scope === "section") {
    const k = r.scope_key;
    if (k === "financial_statements" || k === "financial") return "financial";
    if (k === "declarations") return "business_details";
    return k as ReviewSection;
  }
  const k = r.scope_key;
  if (k.startsWith("supporting_documents:")) return "supporting_documents";
  if (k.startsWith("invoice_details:")) return "invoice_details";
  if (k === "contract_details" || k.startsWith("contract_details:")) return "contract_details";
  if (k === "business_details" || k.startsWith("business_details:")) return "business_details";
  return getSectionForPendingAmendment(r.scope, r.scope_key);
}

/**
 * Remarks for one tab. Pass an array for a merged tab (Offer & acceptance); each remark maps to a
 * single section, so the union keeps API order and never repeats a remark.
 */
export function amendmentRemarksForReviewTab(
  tab: ReviewSection | readonly ReviewSection[],
  remarks: ResubmitAmendmentRemarkRow[]
): ResubmitAmendmentRemarkRow[] {
  const sections = new Set<ReviewSection>(typeof tab === "string" ? [tab] : tab);
  return remarks.filter((r) => sections.has(reviewSectionForRemark(r)));
}
