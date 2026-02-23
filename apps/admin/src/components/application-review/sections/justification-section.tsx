"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { SectionActionDropdown } from "../section-action-dropdown";
import type { ReviewSectionId } from "../section-types";

export interface JustificationSectionProps {
  businessDetails: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
}

export function JustificationSection({
  businessDetails,
  section,
  isReviewable,
  approvePending,
  onApprove,
  onReject,
  onRequestAmendment,
}: JustificationSectionProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Justification</CardTitle>
          </div>
          <SectionActionDropdown
            section={section}
            isReviewable={isReviewable}
            onApprove={onApprove}
            onReject={onReject}
            onRequestAmendment={onRequestAmendment}
            isPending={approvePending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {businessDetails && typeof businessDetails === "object" ? (
          <div>
            <h4 className="text-sm font-semibold mb-2">About your business & funding</h4>
            <pre className="text-sm bg-muted/50 rounded-xl p-4 overflow-auto max-h-64">
              {JSON.stringify(businessDetails, null, 2)}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No justification details submitted.</p>
        )}
        <div>
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
