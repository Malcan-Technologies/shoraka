"use client";

/** Imports
 *
 * What: Business details step UI and shared form controls.
 * Why: Keep form control styling consistent across steps (inputs, textareas, radios, checkboxes).
 * Data: Emits a snake_case payload to the parent save flow.
 */
import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  formInputClassName,
  formInputDisabledClassName,
  formLockedFileSurfaceClassName,
  formTextareaClassName,
  formLabelClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { MoneyInput } from "@cashsouk/ui";
import { parseMoney, formatMoney } from "@cashsouk/ui";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { BusinessDetailsSkeleton } from "@/app/(application-flow)/applications/components/business-details-skeleton";
import { generateBusinessDetailsData } from "@/app/(application-flow)/applications/utils/dev-data-generator";
import {
  GUARANTOR_COMPANY_RELATIONSHIP_LABELS,
  GUARANTOR_COMPANY_RELATIONSHIPS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIPS,
  type GuarantorCompanyRelationship,
  type GuarantorIndividualRelationship,
} from "@cashsouk/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formSelectTriggerClassName } from "@/app/(application-flow)/applications/components/form-control";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ChevronRightIcon,
  EyeIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { CloudUpload, X, CheckCircle2 } from "lucide-react";
import { useAuthToken } from "@cashsouk/config";
import { toast } from "sonner";

/**
 * BUSINESS DETAILS STEP
 *
 * Form for about your business, why raising funds, and a declaration.
 * Data is persisted to application.business_details JSON column.
 *
 * Data Flow:
 * 1. Load saved data from application.business_details
 * 2. User edits; on change pass payload + hasPendingChanges to parent
 * 3. Parent saves to DB when user clicks "Save and Continue"
 */

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

const SAME_INVOICE_OTHER_P2P_ERROR =
  "This invoice has already been applied on another P2P platform and cannot be submitted.";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type YesNo = "yes" | "no";

interface AboutYourBusiness {
  whatDoesCompanyDo: string;
  mainCustomers: string;
  singleCustomerOver50Revenue: YesNo | "";
}

interface WhyRaisingFunds {
  financingFor: string;
  howFundsUsed: string;
  businessPlan: string;
  risksDelayRepayment: string;
  backupPlan: string;
  raisingOnOtherP2P: YesNo | "";
  platformName: string;
  amountRaised: string;
  sameInvoiceUsed: YesNo | "";
  accountingSoftware: string;
  supportingDocuments: Array<{
    file_name: string;
    file_size: number;
    s3_key?: string;
    uploaded_at: string;
    client_id?: string;
  }>;
}

type WhySupportingDocument = WhyRaisingFunds["supportingDocuments"][number];

interface GuarantorIndividualRow {
  guarantorType: "individual";
  firstName: string;
  lastName: string;
  icNumber: string;
  relationship: GuarantorIndividualRelationship | "";
}

interface GuarantorCompanyRow {
  guarantorType: "company";
  companyName: string;
  ssmNumber: string;
  relationship: GuarantorCompanyRelationship | "";
}

type GuarantorFormRow = GuarantorIndividualRow | GuarantorCompanyRow;

