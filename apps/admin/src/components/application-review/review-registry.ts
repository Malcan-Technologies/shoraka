import {
  getReviewSectionOrder,
  getReviewSectionPrerequisites,
  getStepKeyFromStepId,
  isInvoiceOnlyFinancingStructure,
  isPrerequisiteSectionSatisfied,
  REVIEW_SECTION_ORDER,
  shouldShowAcceptanceDocumentsReviewSection,
  workflowShowsAcceptanceReviewSection,
  type ReviewSection,
} from "@cashsouk/types";

/** Canonical section IDs sourced from shared types package. */
export const REVIEW_SECTION_IDS = REVIEW_SECTION_ORDER;
export type ReviewSectionId = ReviewSection;

/** Descriptor for an admin review tab. Used for dynamic tab rendering. */
export type ReviewTabDescriptor = {
  id: string;
  label: string;
  reviewSection: ReviewSectionId;
  kind: ReviewSectionId;
  stepKey?: string;
  stepId?: string;
};

/**
 * Step keys that should become admin review tabs when present in workflow.
 * Financial is not workflow-driven and is always shown.
 */
const REVIEW_TAB_STEP_KEYS = new Set([
  "company_details",
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
]);

const REVIEW_TAB_LABELS: Record<string, string> = {
  financial: "Financial",
  business_details: "Business & Guarantor",
  supporting_documents: "Documents",
  acceptance_documents: "Acceptance",
  contract_details: "Facility",
  invoice_details: "Invoice",
  company_details: "Company",
};

/**
 * Prerequisites for each tab (contract / default).
 * Invoice-only and Acceptance gates come from getReviewSectionPrerequisites(structureType).
 * Server-provided prerequisites take precedence when present on the application.
 */
const TAB_PREREQUISITES: Record<string, string[]> = getReviewSectionPrerequisites() as Record<
  string,
  string[]
>;

/** Human-readable label for a review section or step key. */
export function getReviewTabLabel(stepKey: string): string {
  return REVIEW_TAB_LABELS[stepKey] ?? stepKey.replace(/_/g, " ");
}

/**
 * Build ordered review tab descriptors from product workflow.
 * Financial tab is always first; remaining tabs follow structure-aware section order.
 */
export function getReviewTabDescriptorsFromWorkflow(
  workflow: unknown[] | null | undefined,
  structureType?: string | null
): ReviewTabDescriptor[] {
  const result: ReviewTabDescriptor[] = [];

  result.push({
    id: "financial",
    label: getReviewTabLabel("financial"),
    reviewSection: "financial",
    kind: "financial",
  });

  const rawSteps = Array.isArray(workflow) ? workflow : [];
  const stepTabs: ReviewTabDescriptor[] = [];
  for (const raw of rawSteps) {
    const step = raw as { id?: unknown };
    const stepId = typeof step?.id === "string" ? step.id : "";
    if (!stepId) continue;

    const stepKey = getStepKeyFromStepId(stepId);
    if (!stepKey || !REVIEW_TAB_STEP_KEYS.has(stepKey)) continue;

    stepTabs.push({
      id: stepId,
      label: getReviewTabLabel(stepKey),
      reviewSection: stepKey as ReviewSectionId,
      kind: stepKey as ReviewTabDescriptor["kind"],
      stepKey,
      stepId,
    });
  }

  if (
    shouldShowAcceptanceDocumentsReviewSection(
      structureType,
      workflowShowsAcceptanceReviewSection(workflow)
    )
  ) {
    stepTabs.push({
      id: "acceptance_documents",
      label: getReviewTabLabel("acceptance_documents"),
      reviewSection: "acceptance_documents",
      kind: "acceptance_documents",
      stepKey: "acceptance_documents",
      stepId: "acceptance_documents",
    });
  }

  const order = getReviewSectionOrder(structureType);
  const orderIndex = (key: string) => {
    const i = order.indexOf(key as ReviewSection);
    return i === -1 ? order.length : i;
  };
  stepTabs.sort((a, b) => orderIndex(a.stepKey ?? "") - orderIndex(b.stepKey ?? ""));

  result.push(...stepTabs);
  return result;
}

