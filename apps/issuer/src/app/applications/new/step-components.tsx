import * as React from "react";

export interface StepComponentProps {
  stepId: string;
  stepName: string;
  stepConfig: Record<string, unknown> | undefined;
  applicationId: string | null;
  selectedProductId: string | null;
  onDataChange?: (data: Record<string, unknown>) => void;
}

/**
 * Step component mapping
 * 
 * Simple rule: Step ID = File name
 * - Step ID: "financing-type-1" → File: "./steps/financing-type-1"
 * - Step ID: "financing-terms-2" → File: "./steps/financing-terms-2"
 * 
 * To add a new step:
 * 1. Create file: steps/{step-id}.tsx (e.g., steps/financing-terms-2.tsx)
 * 2. Export default component
 * 3. Import here and add to STEP_COMPONENTS map
 */

// Import step components - file name must match step ID
import FinancingType1 from "./steps/financing-type-1";
// Add more imports as you create step files:
// import FinancingTerms2 from "./steps/financing-terms-2";
// import InvoiceDetails3 from "./steps/invoice-details-3";

/**
 * Map of step ID → Component
 * Step ID must match the file name (without .tsx extension)
 */
const STEP_COMPONENTS: Record<string, React.ComponentType<StepComponentProps>> = {
  "financing-type-1": FinancingType1,
  // Add more mappings here (step ID = file name):
  // "financing-terms-2": FinancingTerms2,
  // "invoice-details-3": InvoiceDetails3,
};

/**
 * Get the component for a step ID
 * Automatically maps step ID to component (step ID = file name)
 */
export function getStepComponent(stepId: string): React.ComponentType<StepComponentProps> {
  return STEP_COMPONENTS[stepId] || DefaultStepComponent;
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
