/**
 * Validation and payload for the product workflow form.
 * Output to DB: buildPayloadFromSteps() builds the workflow → dialog sends it to API → products-controller → repository → DB.
 * To add a step: see workflow-registry.tsx (and add validation here if the step has required fields).
 */

import {
  getStepKeyFromStepId,
  STEP_KEY_DISPLAY,
  enforceDeclarationsLastAndDropReview,
  parseSigningPackagesConfig,
  writeSigningPackagesConfig,
  ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY,
  DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT,
  DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT,
  MAX_INVOICE_FINANCING_RATIO_PERCENT,
  parsePositiveRmAmount,
  validateSigningTemplateConfig,
  workflowAcceptanceDocumentsIncludeGeneratedType,
  SUPPORTING_DOC_CATEGORY_KEYS,
  SUPPORTING_DOC_CATEGORY_LABELS,
} from "@cashsouk/types";
import { isDeclarationHtmlEmpty } from "@cashsouk/ui/declaration-rich-text";
import { parseMoney } from "@cashsouk/ui";

// Step keys we use in validation and payload
export const FIRST_STEP_KEY = "financing_type";
export const LAST_STEP_KEY = "declarations";
export const SUPPORTING_DOCS_STEP_KEY = "supporting_documents";
export const BUSINESS_DETAILS_STEP_KEY = "business_details";
export const DECLARATIONS_STEP_KEY = "declarations";
export const INVOICE_DETAILS_STEP_KEY = "invoice_details";

export { SUPPORTING_DOC_CATEGORY_KEYS, SUPPORTING_DOC_CATEGORY_LABELS };

/** A workflow step. config shape depends on step type. */
export type Step = { id?: string; name?: string; config?: Record<string, unknown> };

export function getStepId(step: Step | unknown): string {
  return (step as Step)?.id ?? "";
}

/**
 * Build the steps array we send to the API: strip _pendingImage, set default for invoice details.
 */
export function buildPayloadFromSteps(steps: unknown[]): Step[] {
  const ordered = enforceDeclarationsLastAndDropReview(steps as Step[]);
  return ordered.map((s) => {
    const step = s as Step;
    let config = { ...(step.config ?? {}) };
    const stepKey = getStepKeyFromStepId(step.id ?? "");

    if (stepKey === INVOICE_DETAILS_STEP_KEY) {
      const minRaw = config.min_invoice_value;
      const maxRaw = config.max_invoice_value;
      const subLimitRaw = config.sub_limit_per_invoice_rm;
      const minRatioRaw = config.min_financing_ratio_percent;
      const maxRatioRaw = config.max_financing_ratio_percent;

      const parseRatio = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        if (typeof v === "string") {
          const n = parseInt(v, 10);
          return !Number.isNaN(n) ? n : null;
        }
        return null;
      };

      const parseOptionalMonthInt = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
        if (typeof v === "string") {
          const n = parseInt(v.trim(), 10);
          return !Number.isNaN(n) ? n : null;
        }
        return null;
      };

      const applicationMonths = parseOptionalMonthInt(config.min_months_application_to_maturity);
      const reviewMonths = parseOptionalMonthInt(config.min_months_review_to_maturity);

      config = {
        ...config,
        min_invoice_value:
          typeof minRaw === "number"
            ? minRaw
            : typeof minRaw === "string" && minRaw.trim() !== ""
              ? parseMoney(minRaw)
              : null,

        max_invoice_value:
          typeof maxRaw === "number"
            ? maxRaw
            : typeof maxRaw === "string" && maxRaw.trim() !== ""
              ? parseMoney(maxRaw)
              : null,

        sub_limit_per_invoice_rm:
          typeof subLimitRaw === "number"
            ? subLimitRaw
            : typeof subLimitRaw === "string" && subLimitRaw.trim() !== ""
              ? parseMoney(subLimitRaw)
              : null,

        /** Default 60–80 when blank. */
        min_financing_ratio_percent: parseRatio(minRatioRaw) ?? DEFAULT_MIN_INVOICE_FINANCING_RATIO_PERCENT,
        max_financing_ratio_percent: parseRatio(maxRatioRaw) ?? DEFAULT_MAX_INVOICE_FINANCING_RATIO_PERCENT,
        min_months_application_to_maturity:
          applicationMonths != null && applicationMonths > 0 ? applicationMonths : null,
        min_months_review_to_maturity: reviewMonths != null && reviewMonths > 0 ? reviewMonths : null,
      };
    }

    if (stepKey === BUSINESS_DETAILS_STEP_KEY) {
      const legacyTemplate = config.guarantor_agreement_template;
      if (legacyTemplate && typeof legacyTemplate === "object" && !config.guarantor_agreement) {
        const legacy = legacyTemplate as Record<string, unknown>;
        const s3 = typeof legacy.s3_key === "string" ? legacy.s3_key.trim() : "";
        config = {
          ...config,
          guarantor_agreement: {
            name: "Guarantor agreement",
            allow_multiple: false,
            allowed_types: ["pdf"],
            required: Boolean(s3),
            ...(s3
              ? {
                  template: {
                    s3_key: s3,
                    file_name: String(legacy.file_name ?? legacy.filename ?? "template.pdf"),
                    ...(typeof legacy.file_size === "number" ? { file_size: legacy.file_size } : {}),
                  },
                }
              : {}),
          },
        };
      }
      delete (config as Record<string, unknown>).guarantor_agreement_template;
    }

    if (stepKey === "contract_details") {
      const raw = config.min_contract_months;

      config = {
        ...config,
        min_contract_months:
          typeof raw === "number"
            ? raw
            : typeof raw === "string" && raw.trim() !== ""
              ? Number(raw)
              : null,
      };
    }

    // Always persist signing_packages; migrate legacy dual / signing_template on save.
    if (stepKey === FIRST_STEP_KEY) {
      config = writeSigningPackagesConfig(config, parseSigningPackagesConfig(config));
    }

    const configForApi = { ...config } as Record<string, unknown>;
    delete configForApi._pendingImage;
    if (stepKey === FIRST_STEP_KEY) {
      delete configForApi.offer_acknowledgements;
    }
    return { ...step, config: configForApi };
  });
}

