import * as React from "react";
import FinancingType1 from "./steps/financing-type-1";
import VerifyCompanyInfo1 from "./steps/verify-company-info-1";
import SupportingDocuments1 from "./steps/supporting-documents-1";
import Declaration1 from "./steps/declaration-1";

export interface StepComponentProps {
  stepId: string;
  stepName: string;
  stepConfig: Record<string, unknown> | undefined;
  applicationId: string | null;
  selectedProductId: string | null;
  onDataChange?: (data: Record<string, unknown>) => void;
}

const STEP_COMPONENTS: Record<string, React.ComponentType<StepComponentProps>> = {
  "financing-type-1": FinancingType1,
  "verify-company-info-1": VerifyCompanyInfo1,
  "company-info-1": VerifyCompanyInfo1,
  "supporting-documents-1": SupportingDocuments1,
  "declaration-1": Declaration1,
  "financing_type_1": FinancingType1,
  "verify_company_info_1": VerifyCompanyInfo1,
  "company_info_1": VerifyCompanyInfo1,
  "supporting_documents_1": SupportingDocuments1,
  "declaration_1": Declaration1,
};

function convertUnderscoresToHyphens(stepId: string): string {
  return stepId.replace(/_/g, "-");
}

function extractBaseStepName(stepId: string): string {
  const withoutTimestamp = stepId.replace(/_\d+$/, "");
  return withoutTimestamp;
}

export function getStepComponent(stepId: string): React.ComponentType<StepComponentProps> {
  if (stepId in STEP_COMPONENTS) {
    return STEP_COMPONENTS[stepId];
  }
  
  const convertedId = convertUnderscoresToHyphens(stepId);
  if (convertedId in STEP_COMPONENTS) {
    return STEP_COMPONENTS[convertedId];
  }
  
  const baseName = extractBaseStepName(stepId);
  
  if (baseName in STEP_COMPONENTS) {
    return STEP_COMPONENTS[baseName];
  }
  
  const hyphenVariant = `${baseName}-1`;
  if (hyphenVariant in STEP_COMPONENTS) {
    return STEP_COMPONENTS[hyphenVariant];
  }
  
  const underscoreVariant = `${baseName}_1`;
  if (underscoreVariant in STEP_COMPONENTS) {
    return STEP_COMPONENTS[underscoreVariant];
  }
  
  const baseNameHyphen = convertUnderscoresToHyphens(baseName);
  if (baseNameHyphen !== baseName) {
    const hyphenVariant2 = `${baseNameHyphen}-1`;
    if (hyphenVariant2 in STEP_COMPONENTS) {
      return STEP_COMPONENTS[hyphenVariant2];
    }
  }
  
  return DefaultStepComponent;
}

function DefaultStepComponent({ stepId, stepName }: StepComponentProps) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{stepName}</h3>
        <p className="text-muted-foreground">
          This step component has not been implemented yet.
        </p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Step ID: <code className="text-xs bg-muted px-2 py-1 rounded">{stepId}</code></p>
        <p>You can continue to the next step using the navigation buttons below.</p>
      </div>
    </div>
  );
}
