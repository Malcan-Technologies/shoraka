"use client";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@cashsouk/ui";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  REVIEW_EMPTY_LABEL,
  formatReviewValue,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";

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
}: CompanySectionProps) {
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
  const cpPosition = contactPerson?.position != null ? String(contactPerson.position).trim() : "";
  const cpIc = contactPerson?.ic != null ? String(contactPerson.ic).trim() : "";
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
        <p className="text-sm text-muted-foreground">No organization linked to this application.</p>
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
      <ReviewFieldBlock title="Company info">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Company name</Label>
          <div className={reviewValueClass}>{companyName}</div>
          <Label className={reviewLabelClass}>Type of entity</Label>
          <div className={reviewValueClass}>{entityType}</div>
          <Label className={reviewLabelClass}>SSM no</Label>
          <div className={reviewValueClass}>{ssmNo}</div>
          <Label className={reviewLabelClass}>Industry</Label>
          <div className={reviewValueClass}>{industry}</div>
          <Label className={reviewLabelClass}>Number of employees</Label>
          <div className={reviewValueClass}>{numberOfEmployees}</div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Address">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Business address</Label>
          <div className={reviewValueClass}>{formatAddress(businessAddress)}</div>
          <Label className={reviewLabelClass}>Registered address</Label>
          <div className={reviewValueClass}>{formatAddress(registeredAddress)}</div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Banking details">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Bank name</Label>
          <div className={reviewValueClass}>{bankName || REVIEW_EMPTY_LABEL}</div>
          <div className="contents">
            <Label className={reviewLabelClass}>Bank account number</Label>
            <div>
              <div className={reviewValueClass}>{bankAccountNumber || REVIEW_EMPTY_LABEL}</div>
              <p className="mt-1 text-xs text-muted-foreground">10–18 digits</p>
            </div>
          </div>
        </div>
      </ReviewFieldBlock>

      <ReviewFieldBlock title="Contact Person">
        <div className={reviewRowGridClass}>
          <Label className={reviewLabelClass}>Applicant name</Label>
          <div className={reviewValueClass}>{cpName || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant position</Label>
          <div className={reviewValueClass}>{cpPosition || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant IC no</Label>
          <div className={reviewValueClass}>{cpIc || REVIEW_EMPTY_LABEL}</div>
          <Label className={reviewLabelClass}>Applicant contact</Label>
          <div className={reviewValueClass}>{cpContact || REVIEW_EMPTY_LABEL}</div>
        </div>
      </ReviewFieldBlock>

      <div>
        <Label className="text-xs text-muted-foreground">Add Remarks</Label>
        <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
      </div>
    </ReviewSectionCard>
  );
}