export function normalizeWorkflow(workflow: Step[]): Step[] {
  return workflow.map((step) => {
    const stepKey = getStepKeyFromStepId(step.id ?? "");
    const config = ((step as Step).config ?? {}) as {
      min_invoice_value?: string | number | null;
      max_invoice_value?: string | number | null;
      sub_limit_per_invoice_rm?: string | number | null;
    } & Record<string, unknown>;

    if (stepKey === INVOICE_DETAILS_STEP_KEY) {
      const minRaw = config.min_invoice_value;
      const maxRaw = config.max_invoice_value;
      const subLimitRaw = config.sub_limit_per_invoice_rm;

      return {
        ...step,
        config: {
          ...config,
          min_invoice_value:
            minRaw == null || minRaw === "" ? null : parseMoney(minRaw),
          max_invoice_value:
            maxRaw == null || maxRaw === "" ? null : parseMoney(maxRaw),
          sub_limit_per_invoice_rm:
            subLimitRaw == null || subLimitRaw === "" ? null : parseMoney(subLimitRaw),
        },
      };
    }

    return step;
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
 * Validate mandatory workflow step set: Financing Structure, Facility Details, Invoice Details.
 * Only applies when at least one of these steps is in the workflow.
 * When applicable: all three must be selected and appear in order. Returns error message or null.
 */
function getMandatoryStepSetError(steps: unknown[]): string | null {
  const stepKeys = steps.map((s) => getStepKeyFromStepId(getStepId(s)));
  const fsIndex = stepKeys.findIndex((k) => k === "financing_structure");
  const cdIndex = stepKeys.findIndex((k) => k === "contract_details");
  const idIndex = stepKeys.findIndex((k) => k === "invoice_details");

  const hasFs = fsIndex >= 0;
  const hasCd = cdIndex >= 0;
  const hasId = idIndex >= 0;

  /** Skip validation if none of these steps are in the workflow. */
  if (!hasFs && !hasCd && !hasId) {
    return null;
  }

  if (!hasFs || !hasCd || !hasId) {
    return "Financing Structure, Facility Details, and Invoice Details must all be selected and appear in the correct order.";
  }
  if (fsIndex >= cdIndex || cdIndex >= idIndex) {
    return "Financing Structure, Facility Details, and Invoice Details must all be selected and appear in the correct order.";
  }
  return null;
}

/**
 * Return list of error messages for steps that are missing required fields.
 * Used to show the amber alert and disable Save.
 */
export function getRequiredStepErrors(steps: unknown[]): string[] {
  const { errors } = runStepValidation(steps);
  return errors;
}

/**
 * Return set of step IDs that have validation errors. Used to highlight cards.
 */
export function getStepIdsWithErrors(steps: unknown[]): Set<string> {
  const { stepIdsWithErrors } = runStepValidation(steps);
  return stepIdsWithErrors;
}

/** Single validation pass producing both error messages and step IDs with errors. */
function runStepValidation(steps: unknown[]): { errors: string[]; stepIdsWithErrors: Set<string> } {
  const errors: string[] = [];
  const stepIdsWithErrors = new Set<string>();

  const mandatoryError = getMandatoryStepSetError(steps);
  if (mandatoryError) {
    errors.push(`Workflow: ${mandatoryError}`);
    const stepKeys = ["financing_structure", "contract_details", "invoice_details"];
    for (const s of steps) {
      const key = getStepKeyFromStepId(getStepId(s));
      if (key && (stepKeys as readonly string[]).includes(key)) stepIdsWithErrors.add(getStepId(s));
    }
  }

  for (const step of steps) {
    const stepId = getStepId(step);
    const stepKey = getStepKeyFromStepId(stepId);
    const config = ((step as Step).config ?? {}) as Record<string, unknown>;
    const stepLabel = (STEP_KEY_DISPLAY as Record<string, { title: string }>)[String(stepKey)]?.title ?? stepKey;

    if (stepKey === FIRST_STEP_KEY) {
      const name = String(config.name ?? "").trim();
      const category = String(config.category ?? "").trim();
      const description = String(config.description ?? "").trim();
      const img = config.image as { s3_key?: string } | undefined;
      const hasImage = !!(img?.s3_key ?? (config.s3_key as string | undefined) ?? (config._pendingImage as boolean));
      if (!name) {
        errors.push(`${stepLabel}: enter name`);
        stepIdsWithErrors.add(stepId);
      }
      if (!category) {
        errors.push(`${stepLabel}: enter category`);
        stepIdsWithErrors.add(stepId);
      }
      if (!description) {
        errors.push(`${stepLabel}: enter description`);
        stepIdsWithErrors.add(stepId);
      }
      if (!hasImage) {
        errors.push(`${stepLabel}: add image`);
        stepIdsWithErrors.add(stepId);
      }
    }

    if (stepKey === INVOICE_DETAILS_STEP_KEY) {
      const minRaw = config.min_invoice_value;
      const maxRaw = config.max_invoice_value;
      const subLimitRaw = config.sub_limit_per_invoice_rm;
      const minRatioRaw = config.min_financing_ratio_percent;
      const maxRatioRaw = config.max_financing_ratio_percent;

      let minValue: number | null = null;
      let maxValue: number | null = null;

      if (typeof minRaw === "number") {
        minValue = minRaw;
      } else if (typeof minRaw === "string" && minRaw.trim() !== "") {
        minValue = parseMoney(minRaw);
      }

      if (typeof maxRaw === "number") {
        maxValue = maxRaw;
      } else if (typeof maxRaw === "string" && maxRaw.trim() !== "") {
        maxValue = parseMoney(maxRaw);
      }

      const subLimitValue = parsePositiveRmAmount(
        typeof subLimitRaw === "number" || typeof subLimitRaw === "string" ? subLimitRaw : null
      );
      if (
        subLimitRaw != null &&
        subLimitRaw !== "" &&
        subLimitValue == null
      ) {
        errors.push(`${stepLabel}: sub-limit per invoice must be a positive amount`);
        stepIdsWithErrors.add(stepId);
      }
      if (workflowAcceptanceDocumentsIncludeGeneratedType(steps, "arf_contract_facility_lo")) {
        if (subLimitValue == null) {
          errors.push(`${stepLabel}: sub-limit per invoice is required for the Letter of Offer`);
          stepIdsWithErrors.add(stepId);
        }
      }

      if (minValue != null && minValue < 0) {
        errors.push(`${stepLabel}: minimum financing amount cannot be negative`);
        stepIdsWithErrors.add(stepId);
      }

      if (maxValue != null && maxValue < 0) {
        errors.push(`${stepLabel}: maximum financing amount cannot be negative`);
        stepIdsWithErrors.add(stepId);
      }

      if (
        minValue != null &&
        maxValue != null &&
        minValue > maxValue
      ) {
        errors.push(`${stepLabel}: minimum cannot exceed maximum`);
        stepIdsWithErrors.add(stepId);
      }

      /** Financing ratio validation: min/max must be numbers, min <= max, min >= 0, max <= 80. */
      const parseRatio = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        if (typeof v === "string") {
          const n = parseInt(v, 10);
          return !Number.isNaN(n) ? n : null;
        }
        return null;
      };
      const minRatio = parseRatio(minRatioRaw);
      const maxRatio = parseRatio(maxRatioRaw);

      if (minRatio != null && minRatio < 0) {
        errors.push(`${stepLabel}: minimum financing ratio cannot be negative`);
        stepIdsWithErrors.add(stepId);
      }
      if (maxRatio != null && maxRatio > MAX_INVOICE_FINANCING_RATIO_PERCENT) {
        errors.push(
          `${stepLabel}: maximum financing ratio cannot exceed ${MAX_INVOICE_FINANCING_RATIO_PERCENT}`
        );
        stepIdsWithErrors.add(stepId);
      }
      if (minRatio != null && maxRatio != null && minRatio > maxRatio) {
        errors.push(`${stepLabel}: minimum financing ratio cannot be greater than maximum financing ratio`);
        stepIdsWithErrors.add(stepId);
      }

      const parseMonth = (v: unknown): number | null => {
        if (v == null || v === "") return null;
        if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v);
        if (typeof v === "string") {
          const n = parseInt(v.trim(), 10);
          return !Number.isNaN(n) ? n : null;
        }
        return null;
      };
      const applicationM = parseMonth(config.min_months_application_to_maturity);
      const reviewM = parseMonth(config.min_months_review_to_maturity);
      for (const [label, val] of [
        ["Min months (application → maturity)", applicationM],
        ["Min months (review → maturity)", reviewM],
      ] as const) {
        if (val != null && (val < 0 || val > 120)) {
          errors.push(`${stepLabel}: ${label} must be between 0 and 120 (or leave blank)`);
          stepIdsWithErrors.add(stepId);
        }
      }
    }

    if (stepKey === "contract_details") {
      const raw = config.min_contract_months;
      const value =
        typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : typeof raw === "number"
            ? raw
            : null;

      if (value == null || value < 1) {
        errors.push(`${stepLabel}: minimum contract months must be at least 1`);
        stepIdsWithErrors.add(stepId);
      }

      if (value != null && value > 120) {
        errors.push(`${stepLabel}: minimum contract months cannot exceed 120`);
        stepIdsWithErrors.add(stepId);
      }
    }

    if (stepKey === BUSINESS_DETAILS_STEP_KEY) {
      const row = config.guarantor_agreement as { name?: string; allowed_types?: unknown } | undefined;
      if (row && typeof row === "object") {
        if (!String(row.name ?? "").trim()) {
          errors.push(`${stepLabel}: enter guarantor agreement document name`);
          stepIdsWithErrors.add(stepId);
        }
        const at = row.allowed_types;
        if (at !== undefined) {
          if (!Array.isArray(at) || at.length === 0) {
            errors.push(`${stepLabel}: guarantor agreement allows only one file type (PDF or Excel)`);
            stepIdsWithErrors.add(stepId);
          } else {
            const tokens = at
              .filter((x): x is string => typeof x === "string")
              .filter((t) => t === "pdf" || t === "excel");
            const unique = [...new Set(tokens)];
            if (unique.length !== 1) {
              errors.push(`${stepLabel}: guarantor agreement allows only one file type (PDF or Excel)`);
              stepIdsWithErrors.add(stepId);
            }
          }
        }
      }
    }

    if (stepKey === SUPPORTING_DOCS_STEP_KEY) {
      const enabledCategories = Array.isArray(config.enabled_categories)
        ? (config.enabled_categories as string[]).filter((k) => SUPPORTING_DOC_CATEGORY_KEYS.includes(k as (typeof SUPPORTING_DOC_CATEGORY_KEYS)[number]))
        : (Object.keys(config) as string[]).filter((k) => SUPPORTING_DOC_CATEGORY_KEYS.includes(k as (typeof SUPPORTING_DOC_CATEGORY_KEYS)[number]));
      if (enabledCategories.length === 0) {
        errors.push(`${stepLabel}: add at least one category`);
        stepIdsWithErrors.add(stepId);
      } else {
        const hasEmptyCategory = enabledCategories.some((key) => {
          const list = config[key] as Array<{ name?: string }> | undefined;
          return !Array.isArray(list) || list.length === 0;
        });
        if (hasEmptyCategory) {
          errors.push(`${stepLabel}: every category must have at least one document`);
          stepIdsWithErrors.add(stepId);
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
        stepIdsWithErrors.add(stepId);
      }
      let badAllowedTypes = 0;
      for (const key of SUPPORTING_DOC_CATEGORY_KEYS) {
        const list = config[key] as Array<{ allowed_types?: unknown }> | undefined;
        if (!Array.isArray(list)) continue;
        for (const item of list) {
          const at = item?.allowed_types;
          if (at === undefined) continue;
          if (!Array.isArray(at) || at.length === 0) {
            badAllowedTypes++;
            continue;
          }
          const tokens = at
            .filter((x): x is string => typeof x === "string")
            .filter((t) => t === "pdf" || t === "excel");
          const unique = [...new Set(tokens)];
          if (unique.length !== 1) badAllowedTypes++;
        }
      }
      if (badAllowedTypes > 0) {
        errors.push(`${stepLabel}: each document allows only one file type (PDF or Excel)`);
        stepIdsWithErrors.add(stepId);
      }
    }

    if (stepKey === FIRST_STEP_KEY) {
      const list = config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY] as
        | Array<{ name?: string; allowed_types?: unknown }>
        | undefined;
      if (Array.isArray(list)) {
        let acceptanceMissingName = 0;
        let acceptanceBadTypes = 0;
        for (const item of list) {
          if (!String(item?.name ?? "").trim()) acceptanceMissingName++;
          const at = item?.allowed_types;
          if (at === undefined) continue;
          if (!Array.isArray(at) || at.length === 0) {
            acceptanceBadTypes++;
            continue;
          }
          const tokens = at
            .filter((x): x is string => typeof x === "string")
            .filter((t) => t === "pdf" || t === "excel");
          const unique = [...new Set(tokens)];
          if (unique.length !== 1) acceptanceBadTypes++;
        }
        if (acceptanceMissingName > 0) {
          errors.push(`Acceptance documents: every document must have a name`);
          stepIdsWithErrors.add(stepId);
        }
        if (acceptanceBadTypes > 0) {
          errors.push(`Acceptance documents: each document allows only one file type (PDF or Excel)`);
          stepIdsWithErrors.add(stepId);
        }
      }

      // Offer-acceptance products (acks and/or acceptance docs) need a complete signing package.
      // Also validate whenever any signing roles/docs are present so half-configs cannot save.
      const signing = parseSigningPackagesConfig(config);
      const acceptanceDocs = config[ACCEPTANCE_DOCUMENTS_WORKFLOW_KEY];
      const usesOfferAcceptance =
        Array.isArray(acceptanceDocs) && acceptanceDocs.length > 0;
      const hasSigningContent = signing.roles.length > 0 || signing.documents.length > 0;
      if (usesOfferAcceptance || hasSigningContent) {
        for (const msg of validateSigningTemplateConfig(signing)) {
          errors.push(msg);
          stepIdsWithErrors.add(stepId);
        }
      }
    }

    if (stepKey === DECLARATIONS_STEP_KEY) {
      const raw = config.declarations;
      if (!Array.isArray(raw) || raw.length === 0) {
        errors.push(`${stepLabel}: add at least one declaration`);
        stepIdsWithErrors.add(stepId);
      } else {
        const empty = raw.some((item: unknown) => {
          const text =
            typeof item === "object" && item != null && "text" in item
              ? String((item as { text: unknown }).text ?? "")
              : typeof item === "string"
                ? item
                : "";
          return isDeclarationHtmlEmpty(text);
        });
        if (empty) {
          errors.push(`${stepLabel}: every declaration must have text`);
          stepIdsWithErrors.add(stepId);
        }
      }
    }
  }

  const ordered = enforceDeclarationsLastAndDropReview(steps as Step[]);
  const lastKey = getStepKeyFromStepId(getStepId(ordered[ordered.length - 1] ?? {}));
  if (ordered.length > 0 && lastKey !== DECLARATIONS_STEP_KEY) {
    errors.push("Workflow: Declarations must be the last step.");
  }

  return { errors, stepIdsWithErrors };
}
