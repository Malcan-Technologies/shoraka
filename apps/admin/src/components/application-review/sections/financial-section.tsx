"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import { ReviewSectionCard } from "../review-section-card";
import type { ReviewSectionId } from "../section-types";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ApplicationFinancialReviewComparison } from "@/components/application-financial-review-comparison";
import { isReadyForFinancialApproval, type ApplicationPersonRow } from "@cashsouk/types";

const DIRECTOR_SHAREHOLDER_PENDING_LABEL = "Director/Shareholder AML Pending";
const DIRECTOR_SHAREHOLDER_PENDING_TOOLTIP =
  "AML screening must be approved for all directors/shareholders before Financial can be approved.";

export type FinancialSectionAppSlice = {
  people?: ApplicationPersonRow[];
  issuer_organization?: {
    id?: string;
    corporate_entities?: unknown;
    latest_organization_ctos_company_json?: unknown | null;
    latest_organization_ctos_financials_json?: unknown | null;
    latest_organization_ctos_report_id?: string | null;
    latest_organization_ctos_fetched_at?: string | null;
    latest_organization_ctos_has_report_html?: boolean | null;
    latest_organization_ctos_subject_reports?: Array<{
      id: string;
      subject_ref: string | null;
      fetched_at: string;
      has_report_html: boolean;
    }> | null;
  } | null;
  financial_statements?: unknown;
};

export interface FinancialSectionProps {
  applicationId: string;
  issuerOrganizationId?: string | null;
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
  issuerOrganizationId,
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
  const hasPendingDirectorShareholder = !isReadyForFinancialApproval(app.people ?? []);

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
      showApprove={true}
      approveDisabled={hasPendingDirectorShareholder}
      approveDisabledReason={
        hasPendingDirectorShareholder ? DIRECTOR_SHAREHOLDER_PENDING_TOOLTIP : undefined
      }
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
    >
      {hasPendingDirectorShareholder ? (
        <div
          className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          title={DIRECTOR_SHAREHOLDER_PENDING_TOOLTIP}
        >
          {DIRECTOR_SHAREHOLDER_PENDING_LABEL}
        </div>
      ) : null}
      <ApplicationFinancialReviewContent
        applicationId={applicationId}
        issuerOrganizationId={issuerOrganizationId ?? app.issuer_organization?.id ?? null}
        app={app}
      />
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
