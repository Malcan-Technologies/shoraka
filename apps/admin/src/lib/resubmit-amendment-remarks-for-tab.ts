/**
 * SECTION: Map stored amendment remarks to a review tab
 * WHY: Resubmit comparison shows notes per tab (chat popover), not one global list.
 * INPUT: tab review section + amendment_remarks from API
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

export function amendmentRemarksForReviewTab(
  tab: ReviewSection,
  remarks: ResubmitAmendmentRemarkRow[]
): ResubmitAmendmentRemarkRow[] {
  return remarks.filter((r) => reviewSectionForRemark(r) === tab);
}