function resolveTabPrerequisites(
  sectionId: string,
  prerequisitesBySection?: Record<string, string[]>,
  structureType?: string | null
): string[] | undefined {
  if (prerequisitesBySection != null && sectionId in prerequisitesBySection) {
    return prerequisitesBySection[sectionId];
  }
  if (structureType != null && structureType !== "") {
    const structured = getReviewSectionPrerequisites(structureType);
    const fromStructure = structured[sectionId as ReviewSection];
    if (fromStructure) return fromStructure;
  }
  return TAB_PREREQUISITES[sectionId];
}

/**
 * Check if a tab is unlocked based on section approval status.
 * Sections not in TAB_PREREQUISITES are treated as unlocked.
 * Server-provided prerequisites (when present) take precedence.
 * Acceptance treats Contract/Invoice OFFER_SENT / OFFER_EXPIRED as satisfying those prereqs.
 */
export function isTabUnlocked(
  sectionId: string,
  sectionStatusMap: Map<string, string>,
  availableSections?: ReadonlySet<string>,
  prerequisitesBySection?: Record<string, string[]>,
  structureType?: string | null
): boolean {
  const prereqs = resolveTabPrerequisites(sectionId, prerequisitesBySection, structureType);
  if (!prereqs?.length) return true;
  const relevantPrereqs = availableSections
    ? prereqs.filter((prereq) => availableSections.has(prereq))
    : prereqs;
  if (!relevantPrereqs.length) return true;
  return relevantPrereqs.every((prereq) =>
    isPrerequisiteSectionSatisfied(prereq, sectionStatusMap.get(prereq), sectionId)
  );
}

/** Human-readable tooltip explaining why a tab is locked. */
export function getTabUnlockTooltip(
  sectionId: string,
  sectionStatusMap: Map<string, string>,
  availableSections?: ReadonlySet<string>,
  prerequisitesBySection?: Record<string, string[]>,
  labelOverrides?: Record<string, string>,
  structureType?: string | null
): string {
  const prereqs = resolveTabPrerequisites(sectionId, prerequisitesBySection, structureType);
  if (!prereqs?.length) return "";
  const relevantPrereqs = availableSections
    ? prereqs.filter((prereq) => availableSections.has(prereq))
    : prereqs;
  if (!relevantPrereqs.length) return "";
  const missing = relevantPrereqs.filter(
    (p) => !isPrerequisiteSectionSatisfied(p, sectionStatusMap.get(p), sectionId)
  );
  if (missing.length === 0) return "";

  if (sectionId === "acceptance_documents") {
    const commercialMissing = missing.filter(
      (p) => p === "contract_details" || p === "invoice_details"
    );
    const underwritingMissing = missing.filter(
      (p) => p !== "contract_details" && p !== "invoice_details"
    );
    const parts: string[] = [];
    if (underwritingMissing.length > 0) {
      const getLabel = (m: string) => labelOverrides?.[m] ?? REVIEW_TAB_LABELS[m] ?? m;
      parts.push(`Approve ${underwritingMissing.map(getLabel).join(", ")} section first`);
    }
    if (commercialMissing.includes("invoice_details")) {
      parts.push("Send offer from Invoice first");
    }
    if (commercialMissing.includes("contract_details")) {
      // Invoice-only: contract_details is Customer (manual approve). Facility: Send Offer.
      const isInvoiceOnly = isInvoiceOnlyFinancingStructure({ structure_type: structureType });
      parts.push(
        isInvoiceOnly ? "Approve Customer section first" : "Send offer from Facility first"
      );
    }
    return parts.join(". ");
  }

  const getLabel = (m: string) => labelOverrides?.[m] ?? REVIEW_TAB_LABELS[m] ?? m;
  const labels = missing.map(getLabel).join(", ");
  return `Approve ${labels} section first`;
}
