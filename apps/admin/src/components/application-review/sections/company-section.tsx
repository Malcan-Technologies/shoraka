"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Skeleton, YesNoRadioDisplay } from "@cashsouk/ui";
import { parseAboutYourBusiness } from "@cashsouk/types";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewValue } from "../review-value";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
  comparisonRowListClass,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import { ComparisonProjectedRow } from "../comparison-document-pair";
import {
  COMPANY_BANK_ACCOUNT_NUMBER_HINT,
  formatCompanyAddress as formatAddress,
  getCompanyBankField as getBankField,
  projectCompanyComparison,
} from "@/lib/resubmit-comparison/company-projection";

export interface CompanySectionProps {
  app: {
    id?: string;
    company_details?: unknown;
    issuer_organization_id?: string;
    issuer_organization?: {
      id?: string;
      name?: string | null;
    } | null;
  };
  section?: ReviewSectionId;
  isReviewable?: boolean;
  approvePending?: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove?: (section: ReviewSectionId) => void;
  onReject?: (section: ReviewSectionId) => void;
  onRequestAmendment?: (section: ReviewSectionId) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  sectionComparison?: {
    beforeApp: CompanySectionProps["app"];
    afterApp: CompanySectionProps["app"];
  };
  hideSectionComments?: boolean;
}

export function CompanySection({
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
}: CompanySectionProps) {
  const organizationId =
    app.issuer_organization_id ?? (app.issuer_organization as { id?: string } | null)?.id ?? null;

  const { data: org, isLoading: isLoadingOrg } = useOrganizationDetail(
    organizationId ? "issuer" : null,
    organizationId
  );

  const comparisonBeforeApp = sectionComparison?.beforeApp;
  const comparisonAfterApp = sectionComparison?.afterApp;
  const comparisonBlocks = React.useMemo(
    () =>
      comparisonBeforeApp && comparisonAfterApp
        ? projectCompanyComparison(comparisonBeforeApp, comparisonAfterApp)
        : null,
    [comparisonBeforeApp, comparisonAfterApp]
  );

  if (comparisonBlocks) {
    return (
      <ReviewSectionCard
        title="Company Details"
        icon={BuildingOffice2Icon}
        section={section}
        isReviewable={false}
      >
        {comparisonBlocks.map((block) => (
          <ReviewFieldBlock key={block.id} title={block.title}>
            <div className={comparisonRowListClass}>
              {block.rows.map((row) => (
                <ComparisonProjectedRow key={row.key} row={row} />
              ))}
            </div>
          </ReviewFieldBlock>
        ))}
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  const basicInfo = org?.corporateOnboardingData?.basicInfo;
  const addresses = org?.corporateOnboardingData?.addresses;
  const businessAddress = addresses?.business as Record<string, unknown> | undefined;
  const registeredAddress = addresses?.registered as Record<string, unknown> | undefined;

  const bankDetails = (org?.bankAccountDetails ?? null) as Record<string, unknown> | null | undefined;
  const bankName = getBankField(bankDetails, "Bank") || getBankField(bankDetails, "Bank name");
  const bankAccountNumber =
    getBankField(bankDetails, "Bank account number") || getBankField(bankDetails, "Bank account");

  const contactPerson = (app.company_details as Record<string, unknown> | undefined)?.contact_person as
    | Record<string, unknown>
    | undefined;
  const cpName = contactPerson?.name != null ? String(contactPerson.name).trim() : "";
  const cpEmail = contactPerson?.email != null ? String(contactPerson.email).trim() : "";
  const cpPosition = contactPerson?.position != null ? String(contactPerson.position).trim() : "";
  const cpContact = contactPerson?.contact != null ? String(contactPerson.contact).trim() : "";

  const emptyDash = "—";
  const companyName =
    (basicInfo?.businessName ?? org?.name) != null
      ? formatReviewValue(basicInfo?.businessName ?? org?.name, { emptyLabel: emptyDash })
      : REVIEW_EMPTY_LABEL;
  const entityType = formatReviewValue(basicInfo?.entityType, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const ssmNo = formatReviewValue(basicInfo?.ssmRegisterNumber, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const industry = formatReviewValue(basicInfo?.industry, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const numberOfEmployees = formatReviewValue(basicInfo?.numberOfEmployees, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const about = parseAboutYourBusiness(org?.corporateOnboardingData?.aboutYourBusiness);
  const whatDoesCompanyDo =
    formatReviewValue(about.whatDoesCompanyDo, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const mainCustomers =
    formatReviewValue(about.mainCustomers, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const accountingSoftware =
    formatReviewValue(about.accountingSoftware, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;

  if (organizationId && isLoadingOrg) {
    return (
      <ReviewSectionCard title="Company Details" icon={BuildingOffice2Icon}>
        <div className={reviewRowGridClass}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      </ReviewSectionCard>
    );
  }

  if (!organizationId) {
    return (
      <ReviewSectionCard title="Company Details" icon={BuildingOffice2Icon}>
        <p className={reviewEmptyStateClass}>No organization linked to this application.</p>
      </ReviewSectionCard>
    );
  }

  return (
    <ReviewSectionCard
      title="Company Details"
      icon={BuildingOffice2Icon}
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
      <ReviewFieldBlock title="Company Info">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Company Name</Label>
          <div className={reviewValueClass}>{companyName}</div>
          <Label className={reviewLabelClass}>Type of Entity</Label>
          <div className={reviewValueClass}>{entityType}</div>
          <Label className={reviewLabelClass}>SSM No</Label>
          <div className={reviewValueClass}>{ssmNo}</div>
          <Label className={reviewLabelClass}>Industry</Label>
          <div className={reviewValueClass}>{industry}</div>
          <Label className={reviewLabelClass}>Number of Employees</Label>
          <div className={reviewValueClass}>{numberOfEmployees}</div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="About Your Business">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Company Activities</Label>
          <ReviewValue value={whatDoesCompanyDo} multiline />
          <Label className={reviewLabelClass}>Who Are Your Main Customers?</Label>
          <ReviewValue value={mainCustomers} multiline />
          <Label className={reviewLabelClass}>
            Does Any Single Customer Make Up More Than 50% of Your Revenue?
          </Label>
          <YesNoRadioDisplay value={about.singleCustomerOver50Revenue} />
          <Label className={reviewLabelClass}>Which Accounting Software Does the Issuer Use?</Label>
          <ReviewValue value={accountingSoftware} />
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Address">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Business Address</Label>
          <div className={reviewValueClass}>{formatAddress(businessAddress)}</div>
          <Label className={reviewLabelClass}>Registered Address</Label>
          <div className={reviewValueClass}>{formatAddress(registeredAddress)}</div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Banking Details">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Bank Name</Label>
          <div className={reviewValueClass}>{bankName || REVIEW_EMPTY_LABEL}</div>
          <div className="contents">
            <Label className={reviewLabelClass}>Bank Account Number</Label>
            <div>
              <div className={reviewValueClass}>{bankAccountNumber || REVIEW_EMPTY_LABEL}</div>
              <p className="mt-1 text-xs text-muted-foreground">{COMPANY_BANK_ACCOUNT_NUMBER_HINT}</p>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Contact Person">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Applicant Name</Label>
          <div className={reviewValueClass}>{cpName || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant Email</Label>
          <div className={reviewValueClass}>{cpEmail || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant Position</Label>
          <div className={reviewValueClass}>{cpPosition || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant Contact</Label>
          <div className={reviewValueClass}>{cpContact || REVIEW_EMPTY_LABEL}</div>
        </div>
      </ReviewFieldBlock>

      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
    </ReviewSectionCard>
  );
}
