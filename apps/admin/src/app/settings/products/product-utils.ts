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

/** Default mapping from step key to review section. Used when step has no explicit reviewSection. */
const STEP_KEY_TO_SECTION: Partial<Record<string, ReviewSectionId>> = {
  financing_type: "FINANCIAL",
  financing_structure: "FINANCIAL",
  contract_details: "FINANCIAL",
  invoice_details: "FINANCIAL",
  company_details: "FINANCIAL",
  business_details: "JUSTIFICATION",
  supporting_documents: "DOCUMENTS",
  declarations: "DOCUMENTS",
  review_and_submit: "FINANCIAL",
};

/** Infer review section from step id (e.g. "business_details_1" -> JUSTIFICATION). */
export function inferReviewSectionFromStepId(stepId: string): ReviewSectionId {
  const key = getStepKeyFromStepId(stepId);
  if (key) return STEP_KEY_TO_SECTION[key] ?? "FINANCIAL";
  return "FINANCIAL";
}

/** Resolve review section for a step: explicit reviewSection first, else inferred. */
export function getReviewSectionForStep(step: WorkflowStepShape): ReviewSectionId {
  if (step.reviewSection && ["FINANCIAL", "JUSTIFICATION", "DOCUMENTS"].includes(step.reviewSection)) {
    return step.reviewSection;
  }
  return inferReviewSectionFromStepId(step.id);
}

/** Derive unique review section ids from product workflow, in registry order. */
export function getVisibleSectionIdsFromWorkflow(workflow: unknown[] | null | undefined): ReviewSectionId[] {
  const steps = normalizeWorkflowSteps(workflow);
  const sectionOrder: ReviewSectionId[] = ["FINANCIAL", "JUSTIFICATION", "DOCUMENTS"];
  const seen = new Set<ReviewSectionId>();
  const result: ReviewSectionId[] = [];
  for (const sectionId of sectionOrder) {
    const hasStep = steps.some((s) => getReviewSectionForStep(s) === sectionId);
    if (hasStep && !seen.has(sectionId)) {
      seen.add(sectionId);
      result.push(sectionId);
    }
  }
  if (result.length === 0) return sectionOrder;
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
