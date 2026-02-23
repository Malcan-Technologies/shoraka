import type { Product } from "@cashsouk/types";
import { APPLICATION_STEP_KEYS, STEP_KEY_DISPLAY, getStepKeyFromStepId } from "@cashsouk/types";

/** Review section id for admin review tabs. Must align with Prisma ReviewSection enum. */
export type ReviewSectionId = "FINANCIAL" | "JUSTIFICATION" | "DOCUMENTS";

/** One step in the workflow. id = stepId (e.g. financing_type_1), name = label, config = step-specific data. */
export type WorkflowStepShape = {
  id: string;
  name: string;
  config?: unknown;
  /** Optional: which review section this step belongs to. If absent, inferred from step key. */
  reviewSection?: ReviewSectionId;
};

/** Descriptor for an admin review tab. Used for dynamic tab rendering. */
export type ReviewTabDescriptor = {
  id: string;
  label: string;
  /** Backend section for status mapping. FINANCIAL | JUSTIFICATION | DOCUMENTS for special tabs; others use PENDING. */
  reviewSection: ReviewSectionId | "PENDING";
  kind: "financial" | "business_details" | "supporting_documents" | "step";
  /** Step key when kind is "step" (e.g. financing_type, contract_details). */
  stepKey?: string;
  /** Step id when kind is "step" (e.g. financing_type_1). */
  stepId?: string;
};

/**
 * Step keys that get an admin review tab when present in the workflow.
 * Add a key here when adding a new step that has a section component (StepSummarySection or dedicated).
 * See docs/guides/add-a-product-workflow-step.md.
 */
const REVIEW_TAB_STEP_KEYS = new Set([
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
  "company_details",
]);

/** Review-only tab labels. Edit this map to change labels shown on admin application review tabs. */
const REVIEW_TAB_LABELS: Record<string, string> = {
  FINANCIAL: "Financial",
  business_details: "Business",
  supporting_documents: "Documents",
  contract_details: "Contract",
  invoice_details: "Invoice",
  company_details: "Company",
};

/** Order of step keys on review tabs. Financial is always first; this controls the rest. Add new step keys here when adding workflow steps. */
const REVIEW_TAB_ORDER = [
  "company_details",
  "business_details",
  "supporting_documents",
  "contract_details",
  "invoice_details",
] as const;

function getReviewTabLabel(stepKey: string): string {
  return REVIEW_TAB_LABELS[stepKey] ?? stepKey.replace(/_/g, " ");
}

/** Build ordered review tab descriptors from product workflow. Financial tab is always first; step tabs follow REVIEW_TAB_ORDER. */
export function getReviewTabDescriptorsFromWorkflow(workflow: unknown[] | null | undefined): ReviewTabDescriptor[] {
  const result: ReviewTabDescriptor[] = [];

  result.push({
    id: "FINANCIAL",
    label: getReviewTabLabel("FINANCIAL"),
    reviewSection: "FINANCIAL",
    kind: "financial",
  });

  const steps = normalizeWorkflowSteps(workflow);
  const stepTabs: ReviewTabDescriptor[] = [];
  for (const step of steps) {
    const stepKey = getStepKeyFromStepId(step.id);
    if (!stepKey || !REVIEW_TAB_STEP_KEYS.has(stepKey)) continue;
    const label = getReviewTabLabel(stepKey);

    let tab: ReviewTabDescriptor;
    if (stepKey === "business_details") {
      tab = { id: step.id, label, reviewSection: "JUSTIFICATION", kind: "business_details", stepKey, stepId: step.id };
    } else if (stepKey === "supporting_documents") {
      tab = { id: step.id, label, reviewSection: "DOCUMENTS", kind: "supporting_documents", stepKey, stepId: step.id };
    } else {
      tab = { id: step.id, label, reviewSection: "PENDING", kind: "step", stepKey, stepId: step.id };
    }
    stepTabs.push(tab);
  }

  const orderIndex = (key: string) => {
    const i = REVIEW_TAB_ORDER.indexOf(key as (typeof REVIEW_TAB_ORDER)[number]);
    return i === -1 ? REVIEW_TAB_ORDER.length : i;
  };
  stepTabs.sort((a, b) => orderIndex(a.stepKey!) - orderIndex(b.stepKey!));

  result.push(...stepTabs);
  return result;
}

/** Default workflow: all 9 steps in APPLICATION_STEP_KEYS order, id = `${key}_1`, name from STEP_KEY_DISPLAY. */
export function getDefaultWorkflowSteps(): WorkflowStepShape[] {
  return APPLICATION_STEP_KEYS.map((key) => ({
    id: `${key}_1`,
    name: STEP_KEY_DISPLAY[key].title,
  }));
}

/** First and last steps that must always be present (financing type, review and submit). Used for create-mode initial and ensure-present. */
export function getRequiredFirstAndLastSteps(): [WorkflowStepShape, WorkflowStepShape] {
  const all = getDefaultWorkflowSteps();
  return [all[0], all[all.length - 1]];
}

/** Turn raw workflow from API into steps with id and name. If empty or invalid, return default steps. */
export function normalizeWorkflowSteps(raw: unknown[] | null | undefined): WorkflowStepShape[] {
  if (!raw?.length) return getDefaultWorkflowSteps();
  const steps = raw.map((step) => {
    const s = step as WorkflowStepShape;
    const name = s?.name?.trim() ?? stepDisplayName(step);
    const reviewSection = s?.reviewSection as ReviewSectionId | undefined;
    const validSection =
      reviewSection && ["FINANCIAL", "JUSTIFICATION", "DOCUMENTS"].includes(reviewSection)
        ? reviewSection
        : undefined;
    return {
      id: s?.id ?? "",
      name: name !== "—" ? name : "Step",
      config: s?.config,
      reviewSection: validSection,
    };
  }).filter((s) => s.id);
  return steps.length ? steps : getDefaultWorkflowSteps();
}

/** Product name shown in the list: from first step's config.name or config.type.name. */
export function productName(p: Product): string {
  const first = p.workflow?.[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
  const name = first?.config?.name?.trim() ?? first?.config?.type?.name?.trim();
  return name ?? "—";
}

/** Set name in the first step's config (and config.type if present). */
export function workflowWithName(workflow: unknown[], name: string): unknown[] {
  const next = JSON.parse(JSON.stringify(workflow)) as unknown[];
  const first = next[0] as { config?: { name?: string; type?: { name?: string } } } | undefined;
  if (!first) return next;
  if (!first.config) first.config = {};
  const config = first.config as { name?: string; type?: { name?: string } };
  config.name = name;
  if (config.type && typeof config.type === "object") {
    config.type = { ...config.type, name };
  } else {
    config.type = { name };
  }
  return next;
}

/** Display name for a step: from config.name, config.type.name, or step.name. */
export function stepDisplayName(step: unknown): string {
  const s = step as { config?: { name?: string; type?: { name?: string } }; name?: string } | undefined;
  const fromConfig = s?.config?.name?.trim() ?? s?.config?.type?.name?.trim();
  return fromConfig ?? s?.name?.trim() ?? "—";
}
