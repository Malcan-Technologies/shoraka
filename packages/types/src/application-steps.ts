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
  title: string;
  description: string;
}

/** Display title and description per step key */
export const STEP_KEY_DISPLAY: Record<ApplicationStepKey, StepKeyDisplay> = {
  financing_type: {
    title: "Financing Type",
    description: "Choose the type of financing that best suits your business needs",
  },
  financing_structure: {
    title: "Financing Structure",
    description: "Define the structure of your financing",
  },
  contract_details: {
    title: "Contract Details",
    description: "Review and confirm contract terms",
  },
  invoice_details: {
    title: "Invoice Details",
    description: "Provide invoice information",
  },
  company_details: {
    title: "Company Details",
    description: "Review and confirm your company details are accurate",
  },
  business_details: {
    title: "Business Details",
    description: "Tell us about your business",
  },
  supporting_documents: {
    title: "Supporting Documents",
    description: "Upload required documents",
  },
  declarations: {
    title: "Declarations",
    description: "Please read and accept all declarations to continue",
  },
  review_and_submit: {
    title: "Review And Submit",
    description: "Review your application and submit",
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
