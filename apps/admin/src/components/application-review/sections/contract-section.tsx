"use client";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DocumentTextIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { formatCurrency } from "@cashsouk/config";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewValueClassTextArea,
  reviewRowGridClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  formatReviewDate,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";

interface FileDoc {
  s3_key?: string;
  file_name?: string;
  file_size?: number;
}

export interface ContractSectionProps {
  contractDetails: unknown;
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
}

export function ContractSection({
  contractDetails,
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
}: ContractSectionProps) {
  const cd = contractDetails as Record<string, unknown> | null | undefined;
  const cust = customerDetails as Record<string, unknown> | null | undefined;

  const contractDoc = cd?.document as FileDoc | undefined;
  const customerDoc = cust?.document as FileDoc | undefined;

  const hasData = cd || cust;

  return (
    <ReviewSectionCard
      title="Contract Details"
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
    >
      {hasData ? (
        <>
          {cd && (
            <ReviewFieldBlock title="Contract details">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Contract title</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.title)}</div>
                <Label className={reviewLabelClass}>Contract description</Label>
                <div className={reviewValueClassTextArea}>{formatReviewValue(cd.description)}</div>
                <Label className={reviewLabelClass}>Contract number</Label>
                <div className={reviewValueClass}>{formatReviewValue(cd.number)}</div>
                <Label className={reviewLabelClass}>Contract value</Label>
                <div className={reviewValueClass}>
                  {typeof cd.value === "number"
                    ? formatCurrency(cd.value)
                    : formatReviewValue(cd.value)}
                </div>
                <Label className={reviewLabelClass}>Contract financing</Label>
                <div className={reviewValueClass}>
                  {typeof cd.financing === "number"
                    ? formatCurrency(cd.financing)
                    : formatReviewValue(cd.financing)}
                </div>
                <Label className={reviewLabelClass}>Contract start date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.start_date as string)}</div>
                <Label className={reviewLabelClass}>Contract end date</Label>
                <div className={reviewValueClass}>{formatReviewDate(cd.end_date as string)}</div>
                {typeof cd.approved_facility === "number" && cd.approved_facility > 0 && (
                  <>
                    <Label className={reviewLabelClass}>Approved facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(cd.approved_facility as number)}
                    </div>
                    <Label className={reviewLabelClass}>Utilized facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(
                        typeof cd.utilized_facility === "number" ? cd.utilized_facility : 0
                      )}
                    </div>
                    <Label className={reviewLabelClass}>Available facility</Label>
                    <div className={reviewValueClass}>
                      {formatCurrency(
                        typeof cd.available_facility === "number" ? cd.available_facility : 0
                      )}
                    </div>
                  </>
                )}
              </div>
            </ReviewFieldBlock>
          )}

          {cust && (
            <ReviewFieldBlock title="Customer details">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Customer name</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.name)}</div>
                <Label className={reviewLabelClass}>Customer entity type</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.entity_type)}</div>
                <Label className={reviewLabelClass}>Customer SSM number</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.ssm_number)}</div>
                <Label className={reviewLabelClass}>Customer country</Label>
                <div className={reviewValueClass}>{formatReviewValue(cust.country)}</div>
                <Label className={reviewLabelClass}>Is customer related to issuer?</Label>
                <div className={reviewValueClass}>
                  {cust.is_related_party === true
                    ? "Yes"
                    : cust.is_related_party === false
                      ? "No"
                      : REVIEW_EMPTY_LABEL}
                </div>
              </div>
            </ReviewFieldBlock>
          )}

          <ReviewFieldBlock title="Evidence">
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Contract document</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {contractDoc?.file_name
                        ? `${contractDoc.file_name}${
                            contractDoc.file_size
                              ? ` (${(contractDoc.file_size / 1024 / 1024).toFixed(2)} MB)`
                              : ""
                          }`
                        : REVIEW_EMPTY_LABEL}
                    </div>
                  </div>
                </div>
                {contractDoc?.s3_key && onViewDocument && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg h-9 gap-1 shrink-0"
                    onClick={() => onViewDocument(contractDoc.s3_key!)}
                    disabled={viewDocumentPending}
                  >
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                    View
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <DocumentTextIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground">Customer consent</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {customerDoc?.file_name
                        ? `${customerDoc.file_name}${
                            customerDoc.file_size
                              ? ` (${(customerDoc.file_size / 1024 / 1024).toFixed(2)} MB)`
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
        <p className="text-sm text-muted-foreground">No contract details submitted.</p>
      )}
      <SectionComments comments={comments} onSubmitComment={onAddComment} />
    </ReviewSectionCard>
  );
}
