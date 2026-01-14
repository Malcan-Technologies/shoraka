"use client";

import { Label } from "@/components/ui/label";

interface ReviewSubmitConfig {
  showSummary?: boolean;
  confirmationMessage?: string;
  allowEdit?: boolean;
  showEstimatedProcessing?: boolean;
}

interface ReviewSubmitConfigProps {
  config: ReviewSubmitConfig;
  onChange: (config: ReviewSubmitConfig) => void;
}

export function ReviewSubmitConfig(_props: ReviewSubmitConfigProps) {
  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5">
        <Label className="text-sm sm:text-base font-semibold">
          Review & Submit
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Final review step before submission
        </p>
      </div>
      <div className="text-center py-6 sm:py-8 text-muted-foreground">
        <p className="text-sm">No configuration needed</p>
        <p className="text-xs mt-1">This is the final review step before submission</p>
      </div>
    </div>
  );
}
