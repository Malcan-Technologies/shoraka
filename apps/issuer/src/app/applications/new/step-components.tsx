import * as React from "react";

/**
 * Props that every step component receives
 * Think of this as a "contract" - every step component must accept these props
 */
export interface StepComponentProps {
  stepId: string;                    // The step ID like "financing-type-1"
  stepName: string;                  // The step name like "Financing Type"
  stepConfig: Record<string, unknown> | undefined;  // Step configuration data
  applicationId: string | null;      // The application ID (null if not created yet)
  selectedProductId: string | null;  // Which product/financing type is selected
  onDataChange?: (data: Record<string, unknown>) => void;  // Callback to send data to parent
}

// ============================================================================
// STEP 1: Import the step components
// ============================================================================
// When you create a new step file, import it here
import FinancingType1 from "./steps/financing-type-1";
import VerifyCompanyInfo1 from "./steps/verify-company-info-1";
import SupportingDocuments1 from "./steps/supporting-documents-1";
import Declaration1 from "./steps/declaration-1";
// Example for future steps:
// import FinancingTerms2 from "./steps/financing-terms-2";

// ============================================================================
// STEP 2: Create a lookup table (like a phone book)
// ============================================================================
// This is like a phone book: step ID → Component
// Example: "financing-type-1" → FinancingType1 component
//
// TypeScript explanation:
// - Record<string, ...> = "An object with string keys"
// - React.ComponentType<StepComponentProps> = "A React component that accepts StepComponentProps"
// - Together = "An object where each value is a component that accepts StepComponentProps"
const STEP_COMPONENTS: Record<string, React.ComponentType<StepComponentProps>> = {
  // Hyphen format (preferred)
  "financing-type-1": FinancingType1,
  "verify-company-info-1": VerifyCompanyInfo1,
  "company-info-1": VerifyCompanyInfo1,
  "supporting-documents-1": SupportingDocuments1,
  "declaration-1": Declaration1,
  
  // Underscore format (legacy - for old data)
  "financing_type_1": FinancingType1,
  "verify_company_info_1": VerifyCompanyInfo1,
  "company_info_1": VerifyCompanyInfo1,
  "supporting_documents_1": SupportingDocuments1,
  "declaration_1": Declaration1,
  
  // Add more steps here as you create them:
  // "financing-terms-2": FinancingTerms2,
  // "financing_terms_2": FinancingTerms2,
};

// ============================================================================
// STEP 3: Helper function to convert underscores to hyphens
// ============================================================================
// This makes "financing_type_1" become "financing-type-1"
function convertUnderscoresToHyphens(stepId: string): string {
  return stepId.replace(/_/g, "-");
}

// ============================================================================
// STEP 3.5: Helper function to extract base step name from dynamic IDs
// ============================================================================
// This handles step IDs with timestamp suffixes like "declaration_1768755454350"
// It extracts the base name by removing the timestamp suffix
function extractBaseStepName(stepId: string): string {
  // Remove timestamp suffix (underscore followed by numbers at the end)
  // Example: "declaration_1768755454350" → "declaration"
  // Example: "supporting-documents-1_1234567890" → "supporting-documents-1"
  const withoutTimestamp = stepId.replace(/_\d+$/, "");
  
  // Also handle cases like "declaration-1_1234567890" → "declaration-1"
  return withoutTimestamp;
}

// ============================================================================
// STEP 4: Main function - Find the component for a step ID
// ============================================================================
/**
 * This function is like looking up a name in a phone book
 * 
 * Example:
 *   getStepComponent("financing-type-1")
 *   → Looks in STEP_COMPONENTS
 *   → Finds: FinancingType1
 *   → Returns: FinancingType1 component
 * 
 * It also handles dynamic step IDs with timestamps:
 *   getStepComponent("declaration_1768755454350")
 *   → Extracts base: "declaration"
 *   → Tries to match: "declaration-1" or "declaration_1"
 *   → Finds: Declaration1
 *   → Returns: Declaration1 component
 */
/**
 * Returns a React component that accepts StepComponentProps
 * 
 * TypeScript explanation:
 * - Returns: React.ComponentType<StepComponentProps>
 * - Which means: "A React component function that accepts StepComponentProps as props"
 */
export function getStepComponent(stepId: string): React.ComponentType<StepComponentProps> {
  // Try 1: Look for exact match (like "financing-type-1")
  if (stepId in STEP_COMPONENTS) {
    return STEP_COMPONENTS[stepId];
  }
  
  // Try 2: Convert underscores to hyphens and try again (like "financing_type_1" → "financing-type-1")
  const convertedId = convertUnderscoresToHyphens(stepId);
  if (convertedId in STEP_COMPONENTS) {
    return STEP_COMPONENTS[convertedId];
  }
  
  // Try 3: Extract base step name (remove timestamp suffix) and try to match
  // Example: "declaration_1768755454350" → "declaration"
  const baseName = extractBaseStepName(stepId);
  
  // Try matching base name with common suffixes
  // First try exact base name match (in case it's registered as just "declaration")
  if (baseName in STEP_COMPONENTS) {
    return STEP_COMPONENTS[baseName];
  }
  
  // Then try with "-1" suffix (hyphen format)
  // Example: "declaration" → "declaration-1"
  const hyphenVariant = `${baseName}-1`;
  if (hyphenVariant in STEP_COMPONENTS) {
    return STEP_COMPONENTS[hyphenVariant];
  }
  
  // Then try with "_1" suffix (underscore format)
  // Example: "declaration" → "declaration_1"
  const underscoreVariant = `${baseName}_1`;
  if (underscoreVariant in STEP_COMPONENTS) {
    return STEP_COMPONENTS[underscoreVariant];
  }
  
  // Try converting base name underscores to hyphens and add "-1"
  // Example: "supporting_documents" → "supporting-documents-1"
  const baseNameHyphen = convertUnderscoresToHyphens(baseName);
  if (baseNameHyphen !== baseName) {
    const hyphenVariant2 = `${baseNameHyphen}-1`;
    if (hyphenVariant2 in STEP_COMPONENTS) {
      return STEP_COMPONENTS[hyphenVariant2];
    }
  }
  
  // Try 4: If not found, return a placeholder component that shows an error message
  return DefaultStepComponent;
}

/**
 * Default placeholder component for unknown step types
 */
function DefaultStepComponent({ stepId, stepName }: StepComponentProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        {stepName} step - Component not found
      </p>
      <p className="text-sm text-muted-foreground">
        Step ID: {stepId}
      </p>
      <p className="text-sm text-muted-foreground">
        Create file: <code className="text-xs">apps/issuer/src/app/applications/new/steps/{stepId}.tsx</code>
      </p>
    </div>
  );
}
