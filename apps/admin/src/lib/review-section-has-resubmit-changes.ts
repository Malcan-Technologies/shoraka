/**
 * Which review tabs have field changes in a resubmit comparison.
 * Contract / invoice rules match @cashsouk/types `isMeaningfulResubmitSnapshotFieldPath` (same as API resubmit summary).
 */

import type { ReviewSectionId } from "@/components/application-review/review-registry";
import { isMeaningfulResubmitSnapshotFieldPath } from "@cashsouk/types";

type FieldChangeWithPath = { path: string };

function pathUnderRoot(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}.`) || path.startsWith(`${root}[`);
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
      return fieldChanges.some((f) => {
        const p = f.path;
        if (pathUnderRoot(p, "contract_details")) return true;
        return p.startsWith("contract.") && isMeaningfulResubmitSnapshotFieldPath(p);
      });
    case "invoice_details":
      return fieldChanges.some(
        (f) => f.path.startsWith("invoices") && isMeaningfulResubmitSnapshotFieldPath(f.path)
      );
    default:
      return false;
  }
}
