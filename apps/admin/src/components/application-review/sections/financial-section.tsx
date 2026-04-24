"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import { ReviewSectionCard } from "../review-section-card";
import type { ReviewSectionId } from "../section-types";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ApplicationFinancialReviewComparison } from "@/components/application-financial-review-comparison";

export type FinancialSectionAppSlice = {
  issuer_organization?: {
    corporate_entities?: unknown;
    director_kyc_status?: unknown;
    director_aml_status?: unknown;
    latest_organization_ctos_company_json?: unknown | null;
    ctos_party_supplements?: { party_key: string; email: string }[] | null;
  } | null;
  financial_statements?: unknown;
};

export interface FinancialSectionProps {
  applicationId: string;
  app: FinancialSectionAppSlice;
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
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeApp: FinancialSectionAppSlice;
    afterApp: FinancialSectionAppSlice;
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
}

export function FinancialSection({
  applicationId,
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
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
}: FinancialSectionProps) {
  if (sectionComparison) {
    return (
      <ReviewSectionCard title="Financial" icon={BanknotesIcon} section={section} isReviewable={false}>
        <ApplicationFinancialReviewComparison
          beforeApp={sectionComparison.beforeApp}
          afterApp={sectionComparison.afterApp}
          isPathChanged={sectionComparison.isPathChanged}
        />
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  return (
    <ReviewSectionCard
      title="Financial"
      icon={BanknotesIcon}
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
      <ApplicationFinancialReviewContent applicationId={applicationId} app={app} />
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
