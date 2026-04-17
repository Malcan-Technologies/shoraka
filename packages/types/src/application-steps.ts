/**
 * Application step keys and display config.
 * Matches Application table columns and API stepIdToColumn mapping.
 */

export const APPLICATION_STEP_KEYS = [
  "financing_type",
  "financing_structure",
  "contract_details",
  "invoice_details",
  "company_details",
  "business_details",
  "financial_statements",
  "supporting_documents",
  "declarations",
] as const;

export type ApplicationStepKey = (typeof APPLICATION_STEP_KEYS)[number];

/** Step keys that have a dedicated step UI component in the issuer app */
export const APPLICATION_STEP_KEYS_WITH_UI: ApplicationStepKey[] = [
  "financing_type",
  "financing_structure",
  "contract_details",
  "invoice_details",
  "company_details",
  "business_details",
  "financial_statements",
  "supporting_documents",
  "declarations",
];

export interface StepKeyDisplay {
  /** Name shown in workflow builder (short form) */
  title: string;
  /** Title shown on application page (descriptive form) */
  pageTitle?: string;
  /** Description shown on application page */
  description?: string;
}

/** Display title and description per step key */
export const STEP_KEY_DISPLAY: Record<ApplicationStepKey, StepKeyDisplay> = {
  financing_type: {
    title: "Financing Type",
    pageTitle: "Choose Your Financing Type",
    description: "Choose the type of financing that best suits your business needs",
  },
  financing_structure: {
    title: "Financing Structure",
    pageTitle: "How would you like to apply for financing?",
  },
  contract_details: {
    title: "Contract Details",
    pageTitle: "Provide Contract and Customer Details",
    description: "Help us understand your contract and your customer billed under this invoice",
  },
  invoice_details: {
    title: "Invoice Details",
    pageTitle: "Upload invoice(s)",
    description: "Provide the invoice(s) to apply for financing",
  },
  company_details: {
    title: "Company Details",
    pageTitle: "Verify company details",
    description: "Make sure all company details are up to date",
  },
  business_details: {
    title: "Business & Guarantor Details",
    pageTitle: "Business & Guarantor Details",
    description: "Tell us about your business and provide at least one guarantor",
  },
  financial_statements: {
    title: "Financial Statements",
    pageTitle: "Financial Statements",
    description: "Enter your company's financial statement data",
  },
  supporting_documents: {
    title: "Supporting Documents",
    pageTitle: "Upload Supporting Documents",
  },
  declarations: {
    title: "Declarations",
    pageTitle: "Declarations",
    description: "Confirm the declarations below, then submit your application",
  },
};

/**
 * Derive step key from step ID (e.g. "company_details_1" -> "company_details").
 * Step IDs from product workflow are like "financing_type_1", "company_details_123".
 */
export function getStepKeyFromStepId(stepId: string): ApplicationStepKey | null {
  if (!stepId || typeof stepId !== "string") return null;
  const key = stepId.replace(/_\d+$/, "");
  return APPLICATION_STEP_KEYS.includes(key as ApplicationStepKey) ? (key as ApplicationStepKey) : null;
}

/** Base step id without trailing `_digits` (e.g. `declarations_2` → `declarations`). */
export function getBaseStepIdFromStepId(stepId: string): string {
  return String(stepId || "").replace(/_\d+$/, "");
}

/**
 * Product / issuer workflow: drop legacy `review_and_submit` rows and pin every `declarations` step to the end.
 */
export function enforceDeclarationsLastAndDropReview<T extends { id?: string }>(workflow: T[]): T[] {
  const filtered = workflow.filter((s) => getBaseStepIdFromStepId(String(s.id ?? "")) !== "review_and_submit");
  const declarations: T[] = [];
  const rest: T[] = [];
  for (const row of filtered) {
    if (getBaseStepIdFromStepId(String(row.id ?? "")) === "declarations") declarations.push(row);
    else rest.push(row);
  }
  const decl = declarations.length ? [declarations[declarations.length - 1]] : [];
  return [...rest, ...decl];
}
