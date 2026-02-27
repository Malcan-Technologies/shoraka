"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import { SectionActionDropdown } from "../section-action-dropdown";
import type { ReviewSectionId } from "../section-types";

export interface FinancialSectionProps {
  app: {
    issuer_organization?: {
      corporate_entities?: unknown;
      director_kyc_status?: unknown;
      director_aml_status?: unknown;
    } | null;
  };
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
}

export function FinancialSection({
  app,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  onResetSectionToPending,
  onApprove,
  onReject,
  onRequestAmendment,
}: FinancialSectionProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Financial</CardTitle>
          </div>
          <SectionActionDropdown
            section={section}
            isReviewable={isReviewable}
            onApprove={onApprove}
            onReject={onReject}
            onRequestAmendment={onRequestAmendment}
            isPending={approvePending}
            isActionLocked={isActionLocked}
            actionLockTooltip={actionLockTooltip}
            sectionStatus={sectionStatus}
            onResetToPending={onResetSectionToPending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ApplicationFinancialReviewContent app={app} />
        <div>
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
