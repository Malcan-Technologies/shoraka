/**
 * Same tab list rules as the main admin application review page (DynamicApplicationDetailPage).
 * WHERE USED: application detail page, ResubmitComparisonModal
 */

import {
  getReviewTabDescriptorsFromWorkflow,
  type ReviewTabDescriptor,
} from "@/components/application-review/review-registry";

export type TabDescriptorVisibilityApp = {
  visible_review_sections?: unknown;
  financing_structure?: unknown;
  invoices?: unknown;
};

/**
 * Workflow tabs + Financial, filtered by API visible_review_sections when provided,
 * then structure rules (invoice_only label, hide invoice tab when contract flow has zero invoices).
 */
export function getEffectiveReviewTabDescriptors(
  workflow: unknown[] | null | undefined,
  app: TabDescriptorVisibilityApp | null | undefined
): ReviewTabDescriptor[] {
  const tabDescriptors = getReviewTabDescriptorsFromWorkflow(workflow);
  if (!app) {
    return tabDescriptors;
  }

  const fromApi = app.visible_review_sections;
  const visibleReviewSectionsFromApi =
    Array.isArray(fromApi) && fromApi.length > 0
      ? new Set(fromApi.filter((s): s is string => typeof s === "string"))
      : null;

  let descriptors = visibleReviewSectionsFromApi
    ? tabDescriptors.filter((d) => visibleReviewSectionsFromApi.has(d.reviewSection))
    : tabDescriptors;

  const structureType = (app.financing_structure as { structure_type?: string } | null | undefined)
    ?.structure_type;
  const isInvoiceOnly = structureType === "invoice_only";
  const invoiceCount = (Array.isArray(app.invoices) ? app.invoices : []).length;
  const isContractOnlyNoInvoices =
    (structureType === "new_contract" || structureType === "existing_contract") && invoiceCount === 0;

  if (isContractOnlyNoInvoices) {
    descriptors = descriptors.filter((d) => d.reviewSection !== "invoice_details");
  }
  if (isInvoiceOnly) {
    descriptors = descriptors.map((d) =>
      d.reviewSection === "contract_details" ? { ...d, label: "Customer" } : d
    );
  }

  return descriptors;
}
