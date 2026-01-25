"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircleIcon } from "@heroicons/react/24/outline";

interface ReviewAndSubmitStepProps {
  applicationId: string;
  stepConfig?: any;
  onDataChange?: (data: any) => void;
}

export function ReviewAndSubmitStep({
  applicationId,
  stepConfig,
  onDataChange,
}: ReviewAndSubmitStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  if (isLoadingApp || !stepConfig) {
    return (
      <div className="space-y-6 md:space-y-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="border rounded-xl p-6 bg-card">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircleIcon className="h-6 w-6 text-green-600" />
          <h2 className="text-lg md:text-xl font-semibold">Review & Submit</h2>
        </div>
        <p className="text-sm md:text-base leading-6 text-muted-foreground">
          Please review all the information you've provided before submitting your application.
          You can go back to any previous step to make changes if needed.
        </p>
      </div>

      <div className="border rounded-xl p-6 bg-card">
        <h3 className="text-lg md:text-xl font-semibold mb-4">Application Summary</h3>
        <div className="space-y-4 text-sm md:text-base leading-6">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-foreground">Financing type selected</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-foreground">Company information verified</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-foreground">Supporting documents uploaded</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0" />
            <span className="text-foreground">Declarations accepted</span>
          </div>
        </div>
      </div>

      <div className="border rounded-xl p-6 bg-card bg-muted/30">
        <h3 className="text-lg md:text-xl font-semibold mb-4">What happens next?</h3>
        <ul className="pl-4 md:pl-6 text-sm md:text-base leading-6 text-foreground list-disc space-y-2">
          <li>Your application will be reviewed by our credit team</li>
          <li>Documents will be verified for authenticity</li>
          <li>You may be contacted for additional information</li>
          <li>You will receive a decision within 3-5 business days</li>
        </ul>
      </div>
    </div>
  );
}
