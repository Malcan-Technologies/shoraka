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
  "supporting_documents",
  "declarations",
  "review_and_submit",
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
  "supporting_documents",
  "declarations",
  "review_and_submit",
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
    title: "Business Details",
    pageTitle: "Business Details",
    description: "Tell us about your business",
  },
  supporting_documents: {
    title: "Supporting Documents",
    pageTitle: "Upload Supporting Documents",
  },
  declarations: {
    title: "Declarations",
    pageTitle: "Declarations",
  },
  review_and_submit: {
    title: "Review & Submit",
    pageTitle: "Review & Submit",
    description: "Ensure that all information provided are accurate and up to date",
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
