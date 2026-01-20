import * as React from "react";
import FinancingType1 from "./steps/financing-type-1";
import VerifyCompanyInfo1 from "./steps/verify-company-info-1";
import SupportingDocuments1 from "./steps/supporting-documents-1";
import Declaration1 from "./steps/declaration-1";
import BuyerDetails1 from "./steps/buyer-details-1";
import InvoiceDetails1 from "./steps/invoice-details-1";
import ReviewSubmit1 from "./steps/review-submit-1";

export interface StepComponentProps {
  stepId: string;
  stepName: string;
  stepConfig: Record<string, unknown> | undefined;
  applicationId: string | null;
  selectedProductId: string | null;
  onDataChange?: (data: Record<string, unknown>) => void;
}

const STEP_COMPONENTS: Record<string, React.ComponentType<StepComponentProps>> = {
  "financing_type_1": FinancingType1,
  "invoice_details_1": InvoiceDetails1,
  "buyer_details_1": BuyerDetails1,
  "verify_company_info_1": VerifyCompanyInfo1,
  "company_info_1": VerifyCompanyInfo1,
  "supporting_documents_1": SupportingDocuments1,
  "declaration_1": Declaration1,
  "review_submit_1": ReviewSubmit1,
};


export function getStepComponent(stepId: string): React.ComponentType<StepComponentProps> {
  if (stepId in STEP_COMPONENTS) {
    return STEP_COMPONENTS[stepId];
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
