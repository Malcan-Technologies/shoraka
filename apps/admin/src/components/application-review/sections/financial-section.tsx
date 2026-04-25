"use client";

import { BanknotesIcon } from "@heroicons/react/24/outline";
import { ApplicationFinancialReviewContent } from "@/components/application-financial-review-content";
import { ReviewSectionCard } from "../review-section-card";
import type { ReviewSectionId } from "../section-types";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { ApplicationFinancialReviewComparison } from "@/components/application-financial-review-comparison";
import {
  getDirectorShareholderDisplayRows,
  isCtosIndividualKycEligibleRow,
  normalizeDirectorShareholderIdKey,
} from "@cashsouk/types";

export type FinancialSectionAppSlice = {
  issuer_organization?: {
    id?: string;
    corporate_entities?: unknown;
    director_kyc_status?: unknown;
    director_aml_status?: unknown;
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
    ctos_party_supplements?: { party_key: string; onboarding_json?: unknown }[] | null;
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
  const kycNotReadyReason = "KYC not completed for all required directors/shareholders";
  const kycNotReadyTooltip = "Cannot approve until all required KYC is approved";
  const financialApproveAllowed = (() => {
    const issuerOrg = app.issuer_organization;
    if (!issuerOrg) return true;
    const supplements = Array.isArray(issuerOrg.ctos_party_supplements)
      ? issuerOrg.ctos_party_supplements
      : [];
    const onboardingByPartyKey = new Map<string, Record<string, unknown>>();
    for (const supplement of supplements) {
      const key = normalizeDirectorShareholderIdKey(supplement.party_key);
      if (!key) continue;
      const onboarding =
        supplement.onboarding_json &&
        typeof supplement.onboarding_json === "object" &&
        !Array.isArray(supplement.onboarding_json)
          ? (supplement.onboarding_json as Record<string, unknown>)
          : {};
      onboardingByPartyKey.set(key, onboarding);
    }
    const rows = getDirectorShareholderDisplayRows({
      corporateEntities: issuerOrg.corporate_entities,
      directorKycStatus: issuerOrg.director_kyc_status,
      organizationCtosCompanyJson: issuerOrg.latest_organization_ctos_company_json ?? null,
      ctosPartySupplements: supplements.map((supplement) => ({
        partyKey: supplement.party_key,
        onboardingJson: supplement.onboarding_json ?? null,
      })),
      sentRowIds: null,
    });
    for (const row of rows) {
      if (!isCtosIndividualKycEligibleRow(row)) continue;
      const partyKey = normalizeDirectorShareholderIdKey(
        row.idNumber?.trim() || row.registrationNumber?.trim() || row.enquiryId?.trim() || ""
      );
      if (!partyKey) continue;
      const onboarding = onboardingByPartyKey.get(partyKey) ?? {};
      const requestId = String(onboarding.requestId ?? "").trim();
      const regtankStatus = String(onboarding.regtankStatus ?? "").trim().toUpperCase();
      const kycRawStatus =
        onboarding.kyc && typeof onboarding.kyc === "object" && !Array.isArray(onboarding.kyc)
          ? String((onboarding.kyc as Record<string, unknown>).rawStatus ?? "").trim().toUpperCase()
          : "";
      if (!requestId) return false;
      if (regtankStatus !== "APPROVED" && kycRawStatus !== "APPROVED") return false;
    }
    return true;
  })();

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
      approveDisabled={!financialApproveAllowed}
      approveDisabledReason={!financialApproveAllowed ? "KYC not ready" : undefined}
      onResetToPending={onResetSectionToPending}
      onApprove={onApprove}
      onReject={onReject}
      onRequestAmendment={onRequestAmendment}
    >
      {!financialApproveAllowed ? (
        <div
          className="rounded-xl border border-amber-300/60 bg-amber-50/70 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
          title={kycNotReadyTooltip}
        >
          {kycNotReadyReason}
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
