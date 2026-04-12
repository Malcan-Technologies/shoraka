/**
 * SECTION: Supporting documents workflow metadata for admin review
 * WHY: Surface Required/Optional and Single/Multiple from product workflow next to each slot.
 * INPUT: product workflow array, category key, document index in that category
 * OUTPUT: Step config object; requirement meta for badge row
 * WHERE USED: buildCategoryGroups, application detail page, resubmit comparison modal
 */

import { getStepKeyFromStepId } from "@cashsouk/types";

export type SupportingDocRowRequirementMeta = {
  required: boolean;
  multiple: boolean;
};

export function getSupportingDocumentsStepConfig(
  workflow: unknown[] | null | undefined
): Record<string, unknown> | null {
  if (!Array.isArray(workflow)) return null;
  for (const raw of workflow) {
    const step = raw as { id?: string; config?: unknown };
    const id = typeof step?.id === "string" ? step.id : "";
    if (!id) continue;
    const key = getStepKeyFromStepId(id);
    if (key === "supporting_documents" && step.config && typeof step.config === "object") {
      return step.config as Record<string, unknown>;
    }
  }
  return null;
}

/** Matches workflow builder: omitted or true → required; false → optional; allow_multiple → multiple files. */
export function supportingDocRowRequirementMeta(
  stepConfig: Record<string, unknown> | null | undefined,
  categoryKey: string,
  docIndex: number
): SupportingDocRowRequirementMeta | undefined {
  if (!stepConfig) return undefined;
  const rows = stepConfig[categoryKey];
  if (!Array.isArray(rows) || docIndex < 0 || docIndex >= rows.length) return undefined;
  const row = rows[docIndex] as Record<string, unknown> | undefined;
  if (!row || typeof row !== "object") return undefined;
  const required = row.required !== false;
  const multiple = row.allow_multiple === true;
  return { required, multiple };
}
