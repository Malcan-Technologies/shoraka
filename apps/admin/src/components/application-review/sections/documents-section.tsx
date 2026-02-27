"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { SectionActionDropdown } from "../section-action-dropdown";
import { DocumentList } from "../document-list";
import type { ReviewSectionId } from "../section-types";

export interface DocumentsSectionProps {
  supportingDocuments: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  viewDocumentPending: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onViewDocument: (s3Key: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
}

export function DocumentsSection({
  supportingDocuments,
  reviewItems,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  sectionStatus,
  onResetSectionToPending,
  viewDocumentPending,
  onApprove,
  onReject,
  onRequestAmendment,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
}: DocumentsSectionProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Supporting Documents</CardTitle>
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
      <CardContent>
        {supportingDocuments && typeof supportingDocuments === "object" ? (
          <DocumentList
            documents={supportingDocuments}
            reviewItems={reviewItems}
            isReviewable={!!isReviewable}
            onViewDocument={onViewDocument}
            onApproveItem={onApproveItem}
            onRejectItem={onRejectItem}
            onRequestAmendmentItem={onRequestAmendmentItem}
            onResetItemToPending={onResetItemToPending}
            isItemActionPending={approvePending}
            isViewDocumentPending={viewDocumentPending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No supporting documents submitted.</p>
        )}
        <div className="mt-6">
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
