/**
 * SECTION: Which review tabs have field changes in a resubmit comparison
 * WHY: Tab "Diff" follows field_changes paths the comparison UI can show, same rule for every tab.
 * INPUT: reviewSection, field_changes from resubmit metadata
 * OUTPUT: boolean
 * WHERE USED: ApplicationReviewTabs in ResubmitComparisonModal
 */

import type { ReviewSectionId } from "@/components/application-review/review-registry";

type FieldChangeWithPath = { path: string };

/** True when path is that JSON root or any nested/array path under it. */
function pathUnderRoot(path: string, root: string): boolean {
  return (
    path === root ||
    path.startsWith(`${root}.`) ||
    path.startsWith(`${root}[`)
  );
}

/**
 * Comparison UI reads contract_details, customer_details, offer_details under snapshot `contract`.
 * Skip contract.id, contract.status, relations, etc. (still in JSON diff but not shown as field rows).
 */
function isContractTabMeaningfulDiffPath(path: string): boolean {
  if (path.startsWith("contract_details")) return false;
  if (path === "contract") return true;
  if (!path.startsWith("contract.")) return false;
  const sub = path.slice("contract.".length);
  const head = sub.split(/[.[\]]/)[0] ?? "";
  return (
    head === "contract_details" ||
    head === "customer_details" ||
    head === "offer_details"
  );
}

/**
 * Invoice comparison UI focuses on `details` and `offer_details` per row (and whole-row replacement).
 * Skip plain status / application_id–only churn that does not drive those blocks.
 */
function isInvoiceTabMeaningfulDiffPath(path: string): boolean {
  if (path === "invoices") return true;
  if (/^invoices\[[^\]]+\]$/.test(path)) return true;
  return (
    /invoices\[[^\]]+\]\.details(?:\.|$)/.test(path) ||
    /invoices\[[^\]]+\]\.offer_details(?:\.|$)/.test(path) ||
    /invoices\[[^\]]+\]\.offer_signing(?:\.|$)/.test(path)
  );
}

export function reviewSectionHasResubmitChanges(
  reviewSection: ReviewSectionId,
  fieldChanges: FieldChangeWithPath[] | undefined
): boolean {
  if (!fieldChanges?.length) return false;

  switch (reviewSection) {
    case "financial":
      return fieldChanges.some(
        (f) =>
          pathUnderRoot(f.path, "financial_statements") ||
          pathUnderRoot(f.path, "issuer_organization")
      );
    case "company_details":
      return fieldChanges.some(
        (f) => pathUnderRoot(f.path, "company_details") || pathUnderRoot(f.path, "issuer_organization")
      );
    case "business_details":
      return fieldChanges.some(
        (f) => pathUnderRoot(f.path, "business_details") || pathUnderRoot(f.path, "declarations")
      );
    case "supporting_documents":
      return fieldChanges.some((f) => pathUnderRoot(f.path, "supporting_documents"));
    case "contract_details":
      return fieldChanges.some((f) => isContractTabMeaningfulDiffPath(f.path));
    case "invoice_details":
      return fieldChanges.some((f) => isInvoiceTabMeaningfulDiffPath(f.path));
    default:
      return false;
  }
}
