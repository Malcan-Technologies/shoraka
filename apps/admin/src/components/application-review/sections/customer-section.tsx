"use client";

import * as React from "react";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import type { ReviewSectionId } from "../section-types";
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
  hideSectionComments = false,
  embedded = false,
  paymaster,
  paymasterId,
  applicationId,
}: CustomerSectionProps) {
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
