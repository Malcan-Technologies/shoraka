import {
  getStepKeyFromStepId,
  REVIEW_SECTION_ORDER,
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
  business_details: "Business",
  supporting_documents: "Documents",
  contract_details: "Contract",
  invoice_details: "Invoice",
  company_details: "Company",
};

const REVIEW_TAB_ORDER = [
  "company_details",
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
] as const;

/**
 * Prerequisites for each tab.
 * - Contract unlocks when Financial + Company + Business + Documents are approved.
 * - Invoice unlocks when Contract is approved.
 */
const TAB_PREREQUISITES: Record<string, string[]> = {
  financial: [],
  company_details: [],
  business_details: [],
  supporting_documents: [],
  contract_details: ["financial", "company_details", "business_details", "supporting_documents"],
  invoice_details: ["contract_details"],
};

/** Human-readable label for a review section or step key. */
export function getReviewTabLabel(stepKey: string): string {
  return REVIEW_TAB_LABELS[stepKey] ?? stepKey.replace(/_/g, " ");
}

/**
 * Build ordered review tab descriptors from product workflow.
 * Financial tab is always first; step tabs follow REVIEW_TAB_ORDER.
 */
export function getReviewTabDescriptorsFromWorkflow(
  workflow: unknown[] | null | undefined
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

  const orderIndex = (key: string) => {
    const i = REVIEW_TAB_ORDER.indexOf(key as (typeof REVIEW_TAB_ORDER)[number]);
    return i === -1 ? REVIEW_TAB_ORDER.length : i;
  };
  stepTabs.sort((a, b) => orderIndex(a.stepKey ?? "") - orderIndex(b.stepKey ?? ""));

  result.push(...stepTabs);
  return result;
}

/**
 * Check if a tab is unlocked based on section approval status.
 * Sections not in TAB_PREREQUISITES are treated as unlocked.
 */
export function isTabUnlocked(
  sectionId: string,
  sectionStatusMap: Map<string, string>
): boolean {
  const prereqs = TAB_PREREQUISITES[sectionId];
  if (!prereqs?.length) return true;
  return prereqs.every((prereq) => sectionStatusMap.get(prereq) === "APPROVED");
}

/** Human-readable tooltip explaining why a tab is locked. */
export function getTabUnlockTooltip(
  sectionId: string,
  sectionStatusMap: Map<string, string>
): string {
  const prereqs = TAB_PREREQUISITES[sectionId];
  if (!prereqs?.length) return "";
  const missing = prereqs.filter((p) => sectionStatusMap.get(p) !== "APPROVED");
  if (missing.length === 0) return "";
  const labels = missing.map((m) => REVIEW_TAB_LABELS[m] ?? m).join(", ");
  return `Approve ${labels} section first`;
}
