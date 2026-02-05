/**
 * Validation and payload for the product workflow form.
 * Output to DB: buildPayloadFromSteps() builds the workflow → dialog sends it to API → products-controller → repository → DB.
 * To add a step: see workflow-registry.tsx (and add validation here if the step has required fields).
 */

import { getStepKeyFromStepId, STEP_KEY_DISPLAY } from "@cashsouk/types";

// Step keys we use in validation and payload
export const FIRST_STEP_KEY = "financing_type";
export const LAST_STEP_KEY = "review_and_submit";
export const SUPPORTING_DOCS_STEP_KEY = "supporting_documents";
export const DECLARATIONS_STEP_KEY = "declarations";
export const INVOICE_DETAILS_STEP_KEY = "invoice_details";

export const SUPPORTING_DOC_CATEGORY_KEYS = ["financial_docs", "legal_docs", "compliance_docs", "others"] as const;
export const SUPPORTING_DOC_CATEGORY_LABELS: Record<string, string> = {
  financial_docs: "Financial Docs",
  legal_docs: "Legal Docs",
  compliance_docs: "Compliance Docs",
  others: "Others",
};

/** A workflow step. config shape depends on step type. */
export type Step = { id?: string; name?: string; config?: Record<string, unknown> };

export function getStepId(step: Step | unknown): string {
  return (step as Step)?.id ?? "";
}

/**
 * Build the steps array we send to the API: strip _pendingImage, set default for invoice details.
 */
export function buildPayloadFromSteps(steps: unknown[]): Step[] {
  return steps.map((s) => {
    const step = s as Step;
    let config = { ...(step.config ?? {}) };
    //  keep exmaple of how to use this
    // const stepKey = getStepKeyFromStepId(step.id ?? "");
    // if (stepKey === INVOICE_DETAILS_STEP_KEY && (config.max_financing_rate_percent == null)) {
    //   config = { ...config, max_financing_rate_percent: 80 };
    // }
    const { _pendingImage: _, ...configForApi } = config;
    return { ...step, config: configForApi };
  });
}

/** Compare two JSON-like values (for "unsaved changes" check). */
export function workflowDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => workflowDeepEqual(item, b[i]));
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as Record<string, unknown>).sort();
  const keysB = Object.keys(b as Record<string, unknown>).sort();
  if (keysA.length !== keysB.length || keysA.some((k, i) => k !== keysB[i])) return false;
  return keysA.every((k) =>
    workflowDeepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
  );
}

/**
 * Return list of error messages for steps that are missing required fields.
 * Used to show the amber alert and disable Save.
 */
export function getRequiredStepErrors(steps: unknown[]): string[] {
  const errors: string[] = [];
  for (const step of steps) {
    const stepId = getStepId(step);
    const stepKey = getStepKeyFromStepId(stepId);
    const config = ((step as Step).config ?? {}) as Record<string, unknown>;
    const stepLabel = (STEP_KEY_DISPLAY as Record<string, { title: string }>)[String(stepKey)]?.title ?? stepKey;

    if (stepKey === FIRST_STEP_KEY) {
      const name = String(config.name ?? "").trim();
      const category = String(config.category ?? "").trim();
      const description = String(config.description ?? "").trim();
      const image = config.image as { s3_key?: string } | undefined;
      const legacyS3Key = String(config.s3_key ?? "").trim();
      const hasPendingImage = config._pendingImage === true;
      const hasImage = Boolean((image?.s3_key ?? "").trim()) || Boolean(legacyS3Key) || hasPendingImage;
      if (!name) errors.push(`${stepLabel}: enter name`);
      if (!category) errors.push(`${stepLabel}: enter category`);
      if (!description) errors.push(`${stepLabel}: enter description`);
      if (!hasImage) errors.push(`${stepLabel}: add an image`);
    }

    if (stepKey === SUPPORTING_DOCS_STEP_KEY) {
      const enabledCategories = Array.isArray(config.enabled_categories)
        ? (config.enabled_categories as string[]).filter((k) => SUPPORTING_DOC_CATEGORY_KEYS.includes(k as (typeof SUPPORTING_DOC_CATEGORY_KEYS)[number]))
        : (Object.keys(config) as string[]).filter((k) => SUPPORTING_DOC_CATEGORY_KEYS.includes(k as (typeof SUPPORTING_DOC_CATEGORY_KEYS)[number]));
      if (enabledCategories.length === 0) {
        errors.push(`${stepLabel}: add at least one category`);
      } else {
        const hasEmptyCategory = enabledCategories.some((key) => {
          const list = config[key] as Array<{ name?: string }> | undefined;
          return !Array.isArray(list) || list.length === 0;
        });
        if (hasEmptyCategory) {
          errors.push(`${stepLabel}: every category must have at least one document`);
        }
      }
      let docsMissingName = 0;
      for (const key of SUPPORTING_DOC_CATEGORY_KEYS) {
        const list = config[key] as Array<{ name?: string }> | undefined;
        if (Array.isArray(list)) {
          for (const item of list) {
            if (!String(item?.name ?? "").trim()) docsMissingName++;
          }
        }
      }
      if (docsMissingName > 0) {
        errors.push(`${stepLabel}: every document must have a name`);
      }
    }

    if (stepKey === DECLARATIONS_STEP_KEY) {
      const raw = config.declarations;
      if (!Array.isArray(raw) || raw.length === 0) {
        errors.push(`${stepLabel}: add at least one declaration`);
      } else {
        const empty = raw.some((item: unknown) => {
          const text =
            typeof item === "object" && item != null && "text" in item
              ? String((item as { text: unknown }).text ?? "").trim()
              : typeof item === "string"
                ? item.trim()
                : "";
          return !text;
        });
        if (empty) errors.push(`${stepLabel}: every declaration must have text`);
      }
    }
  }
  return errors;
}