function guarantorCardSummarySubtitle(row: GuarantorFormRow): string {
  if (row.guarantorType === "individual") {
    const name = [row.firstName, row.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    const rel =
      row.relationship &&
      GUARANTOR_INDIVIDUAL_RELATIONSHIPS.includes(row.relationship as GuarantorIndividualRelationship)
        ? GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS[row.relationship as GuarantorIndividualRelationship]
        : "";
    if (name && rel) return `${name} (${rel})`;
    if (name) return name;
    if (rel) return `(${rel})`;
    return "";
  }
  const co = row.companyName.trim();
  const rel =
    row.relationship &&
    GUARANTOR_COMPANY_RELATIONSHIPS.includes(row.relationship as GuarantorCompanyRelationship)
      ? GUARANTOR_COMPANY_RELATIONSHIP_LABELS[row.relationship as GuarantorCompanyRelationship]
      : "";
  if (co && rel) return `${co} (${rel})`;
  if (co) return co;
  if (rel) return `(${rel})`;
  return "";
}

function emptyIndividualGuarantor(): GuarantorIndividualRow {
  return {
    guarantorType: "individual",
    firstName: "",
    lastName: "",
    icNumber: "",
    relationship: "",
  };
}

function emptyCompanyGuarantor(): GuarantorCompanyRow {
  return {
    guarantorType: "company",
    companyName: "",
    ssmNumber: "",
    relationship: "",
  };
}

interface BusinessDetailsPayload {
  aboutYourBusiness: AboutYourBusiness;
  whyRaisingFunds: WhyRaisingFunds;
  declarationConfirmed: boolean;
  guarantors: GuarantorFormRow[];
}

/** API/DB shape: snake_case keys; yes/no fields stored as boolean */
interface BusinessDetailsSnake {
  about_your_business?: {
    what_does_company_do?: string;
    main_customers?: string;
    single_customer_over_50_revenue?: boolean;
  };
  why_raising_funds?: {
    financing_for?: string;
    how_funds_used?: string;
    business_plan?: string;
    risks_delay_repayment?: string;
    backup_plan?: string;
    raising_on_other_p2p?: boolean;
    platform_name?: string | null;
    amount_raised?: number | null;
    same_invoice_used?: boolean | null;
    accounting_software?: string;
    supporting_documents?: Array<{
      file_name: string;
      file_size: number;
      s3_key: string;
      uploaded_at?: string;
    }>;
  };
  declaration_confirmed?: boolean;
  guarantors?: Array<
    | {
        guarantor_type: "individual";
        first_name: string;
        last_name: string;
        ic_number: string;
        relationship: GuarantorIndividualRelationship;
      }
    | {
        guarantor_type: "company";
        company_name: string;
        ssm_number: string;
        relationship: GuarantorCompanyRelationship;
      }
  >;
}

function yesNoToBoolean(v: YesNo | ""): boolean | undefined {
  if (v === "yes") return true;
  if (v === "no") return false;
  return undefined;
}

function booleanToYesNo(v: boolean | string | undefined): YesNo | "" {
  if (v === true || v === "yes") return "yes";
  if (v === false || v === "no") return "no";
  return "";
}

function makeClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function toSnakePayload(p: BusinessDetailsPayload): BusinessDetailsSnake {
  const basePayload: BusinessDetailsSnake = {
    about_your_business: {
      what_does_company_do: p.aboutYourBusiness.whatDoesCompanyDo ?? "",
      main_customers: p.aboutYourBusiness.mainCustomers ?? "",
      single_customer_over_50_revenue: yesNoToBoolean(p.aboutYourBusiness.singleCustomerOver50Revenue),
    },
    why_raising_funds: {
      financing_for: p.whyRaisingFunds.financingFor ?? "",
      how_funds_used: p.whyRaisingFunds.howFundsUsed ?? "",
      business_plan: p.whyRaisingFunds.businessPlan ?? "",
      risks_delay_repayment: p.whyRaisingFunds.risksDelayRepayment ?? "",
      backup_plan: p.whyRaisingFunds.backupPlan ?? "",
      raising_on_other_p2p: yesNoToBoolean(p.whyRaisingFunds.raisingOnOtherP2P),
      accounting_software: p.whyRaisingFunds.accountingSoftware ?? "",
      supporting_documents: (p.whyRaisingFunds.supportingDocuments ?? [])
        .filter((d) => typeof d.s3_key === "string" && d.s3_key.trim() !== "")
        .map((d) => ({
          file_name: d.file_name,
          file_size: d.file_size ?? 0,
          s3_key: d.s3_key!,
          uploaded_at: d.uploaded_at,
        })),
    },
    declaration_confirmed: p.declarationConfirmed,
    guarantors: p.guarantors.map((g) =>
      g.guarantorType === "individual"
        ? {
            guarantor_type: "individual" as const,
            first_name: g.firstName.trim(),
            last_name: g.lastName.trim(),
            ic_number: g.icNumber.trim(),
            relationship: g.relationship as GuarantorIndividualRelationship,
          }
        : {
            guarantor_type: "company" as const,
            company_name: g.companyName.trim(),
            ssm_number: g.ssmNumber.trim(),
            relationship: g.relationship as GuarantorCompanyRelationship,
          }
    ),
  };

  /* Always include P2P-dependent fields. When "no", set to null to preserve structure. */
  if (p.whyRaisingFunds.raisingOnOtherP2P === "yes") {
    basePayload.why_raising_funds!.platform_name = p.whyRaisingFunds.platformName ?? "";
    basePayload.why_raising_funds!.amount_raised = parseMoney(p.whyRaisingFunds.amountRaised ?? "");
    basePayload.why_raising_funds!.same_invoice_used = yesNoToBoolean(p.whyRaisingFunds.sameInvoiceUsed);
  } else {
    basePayload.why_raising_funds!.platform_name = null;
    basePayload.why_raising_funds!.amount_raised = null;
    basePayload.why_raising_funds!.same_invoice_used = null;
  }

  return basePayload;
}

function fromSnakeSaved(saved: BusinessDetailsSnake | Record<string, unknown> | null | undefined): BusinessDetailsPayload {
  const raw = saved as any;
  const a = raw?.about_your_business ?? raw?.aboutYourBusiness;
  const w = raw?.why_raising_funds ?? raw?.whyRaisingFunds;
  return {
    aboutYourBusiness: {
      whatDoesCompanyDo: a?.what_does_company_do ?? a?.whatDoesCompanyDo ?? "",
      mainCustomers: a?.main_customers ?? a?.mainCustomers ?? "",
      singleCustomerOver50Revenue: booleanToYesNo(a?.single_customer_over_50_revenue ?? a?.singleCustomerOver50Revenue),
    },
    whyRaisingFunds: {
      financingFor: w?.financing_for ?? w?.financingFor ?? "",
      howFundsUsed: w?.how_funds_used ?? w?.howFundsUsed ?? "",
      businessPlan: w?.business_plan ?? w?.businessPlan ?? "",
      risksDelayRepayment: w?.risks_delay_repayment ?? w?.risksDelayRepayment ?? "",
      backupPlan: w?.backup_plan ?? w?.backupPlan ?? "",
      raisingOnOtherP2P: booleanToYesNo(w?.raising_on_other_p2p ?? w?.raisingOnOtherP2P),
      platformName: w?.platform_name ?? w?.platformName ?? "",
      amountRaised: w?.amount_raised != null || w?.amountRaised != null ? formatMoney(w?.amount_raised ?? w?.amountRaised) : "",
      sameInvoiceUsed: booleanToYesNo(w?.same_invoice_used ?? w?.sameInvoiceUsed),
      accountingSoftware: w?.accounting_software ?? w?.accountingSoftware ?? "",
      supportingDocuments: Array.isArray(w?.supporting_documents ?? w?.supportingDocuments)
        ? (w?.supporting_documents ?? w?.supportingDocuments).map((doc: any) => ({
            file_name: String(doc?.file_name ?? doc?.fileName ?? "document.pdf"),
            file_size: Number(doc?.file_size ?? doc?.fileSize ?? 0),
            s3_key: typeof doc?.s3_key === "string" ? doc.s3_key : undefined,
            uploaded_at: String(doc?.uploaded_at ?? doc?.uploadedAt ?? new Date().toISOString()),
          }))
        : [],
    },
    declarationConfirmed: raw?.declaration_confirmed ?? raw?.declarationConfirmed ?? false,
    guarantors: parseGuarantorsFromRaw(raw?.guarantors),
  };
}

function parseGuarantorsFromRaw(raw: unknown): GuarantorFormRow[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return [emptyIndividualGuarantor()];
  }
  const out: GuarantorFormRow[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const gt = o.guarantor_type ?? o.guarantorType;
    if (gt === "individual") {
      const rel = o.relationship;
      const relationshipOk =
        typeof rel === "string" &&
        (GUARANTOR_INDIVIDUAL_RELATIONSHIPS as readonly string[]).includes(rel);
      out.push({
        guarantorType: "individual",
        firstName: String(o.first_name ?? o.firstName ?? ""),
        lastName: String(o.last_name ?? o.lastName ?? ""),
        icNumber: String(o.ic_number ?? o.icNumber ?? ""),
        relationship: relationshipOk ? (rel as GuarantorIndividualRelationship) : "",
      });
    } else if (gt === "company") {
      const rel = o.relationship;
      const relationshipOk =
        typeof rel === "string" && (GUARANTOR_COMPANY_RELATIONSHIPS as readonly string[]).includes(rel);
      out.push({
        guarantorType: "company",
        companyName: String(o.company_name ?? o.companyName ?? ""),
        ssmNumber: String(o.ssm_number ?? o.ssmNumber ?? ""),
        relationship: relationshipOk ? (rel as GuarantorCompanyRelationship) : "",
      });
    }
  }
  return out.length > 0 ? out : [emptyIndividualGuarantor()];
}

