"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { SectionActionDropdown } from "../section-action-dropdown";
import { InvoiceList } from "@/components/invoice-review-list";
import type { ReviewSectionId } from "../section-types";
import { SectionComments, type SectionCommentItem } from "../section-comments";

export interface InvoiceSectionProps {
  invoices: { id: string; details?: unknown }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
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
  onViewDocument: (s3Key: string) => void;
  viewDocumentPending: boolean;
  invoiceRatioLimits?: { min: number; max: number };
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
  onResetItemToPending?: (itemId: string) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
}

export function InvoiceSection({
  invoices,
  reviewItems,
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
  onViewDocument,
  viewDocumentPending,
  invoiceRatioLimits,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
  onResetItemToPending,
  comments,
  onAddComment,
}: InvoiceSectionProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Invoice</CardTitle>
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
        {invoices?.length ? (
          <InvoiceList
            invoices={invoices}
            reviewItems={reviewItems}
            isReviewable={!!isReviewable}
            onViewDocument={onViewDocument}
            isViewDocumentPending={viewDocumentPending}
            invoiceRatioLimits={invoiceRatioLimits ?? { min: 60, max: 80 }}
            isActionLocked={isActionLocked}
            actionLockTooltip={actionLockTooltip}
            onApproveItem={onApproveItem}
            onRejectItem={onRejectItem}
            onRequestAmendmentItem={onRequestAmendmentItem}
            onResetItemToPending={onResetItemToPending}
            isItemActionPending={approvePending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No invoices submitted.</p>
        )}
        <div className="mt-6">
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        </div>
      </CardContent>
    </Card>
  );
}
