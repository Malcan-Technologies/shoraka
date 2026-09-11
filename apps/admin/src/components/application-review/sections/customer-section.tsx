"use client";

import * as React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { formatReviewValue } from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import { ComparisonFieldRow, ComparisonYesNoRadioRow, unknownToTriBool } from "../comparison-field-row";
import { CustomerReviewFields } from "./customer-review-fields";
import type { ApplicationReviewPaymaster } from "@/paymasters/components/paymaster-verification-panel";

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
  /** Kept for call-site compatibility; Customer Consent evidence is no longer shown. */
  onViewDocument?: (s3Key: string) => void;
  onDownloadDocument?: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeCustomer: unknown;
    afterCustomer: unknown;
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
  /** Skip Customer card chrome when nested in a stage card. */
  embedded?: boolean;
  paymaster?: ApplicationReviewPaymaster | null;
  paymasterId?: string | null;
  applicationId?: string;
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
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
  embedded = false,
  paymaster,
  paymasterId,
  applicationId,
}: CustomerSectionProps) {
  if (sectionComparison) {
    const { beforeCustomer, afterCustomer, isPathChanged } = sectionComparison;
    const b = beforeCustomer as Record<string, unknown> | null | undefined;
    const a = afterCustomer as Record<string, unknown> | null | undefined;
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
            <ComparisonYesNoRadioRow
              label="Is Customer Related to Issuer?"
              beforeValue={unknownToTriBool(b?.is_related_party)}
              afterValue={unknownToTriBool(a?.is_related_party)}
              changed={isPathChanged("contract")}
            />
          </div>
        </ReviewFieldBlock>
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

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
      embedded={embedded}
    >
      <CustomerReviewFields
        customerDetails={customerDetails}
        section={section}
        isReviewable={isReviewable}
        isActionLocked={isActionLocked}
        onRequestAmendment={onRequestAmendment}
        paymaster={paymaster}
        paymasterId={paymasterId}
        applicationId={applicationId}
      />
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