/** Mock data for dev Auto Fill. Re-exports from dev-data-generator. */
export function generateMockData(): Record<string, unknown> {
  return generateBusinessDetailsData();
}

const defaultAbout: AboutYourBusiness = {
  whatDoesCompanyDo: "",
  mainCustomers: "",
  singleCustomerOver50Revenue: "",
};

const defaultWhy: WhyRaisingFunds = {
  financingFor: "",
  howFundsUsed: "",
  businessPlan: "",
  risksDelayRepayment: "",
  backupPlan: "",
  raisingOnOtherP2P: "",
  platformName: "",
  amountRaised: "",
  sameInvoiceUsed: "",
  accountingSoftware: "",
  supportingDocuments: [],
};

interface BusinessDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
  readOnly?: boolean;
}


/** Helpers
 *
 * What: Canonical label + layout behavior.
 * Why: Keep typography consistent while maintaining the left-column alignment used in screenshots.
 * Data: Shared label typography + step-specific alignment utilities.
 */
const labelClassName = cn(formLabelClassName, "font-normal");

/**
 * Inputs
 */
const inputClassName = formInputClassName;
const textareaClassName = cn(formTextareaClassName, "min-h-[100px]");

/**
 * Core form grid
 * Includes px-3 for consistent indentation with other steps
 */
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-8 mt-5 w-full items-start px-3";

/** Right-column wrapper for yes/no rows: vertically center radios vs multi-line labels. */
const radioGridControlClassName = "self-center w-full min-w-0";

/**
 * Section wrapper
 */
const sectionWrapperClassName = "w-full";

/**
 * Outer form spacing — room between major sections (BRANDING: breathable layout).
 */
const formOuterClassName = "w-full flex flex-col gap-12 md:gap-14 px-3";

/** Tooltip surface for investor badge: neutral popover, not primary red. */
const investorBadgeTooltipContentClassName =
  "max-w-xs border border-border bg-popover px-3 py-2 text-sm font-normal normal-case leading-snug text-popover-foreground shadow-md";

/**
 * Investor visibility hint
 *
 * What: Inline muted badge beside section title; full detail on hover.
 * Why: Fintech-style cue without a long sentence in the header row.
 * Data: Presentational only; short label + tooltip copy are fixed UX text.
 */
function InvestorVisibilityBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full shrink-0 cursor-help items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <EyeIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          <span className="truncate">Visible to investors</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className={investorBadgeTooltipContentClassName}>
        Everything you enter here will be shown to investors.
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Radio labels (use canonical form label styles)
 */
const radioSelectedLabel = formLabelClassName;
const radioUnselectedLabel = formLabelClassName.replace("text-foreground", "text-muted-foreground");

function CustomRadio({
  name,
  value,
  checked,
  onChange,
  label,
  selectedLabelClass,
  unselectedLabelClass,
  disabled,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  selectedLabelClass: string;
  unselectedLabelClass: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="sr-only"
          aria-hidden
        />
        <span
          className={cn(
            "pointer-events-none relative block h-5 w-5 shrink-0 rounded-full",
            checked
              ? disabled
                ? "bg-muted border-2 border-muted-foreground/50"
                : "bg-primary"
              : "border-2 border-muted-foreground/50 bg-muted/30"
          )}
          aria-hidden
        >
          {checked && (
            <span
              className={cn(
                "absolute inset-1 rounded-full",
                disabled ? "bg-muted-foreground/60" : "bg-white"
              )}
              aria-hidden
            />
          )}
          {!checked && (
            <span
              className="absolute inset-1.5 rounded-full bg-muted-foreground/40"
              aria-hidden
            />
          )}
        </span>
      </span>
      <span className={checked ? selectedLabelClass : unselectedLabelClass}>{label}</span>
    </label>
  );
}

function YesNoRadioGroup({
  value,
  onValueChange,
  name,
  disabled,
}: {
  value: YesNo | "";
  onValueChange: (v: YesNo) => void;
  name: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-6 items-center">
      <CustomRadio
        name={name}
        value="yes"
        checked={value === "yes"}
        onChange={() => !disabled && onValueChange("yes")}
        label="Yes"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
        disabled={disabled}
      />
      <CustomRadio
        name={name}
        value="no"
        checked={value === "no"}
        onChange={() => !disabled && onValueChange("no")}
        label="No"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
        disabled={disabled}
      />
    </div>
  );
}


function TextareaWithCharCount({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  countLabel,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  maxLength: number;
  className: string;
  countLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(className, "pb-8", disabled && formInputDisabledClassName)}
        disabled={disabled}
      />
      <span
        className="absolute bottom-3 right-3 text-sm text-muted-foreground pointer-events-none"
        aria-hidden
      >
        {countLabel}
      </span>
    </div>
  );
}

interface GuarantorCardFieldsProps {
  row: GuarantorFormRow;
  index: number;
  readOnly: boolean;
  replaceGuarantorRow: (index: number, next: GuarantorFormRow) => void;
  setGuarantorTypeAt: (index: number, type: "individual" | "company") => void;
}

