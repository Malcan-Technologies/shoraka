/**
 * SECTION: Company tab resubmit comparison projection
 * WHY: Same rows render the Company comparison and decide its Diff badge.
 * INPUT: Before / after review apps built from revision snapshots
 * OUTPUT: Comparison blocks + has-changes flag
 * WHERE USED: Company section comparison branch, resubmit comparison modal badge
 */

import { parseAboutYourBusiness } from "@cashsouk/types";
import type { ReviewApplicationView } from "@/components/application-review/section-content";
import { blocksHaveChanges, type ComparisonBlock } from "./projection-types";
import { REVIEW_EMPTY_LABEL, formatReviewText } from "./shared-format";

export const COMPANY_BANK_ACCOUNT_NUMBER_HINT = "10–18 digits";

export function formatCompanyAddress(addr: Record<string, unknown> | null | undefined): string {
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
export function getCompanyBankField(
  bankDetails: Record<string, unknown> | null | undefined,
  fieldName: string
): string {
  if (!bankDetails?.content) return "";
  const content = bankDetails.content as Array<{ fieldName?: string; fieldValue?: string }>;
  const field = content?.find((f) => f.fieldName === fieldName);
  return field?.fieldValue?.trim() ?? "";
}

type CompanySnapshotApp = Pick<ReviewApplicationView, "company_details" | "issuer_organization">;

/** Reads issuer_organization (onboarding + bank) and company_details.contact_person only. */
export function companyDisplayFromSnapshot(app: CompanySnapshotApp) {
  const rawOrg = app.issuer_organization as Record<string, unknown> | null | undefined;
  const cod = (rawOrg?.corporateOnboardingData ??
    rawOrg?.corporate_onboarding_data) as Record<string, unknown> | undefined;
  const basicInfo = (cod?.basicInfo ?? cod?.basic_info) as Record<string, unknown> | undefined;
  const addresses = (cod?.addresses ?? cod?.Addresses) as Record<string, unknown> | undefined;
  const businessAddress = addresses?.business as Record<string, unknown> | undefined;
  const registeredAddress = addresses?.registered as Record<string, unknown> | undefined;
  const bankDetails = (rawOrg?.bankAccountDetails ??
    rawOrg?.bank_account_details) as Record<string, unknown> | null | undefined;
  const bankName =
    getCompanyBankField(bankDetails, "Bank") || getCompanyBankField(bankDetails, "Bank name");
  const bankAccountNumber =
    getCompanyBankField(bankDetails, "Bank account number") ||
    getCompanyBankField(bankDetails, "Bank account");
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
      ? formatReviewText(basicInfo?.businessName ?? basicInfo?.business_name ?? rawOrg?.name, emptyDash)
      : REVIEW_EMPTY_LABEL;
  const entityType =
    formatReviewText(basicInfo?.entityType ?? basicInfo?.entity_type, emptyDash) || REVIEW_EMPTY_LABEL;
  const ssmNo =
    formatReviewText(basicInfo?.ssmRegisterNumber ?? basicInfo?.ssm_register_number, emptyDash) ||
    REVIEW_EMPTY_LABEL;
  const industry = formatReviewText(basicInfo?.industry, emptyDash) || REVIEW_EMPTY_LABEL;
  const numberOfEmployees =
    formatReviewText(basicInfo?.numberOfEmployees ?? basicInfo?.number_of_employees, emptyDash) ||
    REVIEW_EMPTY_LABEL;
  const about = parseAboutYourBusiness(cod?.aboutYourBusiness ?? cod?.about_your_business);
  const whatDoesCompanyDo = formatReviewText(about.whatDoesCompanyDo, emptyDash) || REVIEW_EMPTY_LABEL;
  const mainCustomers = formatReviewText(about.mainCustomers, emptyDash) || REVIEW_EMPTY_LABEL;
  const accountingSoftware = formatReviewText(about.accountingSoftware, emptyDash) || REVIEW_EMPTY_LABEL;
  return {
    companyName,
    entityType,
    ssmNo,
    industry,
    numberOfEmployees,
    whatDoesCompanyDo,
    mainCustomers,
    singleCustomerOver50Revenue: about.singleCustomerOver50Revenue,
    accountingSoftware,
    businessAddress: formatCompanyAddress(businessAddress),
    registeredAddress: formatCompanyAddress(registeredAddress),
    bankName: bankName || REVIEW_EMPTY_LABEL,
    bankAccountNumber: bankAccountNumber || REVIEW_EMPTY_LABEL,
    cpName: cpName || REVIEW_EMPTY_LABEL,
    cpEmail: cpEmail || REVIEW_EMPTY_LABEL,
    cpPosition: cpPosition || REVIEW_EMPTY_LABEL,
    cpContact: cpContact || REVIEW_EMPTY_LABEL,
  };
}

export function projectCompanyComparison(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): ComparisonBlock[] {
  const b = companyDisplayFromSnapshot(beforeApp);
  const a = companyDisplayFromSnapshot(afterApp);
  return [
    {
      id: "company_info",
      title: "Company Info",
      rows: [
        { key: "company_name", label: "Company Name", kind: "text", before: b.companyName, after: a.companyName },
        { key: "entity_type", label: "Type of Entity", kind: "text", before: b.entityType, after: a.entityType },
        { key: "ssm_no", label: "SSM No", kind: "text", before: b.ssmNo, after: a.ssmNo },
        { key: "industry", label: "Industry", kind: "text", before: b.industry, after: a.industry },
        {
          key: "number_of_employees",
          label: "Number of Employees",
          kind: "text",
          before: b.numberOfEmployees,
          after: a.numberOfEmployees,
        },
      ],
    },
    {
      id: "about_your_business",
      title: "About Your Business",
      rows: [
        {
          key: "what_does_company_do",
          label: "Company Activities",
          kind: "text",
          before: b.whatDoesCompanyDo,
          after: a.whatDoesCompanyDo,
          multiline: true,
        },
        {
          key: "main_customers",
          label: "Who Are Your Main Customers?",
          kind: "text",
          before: b.mainCustomers,
          after: a.mainCustomers,
          multiline: true,
        },
        {
          key: "single_customer_over_50_revenue",
          label: "Does Any Single Customer Make Up More Than 50% of Your Revenue?",
          kind: "yesno",
          before: b.singleCustomerOver50Revenue,
          after: a.singleCustomerOver50Revenue,
        },
        {
          key: "accounting_software",
          label: "Which Accounting Software Does the Issuer Use?",
          kind: "text",
          before: b.accountingSoftware,
          after: a.accountingSoftware,
        },
      ],
    },
    {
      id: "address",
      title: "Address",
      rows: [
        {
          key: "business_address",
          label: "Business Address",
          kind: "text",
          before: b.businessAddress,
          after: a.businessAddress,
        },
        {
          key: "registered_address",
          label: "Registered Address",
          kind: "text",
          before: b.registeredAddress,
          after: a.registeredAddress,
        },
      ],
    },
    {
      id: "banking_details",
      title: "Banking Details",
      rows: [
        { key: "bank_name", label: "Bank Name", kind: "text", before: b.bankName, after: a.bankName },
        {
          key: "bank_account_number",
          label: "Bank Account Number",
          kind: "text",
          before: b.bankAccountNumber,
          after: a.bankAccountNumber,
          hint: COMPANY_BANK_ACCOUNT_NUMBER_HINT,
        },
      ],
    },
    {
      id: "contact_person",
      title: "Contact Person",
      rows: [
        { key: "contact_name", label: "Applicant Name", kind: "text", before: b.cpName, after: a.cpName },
        { key: "contact_email", label: "Applicant Email", kind: "text", before: b.cpEmail, after: a.cpEmail },
        {
          key: "contact_position",
          label: "Applicant Position",
          kind: "text",
          before: b.cpPosition,
          after: a.cpPosition,
        },
        {
          key: "contact_contact",
          label: "Applicant Contact",
          kind: "text",
          before: b.cpContact,
          after: a.cpContact,
        },
      ],
    },
  ];
}

export function companyComparisonHasChanges(
  beforeApp: ReviewApplicationView,
  afterApp: ReviewApplicationView
): boolean {
  return blocksHaveChanges(projectCompanyComparison(beforeApp, afterApp));
}
