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


export function getStepComponent(stepId: string) {
  return STEP_COMPONENTS[stepId] || DefaultStepComponent;
}

export function getStepSkeleton(stepId: string): React.ReactElement | null {
  if (stepId === "financing_type_1" || stepId === "") {
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

  if (stepId === "verify_company_info_1" || stepId === "company_info_1") {
    return (
      <div className="space-y-12">
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <React.Fragment key={i}>
                <div className="text-sm text-muted-foreground">
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-11 w-full rounded-xl" />
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "supporting_documents_1") {
    return (
      <div className="space-y-12">
        {[1, 2].map((categoryIndex) => (
          <div key={categoryIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <Skeleton className="h-5 w-40" />
            </div>
            <ul className="space-y-2 mt-6">
              {[1, 2, 3].map((docIndex) => (
                <li key={docIndex} className="flex justify-between text-sm">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-24" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }

  if (stepId === "declaration_1") {
    return (
      <div className="space-y-12">
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="border border-border rounded-xl p-6 space-y-4 mt-6">
            <Skeleton className="h-6 w-64" />
            <div className="space-y-2 pl-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "buyer_details_1") {
    return (
      <div className="space-y-12">
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-6 mt-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <React.Fragment key={i}>
                <div>
                  <Skeleton className="h-4 w-32 mb-1" />
                  <Skeleton className="h-11 w-full rounded-xl" />
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "invoice_details_1") {
    return (
      <div className="space-y-12">
        <div>
          <div className="flex justify-between items-center border-b border-border pb-2">
            <Skeleton className="h-5 w-40" />
          </div>
          <div className="bg-white border border-border rounded-xl overflow-hidden mt-6">
            <div className="p-4 border-b border-border">
              <Skeleton className="h-6 w-32" />
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    {[1, 2, 3, 4, 5, 6, 7].map((j) => (
                      <Skeleton key={j} className="h-10 flex-1" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (stepId === "review_submit_1") {
    return (
      <div className="space-y-12">
        {[1, 2, 3, 4, 5].map((sectionIndex) => (
          <div key={sectionIndex}>
            <div className="flex justify-between items-center border-b border-border pb-2">
              <Skeleton className="h-5 w-40" />
            </div>
            <div className="grid grid-cols-2 gap-6 mt-6">
              {[1, 2, 3, 4].map((i) => (
                <React.Fragment key={i}>
                  <div className="text-sm text-muted-foreground">
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-4 w-48" />
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

function DefaultStepComponent({ stepId, stepName }: StepComponentProps) {
  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-2">{stepName || "Step"}</h3>
        <p className="text-muted-foreground">
          This step component has not been created yet.
        </p>
      </div>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Step ID: <code className="text-xs bg-muted px-2 py-1 rounded">{stepId || "unknown"}</code></p>
        <p>You can continue to the next step using the navigation buttons below.</p>
      </div>
    </div>
  );
}
