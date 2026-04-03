"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { reviewCardTitleClass, reviewEmptyStateClass } from "../review-section-styles";
import { DocumentList } from "../document-list";
import { SectionComments, type SectionCommentItem } from "../section-comments";

export interface DocumentsSectionProps {
  supportingDocuments: unknown;
  reviewItems: { item_type: string; item_id: string; status: string }[];
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  viewDocumentPending: boolean;
  onViewDocument: (s3Key: string) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
}

export function DocumentsSection({
  supportingDocuments,
  reviewItems,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  viewDocumentPending,
  onViewDocument,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  comments,
  onAddComment,
}: DocumentsSectionProps) {
  const peerDocumentRejected = reviewItems.some(
    (r) => r.item_type === "document" && r.status === "REJECTED"
  );

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-primary" />
          <CardTitle className={reviewCardTitleClass}>Supporting Documents</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-10">
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
            isActionLocked={isActionLocked}
            actionLockTooltip={actionLockTooltip}
            lockItemPrimaryReviewActions={peerDocumentRejected}
          />
        ) : (
          <p className={reviewEmptyStateClass}>No supporting documents submitted.</p>
        )}
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      </CardContent>
    </Card>
  );
}
