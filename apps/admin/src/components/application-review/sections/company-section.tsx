"use client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@cashsouk/ui";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
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
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import { ComparisonFieldRow } from "../comparison-field-row";

function formatAddress(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== "object") return REVIEW_EMPTY_LABEL;
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.state,
    addr.country,
  ].filter((p) => p != null && String(p).trim() !== "");
  return parts.length > 0 ? parts.join(", ") : REVIEW_EMPTY_LABEL;
}

/** Same pattern as issuer company-details-step: extract bank fields from content array */
function getBankField(bankDetails: Record<string, unknown> | null | undefined, fieldName: string): string {
  if (!bankDetails?.content) return "";
  const content = bankDetails.content as Array<{ fieldName?: string; fieldValue?: string }>;
  const field = content?.find((f) => f.fieldName === fieldName);
  return field?.fieldValue?.trim() ?? "";
}

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
    isPathChanged: (path: string) => boolean;
  };
  hideSectionComments?: boolean;
}

function companyDisplayFromSnapshot(app: CompanySectionProps["app"]) {
  const rawOrg = app.issuer_organization as Record<string, unknown> | null | undefined;
  const cod = (rawOrg?.corporateOnboardingData ??
    rawOrg?.corporate_onboarding_data) as Record<string, unknown> | undefined;
  const basicInfo = (cod?.basicInfo ?? cod?.basic_info) as Record<string, unknown> | undefined;
  const addresses = (cod?.addresses ?? cod?.Addresses) as Record<string, unknown> | undefined;
  const businessAddress = addresses?.business as Record<string, unknown> | undefined;
  const registeredAddress = addresses?.registered as Record<string, unknown> | undefined;
  const bankDetails = (rawOrg?.bankAccountDetails ??
    rawOrg?.bank_account_details) as Record<string, unknown> | null | undefined;
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
    (basicInfo?.businessName ?? basicInfo?.business_name ?? rawOrg?.name) != null
      ? formatReviewValue(basicInfo?.businessName ?? basicInfo?.business_name ?? rawOrg?.name, {
          emptyLabel: emptyDash,
        })
      : REVIEW_EMPTY_LABEL;
  const entityType =
    formatReviewValue(basicInfo?.entityType ?? basicInfo?.entity_type, { emptyLabel: emptyDash }) ||
    REVIEW_EMPTY_LABEL;
  const ssmNo =
    formatReviewValue(basicInfo?.ssmRegisterNumber ?? basicInfo?.ssm_register_number, {
      emptyLabel: emptyDash,
    }) || REVIEW_EMPTY_LABEL;
  const industry =
    formatReviewValue(basicInfo?.industry, { emptyLabel: emptyDash }) || REVIEW_EMPTY_LABEL;
  const numberOfEmployees =
    formatReviewValue(basicInfo?.numberOfEmployees ?? basicInfo?.number_of_employees, {
      emptyLabel: emptyDash,
    }) || REVIEW_EMPTY_LABEL;
  return {
    companyName,
    entityType,
    ssmNo,
    industry,
    numberOfEmployees,
    businessAddress: formatAddress(businessAddress),
    registeredAddress: formatAddress(registeredAddress),
    bankName: bankName || REVIEW_EMPTY_LABEL,
    bankAccountNumber: bankAccountNumber || REVIEW_EMPTY_LABEL,
    cpName: cpName || REVIEW_EMPTY_LABEL,
    cpEmail: cpEmail || REVIEW_EMPTY_LABEL,
    cpPosition: cpPosition || REVIEW_EMPTY_LABEL,
    cpContact: cpContact || REVIEW_EMPTY_LABEL,
  };
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
  if (sectionComparison) {
    const { beforeApp, afterApp, isPathChanged } = sectionComparison;
    const b = companyDisplayFromSnapshot(beforeApp);
    const a = companyDisplayFromSnapshot(afterApp);
    return (
      <ReviewSectionCard
        title="Company Details"
        icon={BuildingOffice2Icon}
        section={section}
        isReviewable={false}
      >
        <ReviewFieldBlock title="Company Info">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Company Name"
              before={b.companyName}
              after={a.companyName}
              changed={isPathChanged("company_details") || isPathChanged("issuer_organization")}
            />
            <ComparisonFieldRow
              label="Type of Entity"
              before={b.entityType}
              after={a.entityType}
              changed={isPathChanged("company_details") || isPathChanged("issuer_organization")}
            />
            <ComparisonFieldRow
              label="SSM No"
              before={b.ssmNo}
              after={a.ssmNo}
              changed={isPathChanged("company_details") || isPathChanged("issuer_organization")}
            />
            <ComparisonFieldRow
              label="Industry"
              before={b.industry}
              after={a.industry}
              changed={isPathChanged("company_details") || isPathChanged("issuer_organization")}
            />
            <ComparisonFieldRow
              label="Number of Employees"
              before={b.numberOfEmployees}
              after={a.numberOfEmployees}
              changed={isPathChanged("company_details") || isPathChanged("issuer_organization")}
            />
          </div>
        </ReviewFieldBlock>
        <ReviewFieldBlock title="Address">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Business Address"
              before={b.businessAddress}
              after={a.businessAddress}
              changed={isPathChanged("issuer_organization")}
              multiline
            />
            <ComparisonFieldRow
              label="Registered Address"
              before={b.registeredAddress}
              after={a.registeredAddress}
              changed={isPathChanged("issuer_organization")}
              multiline
            />
          </div>
        </ReviewFieldBlock>
        <ReviewFieldBlock title="Banking Details">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Bank Name"
              before={b.bankName}
              after={a.bankName}
              changed={isPathChanged("issuer_organization")}
            />
            <ComparisonFieldRow
              label="Bank Account Number"
              before={b.bankAccountNumber}
              after={a.bankAccountNumber}
              changed={isPathChanged("issuer_organization")}
            />
          </div>
        </ReviewFieldBlock>
        <ReviewFieldBlock title="Contact Person">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="Applicant Name"
              before={b.cpName}
              after={a.cpName}
              changed={isPathChanged("company_details")}
            />
            <ComparisonFieldRow
              label="Applicant Email"
              before={b.cpEmail}
              after={a.cpEmail}
              changed={isPathChanged("company_details")}
            />
            <ComparisonFieldRow
              label="Applicant Position"
              before={b.cpPosition}
              after={a.cpPosition}
              changed={isPathChanged("company_details")}
            />
            <ComparisonFieldRow
              label="Applicant Contact"
              before={b.cpContact}
              after={a.cpContact}
              changed={isPathChanged("company_details")}
            />
          </div>
        </ReviewFieldBlock>
        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
    );
  }

  const organizationId =
    app.issuer_organization_id ?? (app.issuer_organization as { id?: string } | null)?.id ?? null;

  const { data: org, isLoading: isLoadingOrg } = useOrganizationDetail(
    organizationId ? "issuer" : null,
    organizationId
  );

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
              <p className="mt-1 text-xs text-muted-foreground">10–18 digits</p>
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
