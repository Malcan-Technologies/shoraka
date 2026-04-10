"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  formatFileSize,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import { ComparisonFieldRow } from "../comparison-field-row";

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

export interface CustomerSectionProps {
  customerDetails?: unknown;
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
  onViewDocument?: (s3Key: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeCustomer: unknown;
    afterCustomer: unknown;
    isPathChanged: (path: string) => boolean;
  };
}

export function CustomerSection({
  customerDetails,
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
  comments,
  onAddComment,
  sectionComparison,
}: CustomerSectionProps) {
  if (sectionComparison) {
    console.log("CustomerSection comparison mode");
    const { beforeCustomer, afterCustomer, isPathChanged } = sectionComparison;
    const b = beforeCustomer as Record<string, unknown> | null | undefined;
    const a = afterCustomer as Record<string, unknown> | null | undefined;
    const yn = (v: unknown) =>
      v === true ? "Yes" : v === false ? "No" : REVIEW_EMPTY_LABEL;
    const bDoc = b?.document as FileDoc | undefined;
    const aDoc = a?.document as FileDoc | undefined;
    return (
      <ReviewSectionCard title="Customer" icon={DocumentTextIcon} section={section} isReviewable={false}>
        <ReviewFieldBlock title="Customer Details">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Customer Name"
              before={formatReviewValue(b?.name)}
              after={formatReviewValue(a?.name)}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Customer Entity Type"
              before={formatReviewValue(b?.entity_type)}
              after={formatReviewValue(a?.entity_type)}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Customer SSM Number"
              before={formatReviewValue(b?.ssm_number)}
              after={formatReviewValue(a?.ssm_number)}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Customer Country"
              before={formatReviewValue(b?.country)}
              after={formatReviewValue(a?.country)}
              changed={isPathChanged("contract")}
            />
            <ComparisonFieldRow
              label="Is Customer Related to Issuer?"
              before={yn(b?.is_related_party)}
              after={yn(a?.is_related_party)}
              changed={isPathChanged("contract")}
            />
          </div>
        </ReviewFieldBlock>
        <ReviewFieldBlock title="Evidence">
          <ComparisonFieldRow
            label="Customer Consent"
            before={
              bDoc?.file_name
                ? `${bDoc.file_name}${bDoc.file_size ? ` (${formatFileSize(bDoc.file_size)})` : ""}`
                : REVIEW_EMPTY_LABEL
            }
            after={
              aDoc?.file_name
                ? `${aDoc.file_name}${aDoc.file_size ? ` (${formatFileSize(aDoc.file_size)})` : ""}`
                : REVIEW_EMPTY_LABEL
            }
            changed={isPathChanged("contract")}
          />
        </ReviewFieldBlock>
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      </ReviewSectionCard>
    );
  }

  const cust = customerDetails as Record<string, unknown> | null | undefined;
  const customerDoc = cust?.document as FileDoc | undefined;
  const hasData = !!cust;

  return (
    <ReviewSectionCard
      title="Customer"
      icon={DocumentTextIcon}
      section={section}
      isReviewable={isReviewable}
      approvePending={approvePending}
      isActionLocked={isActionLocked}
      actionLockTooltip={actionLockTooltip}
      sectionStatus={sectionStatus}
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
      showApprove={true}
    >
      {hasData ? (
        <>
          <ReviewFieldBlock title="Customer Details">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>Customer Name</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.name)}</div>
              <Label className={reviewLabelClass}>Customer Entity Type</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.entity_type)}</div>
              <Label className={reviewLabelClass}>Customer SSM Number</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.ssm_number)}</div>
              <Label className={reviewLabelClass}>Customer Country</Label>
              <div className={reviewValueClass}>{formatReviewValue(cust.country)}</div>
              <Label className={reviewLabelClass}>Is Customer Related to Issuer?</Label>
              <div className={reviewValueClass}>
                {cust.is_related_party === true
                  ? "Yes"
                  : cust.is_related_party === false
                    ? "No"
                    : REVIEW_EMPTY_LABEL}
              </div>
            </div>
          </ReviewFieldBlock>

          <ReviewFieldBlock title="Evidence">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Customer Consent</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {customerDoc?.file_name
                        ? `${customerDoc.file_name}${
                            customerDoc.file_size
                              ? ` (${formatFileSize(customerDoc.file_size)})`
                              : ""
                          }`
                        : REVIEW_EMPTY_LABEL}
                    </div>
                  </div>
                </div>
                {customerDoc?.s3_key && onViewDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 gap-1 shrink-0"
                    onClick={() => onViewDocument(customerDoc.s3_key!)}
                    disabled={viewDocumentPending}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
            </div>
          </ReviewFieldBlock>
        </>
      ) : (
        <p className={reviewEmptyStateClass}>No customer details submitted.</p>
      )}
      <SectionComments comments={comments} onSubmitComment={onAddComment} />
    </ReviewSectionCard>
  );
}
