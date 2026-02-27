"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { SectionActionDropdown } from "../section-action-dropdown";
import { InvoiceList } from "@/components/invoice-review-list";
import type { ReviewSectionId } from "../section-types";

export interface InvoiceSectionProps {
  invoices: { id: string; details?: unknown }[];
  reviewItems: { item_type: string; item_id: string; status: string }[];
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onApproveItem: (itemId: string) => Promise<void>;
  onRejectItem: (itemId: string) => void;
  onRequestAmendmentItem: (itemId: string) => void;
}

export function InvoiceSection({
  invoices,
  reviewItems,
  section,
  isReviewable,
  approvePending,
  isActionLocked,
  actionLockTooltip,
  onApprove,
  onReject,
  onRequestAmendment,
  onApproveItem,
  onRejectItem,
  onRequestAmendmentItem,
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
          />
        </div>
      </CardHeader>
      <CardContent>
        {invoices?.length ? (
          <InvoiceList
            invoices={invoices}
            reviewItems={reviewItems}
            isReviewable={!!isReviewable}
            onApproveItem={onApproveItem}
            onRejectItem={onRejectItem}
            onRequestAmendmentItem={onRequestAmendmentItem}
            isItemActionPending={approvePending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">No invoices submitted.</p>
        )}
        <div className="mt-6">
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