function GuarantorCardFields({
  row,
  index,
  readOnly,
  replaceGuarantorRow,
  setGuarantorTypeAt,
}: GuarantorCardFieldsProps) {
  const inputClassName = formInputClassName;
  return (
    <div className="space-y-5">
      <div className="space-y-2 w-full min-w-0">
        <Label className={formLabelClassName}>Guarantor type</Label>
        <Select
          value={row.guarantorType}
          disabled={readOnly}
          onValueChange={(v) => setGuarantorTypeAt(index, v as "individual" | "company")}
        >
          <SelectTrigger
            className={cn(
              formSelectTriggerClassName,
              "w-full",
              readOnly && formInputDisabledClassName
            )}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">Individual</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {row.guarantorType === "individual" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor={`g-${index}-first`} className={formLabelClassName}>
                First name
              </Label>
              <Input
                id={`g-${index}-first`}
                value={row.firstName}
                onChange={(e) =>
                  replaceGuarantorRow(index, {
                    ...row,
                    firstName: e.target.value.slice(0, 100),
                  })
                }
                placeholder="First name"
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2 w-full min-w-0">
              <Label htmlFor={`g-${index}-last`} className={formLabelClassName}>
                Last name
              </Label>
              <Input
                id={`g-${index}-last`}
                value={row.lastName}
                onChange={(e) =>
                  replaceGuarantorRow(index, {
                    ...row,
                    lastName: e.target.value.slice(0, 100),
                  })
                }
                placeholder="Last name"
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-ic`} className={formLabelClassName}>
              IC number
            </Label>
            <Input
              id={`g-${index}-ic`}
              value={row.icNumber}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  icNumber: e.target.value.slice(0, 30),
                })
              }
              placeholder="e.g. 901212-10-1234"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label className={formLabelClassName}>Relationship</Label>
            <Select
              value={row.relationship || undefined}
              disabled={readOnly}
              onValueChange={(v) =>
                replaceGuarantorRow(index, {
                  ...row,
                  relationship: v as GuarantorIndividualRelationship,
                })
              }
            >
              <SelectTrigger
                className={cn(
                  formSelectTriggerClassName,
                  "w-full",
                  readOnly && formInputDisabledClassName
                )}
              >
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {GUARANTOR_INDIVIDUAL_RELATIONSHIPS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-co`} className={formLabelClassName}>
              Company name
            </Label>
            <Input
              id={`g-${index}-co`}
              value={row.companyName}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  companyName: e.target.value.slice(0, 200),
                })
              }
              placeholder="e.g. ABC Holdings Sdn Bhd"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-ssm`} className={formLabelClassName}>
              SSM number
            </Label>
            <Input
              id={`g-${index}-ssm`}
              value={row.ssmNumber}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  ssmNumber: e.target.value.slice(0, 50),
                })
              }
              placeholder="e.g. 1234567-X123456"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label className={formLabelClassName}>Relationship</Label>
            <Select
              value={row.relationship || undefined}
              disabled={readOnly}
              onValueChange={(v) =>
                replaceGuarantorRow(index, {
                  ...row,
                  relationship: v as GuarantorCompanyRelationship,
                })
              }
            >
              <SelectTrigger
                className={cn(
                  formSelectTriggerClassName,
                  "w-full",
                  readOnly && formInputDisabledClassName
                )}
              >
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {GUARANTOR_COMPANY_RELATIONSHIPS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {GUARANTOR_COMPANY_RELATIONSHIP_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

export function BusinessDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: BusinessDetailsStepProps) {
  const { getAccessToken } = useAuthToken();
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const devTools = useDevTools();

  const [aboutYourBusiness, setAboutYourBusiness] = React.useState<AboutYourBusiness>(defaultAbout);
  const [whyRaisingFunds, setWhyRaisingFunds] = React.useState<WhyRaisingFunds>(defaultWhy);
  const [declarationConfirmed, setDeclarationConfirmed] = React.useState(false);
  const [guarantors, setGuarantors] = React.useState<GuarantorFormRow[]>([emptyIndividualGuarantor()]);
  const [pendingSupportingDocuments, setPendingSupportingDocuments] = React.useState<
    Array<{ file: File; client_id: string }>
  >([]);
  const [initialWhySupportingDocuments, setInitialWhySupportingDocuments] = React.useState<
    WhySupportingDocument[]
  >([]);
  /** Collapsible guarantor cards; index 0 defaults open until user toggles. */
  const [guarantorPanelOpen, setGuarantorPanelOpen] = React.useState<Record<number, boolean>>({});

  const [isInitialized, setIsInitialized] = React.useState(false);
  const initialPayloadRef = React.useRef<string>("");

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    setGuarantorPanelOpen((prev) => {
      const next: Record<number, boolean> = {};
      for (let i = 0; i < guarantors.length; i++) {
        if (prev[i] !== undefined) next[i] = prev[i]!;
      }
      return next;
    });
  }, [guarantors.length]);

  const validateBusinessDetails = React.useCallback(() => {
    const { whatDoesCompanyDo, mainCustomers, singleCustomerOver50Revenue } = aboutYourBusiness;
    const {
      financingFor,
      howFundsUsed,
      businessPlan,
      risksDelayRepayment,
      backupPlan,
      raisingOnOtherP2P,
      platformName,
      amountRaised,
      sameInvoiceUsed,
      accountingSoftware,
    } = whyRaisingFunds;

    if (
      !whatDoesCompanyDo.trim() ||
      !mainCustomers.trim() ||
      !singleCustomerOver50Revenue.trim() ||
      !financingFor.trim() ||
      !howFundsUsed.trim() ||
      !businessPlan.trim() ||
      !risksDelayRepayment.trim() ||
      !backupPlan.trim() ||
      !raisingOnOtherP2P.trim() ||
      !accountingSoftware.trim() ||
      !declarationConfirmed
    ) {
      return false;
    }

    if (raisingOnOtherP2P === "yes") {
      if (
        !platformName.trim() ||
        !amountRaised.trim() ||
        !sameInvoiceUsed.trim()
      ) {
        return false;
      }
      if (sameInvoiceUsed === "yes") {
        return false;
      }
    }

    /* At least one guarantor; each row must be complete (applies to every added guarantor). */
    if (guarantors.length < 1) return false;
    for (const g of guarantors) {
      if (g.guarantorType === "individual") {
        if (
          !g.firstName.trim() ||
          !g.lastName.trim() ||
          !g.icNumber.trim() ||
          !g.relationship ||
          !GUARANTOR_INDIVIDUAL_RELATIONSHIPS.includes(g.relationship as GuarantorIndividualRelationship)
        ) {
          return false;
        }
      } else {
        if (
          !g.companyName.trim() ||
          !g.ssmNumber.trim() ||
          !g.relationship ||
          !GUARANTOR_COMPANY_RELATIONSHIPS.includes(g.relationship as GuarantorCompanyRelationship)
        ) {
          return false;
        }
      }
    }

    return true;
  }, [aboutYourBusiness, whyRaisingFunds, declarationConfirmed, guarantors]);

  React.useEffect(() => {
    if (application === undefined || isInitialized) return;

    const saved = application?.business_details;
    const initial = fromSnakeSaved(saved);
    setAboutYourBusiness(initial.aboutYourBusiness);
    setWhyRaisingFunds({
      ...initial.whyRaisingFunds,
      amountRaised: initial.whyRaisingFunds.amountRaised,
    });
    setDeclarationConfirmed(initial.declarationConfirmed);
    setGuarantors(initial.guarantors);
    setPendingSupportingDocuments([]);
    setInitialWhySupportingDocuments(initial.whyRaisingFunds.supportingDocuments);
    initialPayloadRef.current = JSON.stringify(toSnakePayload(initial));
    setIsInitialized(true);
  }, [application, isInitialized]);

  /* Reset P2P fields when user selects "no". */
  React.useEffect(() => {
    if (whyRaisingFunds.raisingOnOtherP2P === "no") {
      setWhyRaisingFunds((prev) => ({
        ...prev,
        platformName: "",
        amountRaised: "",
        sameInvoiceUsed: "",
      }));
    }
  }, [whyRaisingFunds.raisingOnOtherP2P]);

  /** Apply dev-tools Auto Fill when requested (single step or Fill Entire Application). */
  React.useEffect(() => {
    const data =
      devTools?.autoFillData?.stepKey === "business_details"
        ? (devTools.autoFillData.data as Record<string, unknown>)
        : (devTools?.autoFillDataMap?.["business_details"] as Record<string, unknown> | undefined);
    if (!data || Object.keys(data).length === 0) return;
    const initial = fromSnakeSaved(data);
    setAboutYourBusiness(initial.aboutYourBusiness);
    setWhyRaisingFunds(initial.whyRaisingFunds);
    setDeclarationConfirmed(initial.declarationConfirmed);
    setGuarantors(initial.guarantors);
    setPendingSupportingDocuments([]);
    setInitialWhySupportingDocuments(initial.whyRaisingFunds.supportingDocuments);
    initialPayloadRef.current = JSON.stringify(toSnakePayload(initial));
    if (devTools) {
      if (devTools.autoFillData?.stepKey === "business_details") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("business_details");
    }
  }, [devTools]);

  const payload: BusinessDetailsPayload = React.useMemo(
    () => ({
      aboutYourBusiness,
      whyRaisingFunds,
      declarationConfirmed,
      guarantors,
    }),
    [aboutYourBusiness, whyRaisingFunds, declarationConfirmed, guarantors]
  );

  const snakePayload = React.useMemo(() => toSnakePayload(payload), [payload]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    return JSON.stringify(snakePayload) !== initialPayloadRef.current || pendingSupportingDocuments.length > 0;
  }, [snakePayload, isInitialized, pendingSupportingDocuments.length]);
  const hasRemovedSupportingDocuments = React.useMemo(() => {
    const initialKeys = new Set(
      initialWhySupportingDocuments
        .map((doc) => doc.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    const currentKeys = new Set(
      whyRaisingFunds.supportingDocuments
        .map((doc) => doc.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    for (const key of initialKeys) {
      if (!currentKeys.has(key)) return true;
    }
    return false;
  }, [initialWhySupportingDocuments, whyRaisingFunds.supportingDocuments]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;

    /**
     * What: Provide canonical validation flag to parent.
     * Why: Parent `EditApplicationPage` expects `isValid` to determine
     *       whether the "Save and Continue" button is enabled.
     * Data: snakePayload includes declaration_confirmed; isValid for step validity.
     */
    onDataChangeRef.current({
      ...snakePayload,
      hasPendingChanges,
      isValid: validateBusinessDetails(),
      saveFunction:
        pendingSupportingDocuments.length > 0 || hasRemovedSupportingDocuments
          ? uploadWhySectionSupportingDocuments
          : undefined,
    });
  }, [
    snakePayload,
    hasPendingChanges,
    declarationConfirmed,
    isInitialized,
    pendingSupportingDocuments.length,
    hasRemovedSupportingDocuments,
    validateBusinessDetails,
  ]);

  if (isLoadingApp || !isInitialized || devTools?.showSkeletonDebug) {
    return <BusinessDetailsSkeleton />;
  }

  const sameInvoiceP2pBlocked =
    whyRaisingFunds.raisingOnOtherP2P === "yes" && whyRaisingFunds.sameInvoiceUsed === "yes";
  const fieldsLocked = readOnly || sameInvoiceP2pBlocked;

  const replaceGuarantorRow = (index: number, next: GuarantorFormRow) => {
    setGuarantors((prev) => prev.map((row, i) => (i === index ? next : row)));
  };

  const setGuarantorTypeAt = (index: number, type: "individual" | "company") => {
    replaceGuarantorRow(index, type === "individual" ? emptyIndividualGuarantor() : emptyCompanyGuarantor());
  };

  async function uploadWhySectionSupportingDocuments() {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Authentication required to upload supporting documents.");
    }

    const uploadedByClientId = new Map<
      string,
      { s3_key: string; file_name: string; file_size: number; uploaded_at: string }
    >();

    if (pendingSupportingDocuments.length > 0) {
      for (const pending of pendingSupportingDocuments) {
        const presignRes = await fetch(`${API_URL}/v1/applications/${applicationId}/upload-document-url`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fileName: pending.file.name,
            contentType: pending.file.type || "application/octet-stream",
            fileSize: pending.file.size,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(`Failed to prepare upload for ${pending.file.name}`);
        }

        const presignJson = await presignRes.json();
        const uploadUrl = String(presignJson?.data?.uploadUrl ?? "");
        const s3Key = String(presignJson?.data?.s3Key ?? "");
        if (!uploadUrl || !s3Key) {
          throw new Error(`Invalid upload response for ${pending.file.name}`);
        }

        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Type": pending.file.type || "application/octet-stream",
          },
          body: pending.file,
        });

        if (!putRes.ok) {
          throw new Error(`Failed to upload ${pending.file.name}`);
        }

        uploadedByClientId.set(pending.client_id, {
          s3_key: s3Key,
          file_name: pending.file.name,
          file_size: pending.file.size,
          uploaded_at: new Date().toISOString(),
        });
      }
    }

    const nextWhyRaisingFunds: WhyRaisingFunds = {
      ...whyRaisingFunds,
      supportingDocuments: whyRaisingFunds.supportingDocuments.map((doc) => {
        if (!doc.client_id) return doc;
        const uploaded = uploadedByClientId.get(doc.client_id);
        if (!uploaded) return doc;
        return {
          ...doc,
          ...uploaded,
          client_id: undefined,
        };
      }),
    };

    const previousKeys = new Set(
      initialWhySupportingDocuments
        .map((doc) => doc.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    const nextKeys = new Set(
      nextWhyRaisingFunds.supportingDocuments
        .map((doc) => doc.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    const keysToDelete = Array.from(previousKeys).filter((key) => !nextKeys.has(key));
    for (const s3Key of keysToDelete) {
      const deleteRes = await fetch(`${API_URL}/v1/applications/${applicationId}/document`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ s3Key }),
      });
      const deleteJson = await deleteRes.json().catch(() => null);
      if (!deleteRes.ok || !deleteJson?.success) {
        throw new Error(
          typeof deleteJson?.error?.message === "string"
            ? deleteJson.error.message
            : "Failed to delete removed document from storage."
        );
      }
    }

    setWhyRaisingFunds(nextWhyRaisingFunds);
    setPendingSupportingDocuments([]);
    setInitialWhySupportingDocuments(nextWhyRaisingFunds.supportingDocuments);

    const nextPayload = toSnakePayload({
      aboutYourBusiness,
      whyRaisingFunds: nextWhyRaisingFunds,
      declarationConfirmed,
      guarantors,
    });
    initialPayloadRef.current = JSON.stringify(nextPayload);
    return nextPayload;
  }

  const handleWhySectionSupportingDocumentsSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    for (const file of files) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large (max 5MB)");
        return;
      }
    }

    const pendingBatch = files.map((file) => {
      const client_id = makeClientId();
      return { file, client_id };
    });

    setPendingSupportingDocuments((prev) => [...prev, ...pendingBatch]);
    setWhyRaisingFunds((prev) => ({
      ...prev,
      supportingDocuments: [
        ...prev.supportingDocuments,
        ...pendingBatch.map((p) => ({
          file_name: p.file.name,
          file_size: p.file.size,
          uploaded_at: new Date().toISOString(),
          client_id: p.client_id,
        })),
      ],
    }));

    e.currentTarget.value = "";
  };

  const removeWhySectionSupportingDocumentAt = (index: number) => {
    setWhyRaisingFunds((prev) => {
      const target = prev.supportingDocuments[index];
      if (target?.client_id) {
        setPendingSupportingDocuments((pendingPrev) =>
          pendingPrev.filter((pending) => pending.client_id !== target.client_id)
        );
      }
      return {
        ...prev,
        supportingDocuments: prev.supportingDocuments.filter((_, i) => i !== index),
      };
    });
  };

  return (
    <>
      <div className={formOuterClassName}>
        {/* ===================== ABOUT YOUR BUSINESS ===================== */}
        <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={cn(applicationFlowSectionTitleClassName, "shrink-0")}>About your business</h3>
            <InvestorVisibilityBadge />
          </div>
          <div className={applicationFlowSectionDividerClassName} />
        </div>

        <div
          className={cn(
            rowGridClassName,
            sameInvoiceP2pBlocked && "pointer-events-none opacity-50 select-none"
          )}
        >
          <Label htmlFor="what-does-company-do" className={labelClassName}>
            What does your company do?
          </Label>
          <TextareaWithCharCount
            id="what-does-company-do"
            value={aboutYourBusiness.whatDoesCompanyDo}
            onChange={(e) =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                whatDoesCompanyDo: e.target.value.slice(0, 200),
              }))
            }
            placeholder="Add details"
            maxLength={200}
            className={textareaClassName}
            countLabel={`${aboutYourBusiness.whatDoesCompanyDo.length}/200 characters`}
            disabled={fieldsLocked}
          />

          <Label htmlFor="main-customers" className={labelClassName}>
            Who are your main customers?
          </Label>
          <TextareaWithCharCount
            id="main-customers"
            value={aboutYourBusiness.mainCustomers}
            onChange={(e) =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                mainCustomers: e.target.value.slice(0, 200),
              }))
            }
            placeholder="Add details"
            maxLength={200}
            className={textareaClassName}
            countLabel={`${aboutYourBusiness.mainCustomers.length}/200 characters`}
            disabled={fieldsLocked}
          />

          <Label className={labelClassName}>
            Does any single customer make up more than 50% of your revenue?
          </Label>
          <div className={radioGridControlClassName}>
            <YesNoRadioGroup
              name="singleCustomerOver50Revenue"
              value={aboutYourBusiness.singleCustomerOver50Revenue}
              onValueChange={(v) =>
                setAboutYourBusiness((prev) => ({ ...prev, singleCustomerOver50Revenue: v }))
              }
              disabled={fieldsLocked}
            />
          </div>

          <Label htmlFor="accounting-software" className={labelClassName}>
            Which accounting software does the issuer use?
          </Label>
          <Input
            id="accounting-software"
            value={whyRaisingFunds.accountingSoftware}
            onChange={(e) =>
              setWhyRaisingFunds((prev) => ({
                ...prev,
                accountingSoftware: e.target.value,
              }))
            }
            placeholder="e.g. QuickBooks, Xero, SAP"
            className={cn(inputClassName, fieldsLocked && formInputDisabledClassName)}
            disabled={fieldsLocked}
          />
        </div>
      </section>

      {/* ===================== WHY ARE YOU RAISING FUNDS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={cn(applicationFlowSectionTitleClassName, "shrink-0")}>Why are you raising funds?</h3>
            <InvestorVisibilityBadge />
          </div>
          <div className={applicationFlowSectionDividerClassName} />
        </div>

        <div className={rowGridClassName}>
          <div
            className={cn(
              "contents",
              sameInvoiceP2pBlocked && "[&>*]:pointer-events-none [&>*]:opacity-50 [&>*]:select-none"
            )}
          >
            <Label htmlFor="financing-for" className={labelClassName}>
              What is this financing for?
            </Label>
            <TextareaWithCharCount
              id="financing-for"
              value={whyRaisingFunds.financingFor}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  financingFor: e.target.value.slice(0, 200),
                }))
              }
              placeholder="Add details"
              maxLength={200}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.financingFor.length}/200 characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="how-funds-used" className={labelClassName}>
              How will the funds be used?
            </Label>
            <TextareaWithCharCount
              id="how-funds-used"
              value={whyRaisingFunds.howFundsUsed}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  howFundsUsed: e.target.value.slice(0, 200),
                }))
              }
              placeholder="Add details"
              maxLength={200}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.howFundsUsed.length}/200 characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="business-plan" className={labelClassName}>
              Tell us about your business plan
            </Label>
            <TextareaWithCharCount
              id="business-plan"
              value={whyRaisingFunds.businessPlan}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  businessPlan: e.target.value.slice(0, 1000),
                }))
              }
              placeholder="Add details"
              maxLength={1000}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.businessPlan.length}/1000 characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="risks-delay-repayment" className={labelClassName}>
              Are there any risks that may delay repayment of your invoices?
            </Label>
            <TextareaWithCharCount
              id="risks-delay-repayment"
              value={whyRaisingFunds.risksDelayRepayment}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  risksDelayRepayment: e.target.value.slice(0, 200),
                }))
              }
              placeholder="Add details"
              maxLength={200}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.risksDelayRepayment.length}/200 characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="backup-plan" className={labelClassName}>
              If payment is delayed, what is your backup plan?
            </Label>
            <TextareaWithCharCount
              id="backup-plan"
              value={whyRaisingFunds.backupPlan}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  backupPlan: e.target.value.slice(0, 200),
                }))
              }
              placeholder="Add details"
              maxLength={200}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.backupPlan.length}/200 characters`}
              disabled={fieldsLocked}
            />
          </div>

          <Label className={labelClassName}>
            Upload any relevant supporting documents for this section
          </Label>
          <div className="min-w-0 space-y-3">
            {whyRaisingFunds.supportingDocuments.length > 0 ? (
              <div className="flex flex-col gap-2">
                {whyRaisingFunds.supportingDocuments.map((doc, index) => (
                  <div
                    key={`${doc.s3_key ?? doc.client_id ?? doc.file_name}-${index}`}
                    className={cn(
                      "rounded-xl border px-4 py-3 flex items-center justify-between gap-3 min-h-11",
                      fieldsLocked
                        ? formLockedFileSurfaceClassName
                        : "border-border bg-card/50 text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border",
                          fieldsLocked
                            ? "border-border bg-background/50"
                            : doc.client_id
                              ? "border-transparent bg-yellow-500/10"
                              : "border-transparent bg-primary/10"
                        )}
                      >
                        <CheckCircle2
                          className={cn(
                            "h-4 w-4",
                            fieldsLocked
                              ? "text-muted-foreground"
                              : doc.client_id
                                ? "text-yellow-500"
                                : "text-primary"
                          )}
                        />
                      </div>
                      <div className="min-w-0 flex-1" title={doc.file_name}>
                        <div className="text-sm font-medium truncate">{doc.file_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatFileSize(Math.max(doc.file_size ?? 0, 0))}
                        </div>
                      </div>
                    </div>
                    {!fieldsLocked ? (
                      <button
                        type="button"
                        onClick={() => removeWhySectionSupportingDocumentAt(index)}
                        className="p-1 hover:bg-muted rounded-full transition-colors"
                        aria-label={`Remove ${doc.file_name}`}
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {!fieldsLocked && (
                  <label htmlFor="why-section-supporting-documents" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors border-border bg-card/50 hover:bg-muted/50">
                      <div className="p-2 rounded-full bg-background border shadow-sm">
                        <CloudUpload className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="text-center">
                        <span className="text-base font-semibold text-primary">Add files</span>
                      </div>
                      <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>
                    </div>
                    <Input
                      id="why-section-supporting-documents"
                      type="file"
                      accept="application/pdf"
                      multiple
                      onChange={handleWhySectionSupportingDocumentsSelected}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            ) : fieldsLocked ? (
              <span className="text-[14px] text-muted-foreground">—</span>
            ) : (
              <label
                htmlFor="why-section-supporting-documents"
                className="cursor-pointer"
              >
                <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors border-border bg-card/50 hover:bg-muted/50">
                  <div className="p-2 rounded-full bg-background border shadow-sm">
                    <CloudUpload className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <span className="text-base font-semibold text-primary">Click to upload</span>
                    <span className="text-base text-muted-foreground"> or drag and drop</span>
                  </div>
                  <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>
                </div>
                <Input
                  id="why-section-supporting-documents"
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={handleWhySectionSupportingDocumentsSelected}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <Label className={labelClassName}>
            Are you currently raising/applying funds on any other P2P platforms?
          </Label>
          <div className={radioGridControlClassName}>
            <YesNoRadioGroup
              name="raisingOnOtherP2P"
              value={whyRaisingFunds.raisingOnOtherP2P}
              onValueChange={(v) =>
                setWhyRaisingFunds((prev) => ({ ...prev, raisingOnOtherP2P: v }))
              }
              disabled={readOnly}
            />
          </div>

          {whyRaisingFunds.raisingOnOtherP2P === "yes" && (
            <>
              <Label htmlFor="platform-name" className={labelClassName}>
                Name of platform
              </Label>
              <Input
                id="platform-name"
                value={whyRaisingFunds.platformName}
                onChange={(e) =>
                  setWhyRaisingFunds((prev) => ({
                    ...prev,
                    platformName: e.target.value,
                  }))
                }
                placeholder="e.g. CAPBAY"
                className={cn(
                  inputClassName,
                  (readOnly || sameInvoiceP2pBlocked) && formInputDisabledClassName
                )}
                disabled={readOnly || sameInvoiceP2pBlocked}
              />

              <Label htmlFor="amount-raised" className={labelClassName}>
                Amount raised
              </Label>
              <div className="h-11 flex items-center">
                <div className="relative w-full h-full flex items-center">
                  <div className="absolute left-4 inset-y-0 flex items-center text-muted-foreground font-medium text-sm pointer-events-none">
                    RM
                  </div>
                  <MoneyInput
                    value={whyRaisingFunds.amountRaised}
                    onValueChange={(v) =>
                      setWhyRaisingFunds((prev) => ({
                        ...prev,
                        amountRaised: v,
                      }))
                    }
                    placeholder="0.00"
                    prefix="RM"
                    inputClassName={cn(
                      inputClassName,
                      "pl-12",
                      (readOnly || sameInvoiceP2pBlocked) && formInputDisabledClassName
                    )}
                    disabled={readOnly || sameInvoiceP2pBlocked}
                  />
                </div>
              </div>

              <Label className={labelClassName}>
                Have the same invoices been used to apply for funding in the aforementioned platform?
              </Label>
              <div className="min-w-0 space-y-2 self-center w-full">
                <div className={radioGridControlClassName}>
                  <YesNoRadioGroup
                    name="sameInvoiceUsed"
                    value={whyRaisingFunds.sameInvoiceUsed}
                    onValueChange={(v) =>
                      setWhyRaisingFunds((prev) => ({ ...prev, sameInvoiceUsed: v }))
                    }
                    disabled={readOnly}
                  />
                </div>
                {whyRaisingFunds.sameInvoiceUsed === "yes" && (
                  <p className="text-sm text-destructive" role="alert">
                    {SAME_INVOICE_OTHER_P2P_ERROR}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ===================== GUARANTOR DETAILS ===================== */}
      <section
        className={cn(
          sectionWrapperClassName,
          "space-y-5",
          sameInvoiceP2pBlocked && "opacity-50"
        )}
      >
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <h3 className={applicationFlowSectionTitleClassName}>Guarantor details</h3>
            <Button
              type="button"
              variant="default"
              className="shrink-0 w-full sm:w-auto"
              disabled={fieldsLocked}
              onClick={() => setGuarantors((prev) => [...prev, emptyIndividualGuarantor()])}
            >
              + Add guarantor
            </Button>
          </div>
          <div className={applicationFlowSectionDividerClassName} />
        </div>

        <div className="flex flex-col gap-8 px-3">
          {guarantors.map((row, index) => {
            const removeButton = (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive justify-start sm:justify-center px-0 sm:px-3"
                disabled={fieldsLocked || guarantors.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setGuarantors((prev) =>
                    prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
                  );
                }}
              >
                <TrashIcon className="h-4 w-4 mr-1" aria-hidden />
                Remove
              </Button>
            );

            const fields = (
              <GuarantorCardFields
                row={row}
                index={index}
                readOnly={fieldsLocked}
                replaceGuarantorRow={replaceGuarantorRow}
                setGuarantorTypeAt={setGuarantorTypeAt}
              />
            );

            const subtitle = guarantorCardSummarySubtitle(row);
            const panelOpen =
              guarantorPanelOpen[index] !== undefined ? guarantorPanelOpen[index]! : index === 0;

            return (
              <details
                key={index}
                className="group rounded-xl border border-border bg-background"
                open={panelOpen}
                onToggle={(e) => {
                  const d = e.currentTarget;
                  setGuarantorPanelOpen((p) => ({ ...p, [index]: d.open }));
                }}
              >
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-2 px-4 sm:px-5 py-4 border-b border-border">
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <span className="shrink-0 text-base font-semibold text-foreground">
                        Guarantor {index + 1}
                      </span>
                      <ChevronRightIcon
                        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                        aria-hidden
                      />
                      {subtitle ? (
                        <span className="min-w-0 truncate text-sm text-muted-foreground">
                          {subtitle}
                        </span>
                      ) : null}
                    </div>
                    {removeButton}
                  </div>
                </summary>
                <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-4">{fields}</div>
              </details>
            );
          })}
        </div>

        {/* Secondary add control — same handler as header; hidden until product wants dashed CTA again. */}
        <button
          type="button"
          className={cn(
            "hidden w-full rounded-xl border border-dashed border-border bg-muted/20 py-3 text-sm font-semibold text-foreground",
            fieldsLocked ? "opacity-50 pointer-events-none" : "hover:bg-muted/40 cursor-pointer"
          )}
          disabled={fieldsLocked}
          onClick={() => setGuarantors((prev) => [...prev, emptyIndividualGuarantor()])}
        >
          + Add another guarantor
        </button>
      </section>

      {/* ===================== DECLARATIONS ===================== */}
      <section
        className={cn(
          sectionWrapperClassName,
          "space-y-5",
          sameInvoiceP2pBlocked && "opacity-50"
        )}
      >
        <div>
          <h3 className={applicationFlowSectionTitleClassName}>Declarations</h3>
          <div className={applicationFlowSectionDividerClassName} />
        </div>

        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <label
            className={cn(
              "flex items-start gap-3",
              fieldsLocked ? "cursor-not-allowed" : "cursor-pointer"
            )}
          >
            <Checkbox
              checked={declarationConfirmed}
              onCheckedChange={(checked) => setDeclarationConfirmed(checked === true)}
              disabled={fieldsLocked}
              className={cn(
                "mt-0.5 rounded-[4px]",
                fieldsLocked &&
                  "disabled:opacity-100 data-[state=checked]:bg-muted data-[state=checked]:border-muted-foreground data-[state=checked]:text-muted-foreground"
              )}
            />
            <span className="text-sm md:text-base leading-6 text-foreground">
              {DECLARATION_TEXT}
            </span>
          </label>
        </div>
      </section>
      </div>
    </>
  );

}
