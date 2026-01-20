import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
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

function DefaultStepComponent({ stepName }: StepComponentProps) {
  // Check if this is the financing type step (step 1)
  const isFinancingTypeStep = stepName === "Select financing type" || stepName === "Loading...";
  
  if (isFinancingTypeStep) {
    return (
      <div className="space-y-12">
        {[1, 2, 3].map((categoryIndex) => (
          <div key={categoryIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="grid grid-cols-1 gap-4 mt-6">
              {[1, 2].map((cardIndex) => (
                <div
                  key={cardIndex}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card"
                >
                  <Skeleton className="h-14 w-14 rounded-lg aspect-square border border-border" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Skeleton className="h-5 w-32 mb-1" />
                        <Skeleton className="h-4 w-full max-w-md" />
                      </div>
                      <Skeleton className="h-5 w-5 rounded-none" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-12">
      <div>
        <div className="flex justify-between items-center border-b border-border pb-2">
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="text-sm text-muted-foreground">
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
