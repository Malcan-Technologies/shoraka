"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@cashsouk/ui";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";
import { useOrganizationDetail } from "@/hooks/use-organization-detail";
import { SectionActionDropdown } from "../section-action-dropdown";
import type { ReviewSectionId } from "../section-types";

const EMPTY_LABEL = "Not provided";

/** Typography and layout aligned with other review sections */
const sectionHeaderClass = "text-sm font-semibold";
const rowGridClass =
  "grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-4 mt-3 w-full items-start";
const labelClass = "text-sm font-normal text-foreground";
const valueClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground flex items-center";

function formatValue(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number") return Number.isNaN(v) ? "—" : String(v);
  if (typeof v === "string") return v.trim() || "—";
  return String(v);
}

function formatAddress(addr: Record<string, unknown> | null | undefined): string {
  if (!addr || typeof addr !== "object") return EMPTY_LABEL;
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.state,
    addr.country,
  ].filter((p) => p != null && String(p).trim() !== "");
  return parts.length > 0 ? parts.join(", ") : EMPTY_LABEL;
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
  onApprove?: (section: ReviewSectionId) => void;
  onReject?: (section: ReviewSectionId) => void;
  onRequestAmendment?: (section: ReviewSectionId) => void;
}

export function CompanySection({
  app,
  section,
  isReviewable,
  approvePending,
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

  const companyName =
    (basicInfo?.businessName ?? org?.name) != null
      ? formatValue(basicInfo?.businessName ?? org?.name)
      : EMPTY_LABEL;
  const entityType = formatValue(basicInfo?.entityType) || EMPTY_LABEL;
  const ssmNo = formatValue(basicInfo?.ssmRegisterNumber) || EMPTY_LABEL;
  const industry = formatValue(basicInfo?.industry) || EMPTY_LABEL;
  const numberOfEmployees = formatValue(basicInfo?.numberOfEmployees) || EMPTY_LABEL;

  if (organizationId && isLoadingOrg) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BuildingOffice2Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Company Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className={rowGridClass}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!organizationId) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <BuildingOffice2Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Company Details</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No organization linked to this application.</p>
        </CardContent>
      </Card>
    );
  }

  const showActions = section && isReviewable && onApprove && onReject && onRequestAmendment;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BuildingOffice2Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Company Details</CardTitle>
          </div>
          {showActions && (
            <SectionActionDropdown
              section={section}
              isReviewable={!!isReviewable}
              onApprove={onApprove}
              onReject={onReject}
              onRequestAmendment={onRequestAmendment}
              isPending={!!approvePending}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Company info */}
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClass}>Company info</h3>
            <div className="mt-1.5 h-px bg-border" />
          </div>
          <div className={rowGridClass}>
            <Label className={labelClass}>Company name</Label>
            <div className={valueClass}>{companyName}</div>
            <Label className={labelClass}>Type of entity</Label>
            <div className={valueClass}>{entityType}</div>
            <Label className={labelClass}>SSM no</Label>
            <div className={valueClass}>{ssmNo}</div>
            <Label className={labelClass}>Industry</Label>
            <div className={valueClass}>{industry}</div>
            <Label className={labelClass}>Number of employees</Label>
            <div className={valueClass}>{numberOfEmployees}</div>
          </div>
        </section>

        {/* Address */}
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClass}>Address</h3>
            <div className="mt-1.5 h-px bg-border" />
          </div>
          <div className={rowGridClass}>
            <Label className={labelClass}>Business address</Label>
            <div className={valueClass}>{formatAddress(businessAddress)}</div>
            <Label className={labelClass}>Registered address</Label>
            <div className={valueClass}>{formatAddress(registeredAddress)}</div>
          </div>
        </section>

        {/* Banking details */}
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClass}>Banking details</h3>
            <div className="mt-1.5 h-px bg-border" />
          </div>
          <div className={rowGridClass}>
            <Label className={labelClass}>Bank name</Label>
            <div className={valueClass}>{bankName || EMPTY_LABEL}</div>
            <div className="contents">
              <Label className={labelClass}>Bank account number</Label>
              <div>
                <div className={valueClass}>{bankAccountNumber || EMPTY_LABEL}</div>
                <p className="mt-1 text-xs text-muted-foreground">10–18 digits</p>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Person */}
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClass}>Contact Person</h3>
            <div className="mt-1.5 h-px bg-border" />
          </div>
          <div className={rowGridClass}>
            <Label className={labelClass}>Applicant name</Label>
            <div className={valueClass}>{cpName || EMPTY_LABEL}</div>
            <Label className={labelClass}>Applicant position</Label>
            <div className={valueClass}>{cpPosition || EMPTY_LABEL}</div>
            <Label className={labelClass}>Applicant IC no</Label>
            <div className={valueClass}>{cpIc || EMPTY_LABEL}</div>
            <Label className={labelClass}>Applicant contact</Label>
            <div className={valueClass}>{cpContact || EMPTY_LABEL}</div>
          </div>
        </section>

        <div>
          <Label className="text-xs text-muted-foreground">Add Remarks</Label>
          <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
        </div>
      </CardContent>
    </Card>
  );
}
