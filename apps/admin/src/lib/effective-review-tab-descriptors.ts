/**
 * Same tab list rules as the main admin application review page (DynamicApplicationDetailPage).
 * WHERE USED: application detail page, ResubmitComparisonModal
 */

import {
  getReviewTabDescriptorsFromWorkflow,
  getReviewTabLabel,
  type ReviewTabDescriptor,
} from "@/components/application-review/review-registry";

export type TabDescriptorVisibilityApp = {
  visible_review_sections?: unknown;
  financing_structure?: unknown;
  invoices?: unknown;
};

/**
 * Workflow tabs + Financial, driven by the API's frozen `visible_review_sections` when provided,
 * then structure rules (invoice_only label, hide invoice tab when contract flow has zero invoices).
 *
 * `visible_review_sections` is computed server-side from the application's frozen
 * `product_version` (see AdminService.getReviewSectionPolicy) — it is the source of truth for
 * which tabs exist and in what order. Prefer passing the frozen `product_workflow` from
 * application detail (not the live catalog row). When the API list is present the tab set is
 * built from it; a section visible on the frozen version but absent from a drifted live
 * workflow (e.g. Acceptance) still gets a tab.
 */
export function getEffectiveReviewTabDescriptors(
  workflow: unknown[] | null | undefined,
  app: TabDescriptorVisibilityApp | null | undefined
): ReviewTabDescriptor[] {
  const structureType = (app?.financing_structure as { structure_type?: string } | null | undefined)
    ?.structure_type;
  const tabDescriptors = getReviewTabDescriptorsFromWorkflow(workflow, structureType);
  if (!app) {
    return tabDescriptors;
  }

  const fromApi = app.visible_review_sections;
  const visibleReviewSectionsFromApi =
    Array.isArray(fromApi) && fromApi.length > 0
      ? fromApi.filter((s): s is string => typeof s === "string")
      : null;

  let descriptors: ReviewTabDescriptor[];
  if (visibleReviewSectionsFromApi) {
    // API list order is source of truth (structure-aware from getReviewSectionOrder).
    const descriptorBySection = new Map(tabDescriptors.map((d) => [d.reviewSection, d]));
    descriptors = visibleReviewSectionsFromApi.map(
      (section) =>
        descriptorBySection.get(section as ReviewTabDescriptor["reviewSection"]) ?? {
          id: section,
          label: getReviewTabLabel(section),
          reviewSection: section as ReviewTabDescriptor["reviewSection"],
          kind: section as ReviewTabDescriptor["kind"],
          stepKey: section,
          stepId: section,
        }
    );
  } else {
    descriptors = tabDescriptors;
  }

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
