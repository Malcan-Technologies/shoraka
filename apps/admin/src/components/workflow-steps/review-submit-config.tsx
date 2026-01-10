"use client";

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
    <div className="space-y-4 pt-4">
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No configuration needed</p>
        <p className="text-xs mt-1">This is the final review step before submission</p>
      </div>
    </div>
  );
}
