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
import { Checkbox } from "@/components/ui/checkbox";
import { TextareaWithCharCount } from "@/components/textarea-with-char-count";
import { cn } from "@/lib/utils";
import {
  applicationFlowLabelCellAlignInputClassName,
  applicationFlowLabelCellAlignTopClassName,
  applicationFlowRadioRowControlClassName,
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
import { FileDisplayBadge } from "@/app/(application-flow)/applications/components/file-display-badge";
import { GuarantorNationalityAutocomplete } from "@/app/(application-flow)/applications/components/guarantor-nationality-autocomplete";
import { generateBusinessDetailsData } from "@/app/(application-flow)/applications/utils/dev-data-generator";
import {
  clampGuarantorIcInput,
  isValidMalaysianNric,
  malaysianNricDigits,
} from "@/app/(application-flow)/applications/utils/malaysian-nric";
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
  ArrowDownTrayIcon,
  ChevronRightIcon,
  CloudArrowUpIcon,
  DocumentIcon,
  EyeIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { CloudUpload, X, CheckCircle2 } from "lucide-react";
import { useAuthToken } from "@cashsouk/config";
import { isRegtankIso3166Code } from "@cashsouk/types";
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

const GUARANTOR_EMAIL_STRICT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** “What does your company do?” and “Business plan” share the longer limit; other business textareas use the shorter limit. */
const MAX_CHARS_WHAT_COMPANY_DO = 1000;
const MAX_CHARS_BUSINESS_PLAN = 1000;
const MAX_CHARS_OTHER_BUSINESS_TEXTAREA = 400;

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

/** Signed agreement file per guarantor (optional unless product supplies a template). */
interface GuarantorAgreementFile {
  file_name: string;
  file_size: number;
  s3_key?: string;
  uploaded_at?: string;
  client_id?: string;
}

interface GuarantorIndividualRow {
  referenceId: string;
  guarantorType: "individual";
  name: string;
  icNumber: string;
  /** RegTank appendix A ISO 3166 alpha-2 (e.g. MY). */
  nationality: string;
  email: string;
  guarantorAgreement?: GuarantorAgreementFile;
}

interface GuarantorCompanyRow {
  referenceId: string;
  guarantorType: "company";
  businessName: string;
  ssmNumber: string;
  email: string;
  guarantorAgreement?: GuarantorAgreementFile;
}

type GuarantorFormRow = GuarantorIndividualRow | GuarantorCompanyRow;

function guarantorCardSummarySubtitle(row: GuarantorFormRow): string {
  if (row.guarantorType === "individual") {
    return row.name.trim();
  }
  return row.businessName.trim();
}

function emptyIndividualGuarantor(): GuarantorIndividualRow {
  return {
    referenceId: makeClientId(),
    guarantorType: "individual",
    name: "",
    icNumber: "",
    nationality: "",
    email: "",
  };
}

function emptyCompanyGuarantor(): GuarantorCompanyRow {
  return {
    referenceId: makeClientId(),
    guarantorType: "company",
    businessName: "",
    ssmNumber: "",
    email: "",
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
        reference_id: string;
        guarantor_type: "individual";
        email: string;
        name: string;
        ic_number: string;
        nationality: string;
        guarantor_agreement?: {
          file_name: string;
          file_size: number;
          s3_key: string;
          uploaded_at?: string;
        };
      }
    | {
        reference_id: string;
        guarantor_type: "company";
        email: string;
        business_name: string;
        ssm_number: string;
        guarantor_agreement?: {
          file_name: string;
          file_size: number;
          s3_key: string;
          uploaded_at?: string;
        };
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

function normalizeIdentifier(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function stableFallbackGuarantorId(
  index: number,
  type: "individual" | "company",
  identifier: string
): string {
  const token = identifier.replace(/[^A-Za-z0-9]+/g, "").toLowerCase() || `idx${index + 1}`;
  return `g-${type}-${token}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function parseGuarantorAgreementFromUnknown(raw: unknown): GuarantorAgreementFile | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const file_name = String(o.file_name ?? o.fileName ?? "").trim();
  if (!file_name) return undefined;
  const s3 =
    typeof o.s3_key === "string"
      ? o.s3_key
      : typeof o.s3Key === "string"
        ? o.s3Key
        : undefined;
  return {
    file_name,
    file_size: Number(o.file_size ?? o.fileSize ?? 0),
    ...(s3?.trim() ? { s3_key: s3.trim() } : {}),
    uploaded_at:
      typeof o.uploaded_at === "string"
        ? o.uploaded_at
        : typeof o.uploadedAt === "string"
          ? o.uploadedAt
          : undefined,
    client_id:
      typeof o.client_id === "string"
        ? o.client_id
        : typeof o.clientId === "string"
          ? o.clientId
          : undefined,
  };
}

function normalizeGuarantorNationalityCode(raw: unknown): string {
  const c = String(raw ?? "")
    .trim()
    .toUpperCase();
  return c.length === 2 && isRegtankIso3166Code(c) ? c : "";
}

function legacyIndividualNameFromRecord(o: Record<string, unknown>): string {
  const direct = String(o.name ?? o.full_name ?? o.fullName ?? "").trim();
  if (direct) return direct;
  const first = String(o.first_name ?? o.firstName ?? "").trim();
  const last = String(o.last_name ?? o.lastName ?? "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

/** Map DB `application_guarantors` row (+ optional JSON source_data) into issuer form row. */
function applicationGuarantorRowToFormRow(row: Record<string, unknown>): GuarantorFormRow | null {
  const src =
    row.source_data && typeof row.source_data === "object" && !Array.isArray(row.source_data)
      ? (row.source_data as Record<string, unknown>)
      : {};
  const ref = String(row.client_guarantor_id ?? src.client_guarantor_id ?? "").trim();
  const email = String(row.email ?? src.email ?? "").trim().toLowerCase();
  if (!email) return null;
  const gt = row.guarantor_type === "company" || src.guarantor_type === "company" ? "company" : "individual";
  const pos = typeof row.position === "number" ? row.position : 0;
  const agreement =
    parseGuarantorAgreementFromUnknown(src.guarantor_agreement ?? src.guarantorAgreement) ??
    parseGuarantorAgreementFromUnknown(row.guarantor_agreement);

  if (gt === "company") {
    const ssm = String(row.ssm_number ?? src.ssm_number ?? src.ssmNumber ?? "").trim();
    const businessName = String(
      row.business_name ?? src.business_name ?? src.businessName ?? src.company_name ?? src.companyName ?? ""
    ).trim();
    return {
      referenceId: ref || stableFallbackGuarantorId(pos, "company", normalizeIdentifier(ssm)),
      guarantorType: "company",
      businessName,
      ssmNumber: ssm,
      email,
      ...(agreement ? { guarantorAgreement: agreement } : {}),
    };
  }

  const icRaw = String(row.ic_number ?? src.ic_number ?? src.icNumber ?? "");
  const name = String(row.name ?? src.name ?? legacyIndividualNameFromRecord(src)).trim();
  const nationality = normalizeGuarantorNationalityCode(
    row.nationality ?? src.nationality ?? src.nationality_code ?? row.nationality_code
  );
  return {
    referenceId: ref || stableFallbackGuarantorId(pos, "individual", normalizeIdentifier(icRaw)),
    guarantorType: "individual",
    name,
    icNumber: clampGuarantorIcInput(icRaw),
    nationality,
    email,
    ...(agreement ? { guarantorAgreement: agreement } : {}),
  };
}

function guarantorsFromRelationalRows(rows: unknown): GuarantorFormRow[] {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const out: GuarantorFormRow[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const mapped = applicationGuarantorRowToFormRow(raw as Record<string, unknown>);
    if (mapped) out.push(mapped);
  }
  return out;
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
    guarantors: p.guarantors.map((g) => {
      const agreementSnake =
        g.guarantorAgreement &&
        typeof g.guarantorAgreement.s3_key === "string" &&
        g.guarantorAgreement.s3_key.trim() !== ""
          ? {
              file_name: g.guarantorAgreement.file_name,
              file_size: g.guarantorAgreement.file_size ?? 0,
              s3_key: g.guarantorAgreement.s3_key.trim(),
              ...(g.guarantorAgreement.uploaded_at
                ? { uploaded_at: g.guarantorAgreement.uploaded_at }
                : {}),
            }
          : undefined;
      if (g.guarantorType === "individual") {
        return {
          reference_id: g.referenceId,
          guarantor_type: "individual" as const,
          email: g.email.trim().toLowerCase(),
          name: g.name.trim(),
          ic_number: malaysianNricDigits(g.icNumber),
          nationality: g.nationality.trim().toUpperCase(),
          ...(agreementSnake ? { guarantor_agreement: agreementSnake } : {}),
        };
      }
      return {
        reference_id: g.referenceId,
        guarantor_type: "company" as const,
        email: g.email.trim().toLowerCase(),
        business_name: g.businessName.trim(),
        ssm_number: g.ssmNumber.trim(),
        ...(agreementSnake ? { guarantor_agreement: agreementSnake } : {}),
      };
    }),
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

function fromSnakeSaved(
  saved: BusinessDetailsSnake | Record<string, unknown> | null | undefined,
  relationalGuarantors?: unknown
): BusinessDetailsPayload {
  const raw = saved as Record<string, unknown>;
  const a = (raw?.about_your_business ?? raw?.aboutYourBusiness) as Record<string, unknown> | undefined;
  const w = (raw?.why_raising_funds ?? raw?.whyRaisingFunds) as Record<string, unknown> | undefined;
  const relational = guarantorsFromRelationalRows(relationalGuarantors ?? []);
  const jsonGuarantors = parseGuarantorsFromRaw(raw?.guarantors);
  const mergedGuarantors = relational.length > 0 ? relational : jsonGuarantors;
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
        ? (w?.supporting_documents ?? w?.supportingDocuments as unknown[]).map((doc: unknown) => {
            const d = doc as Record<string, unknown>;
            return {
            file_name: String(d?.file_name ?? d?.fileName ?? "document.pdf"),
            file_size: Number(d?.file_size ?? d?.fileSize ?? 0),
            s3_key: typeof d?.s3_key === "string" ? d.s3_key : undefined,
            uploaded_at: String(d?.uploaded_at ?? d?.uploadedAt ?? new Date().toISOString()),
          };
          })
        : [],
    },
    declarationConfirmed: raw?.declaration_confirmed ?? raw?.declarationConfirmed ?? false,
    guarantors: mergedGuarantors,
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
    const ref =
      String(o.reference_id ?? o.referenceId ?? o.guarantor_id ?? o.guarantorId ?? "").trim() || "";
    if (gt === "individual") {
      const legacyFirst = String(o.first_name ?? o.firstName ?? "").trim();
      const legacyLast = String(o.last_name ?? o.lastName ?? "").trim();
      const nameFromLegacy = [legacyFirst, legacyLast].filter(Boolean).join(" ").trim();
      const name = String(o.name ?? nameFromLegacy ?? "").trim();
      const govRaw = String(
        o.ic_number ?? o.icNumber ?? o.government_id_number ?? o.governmentIdNumber ?? ""
      );
      const agreement = parseGuarantorAgreementFromUnknown(o.guarantor_agreement ?? o.guarantorAgreement);
      const nationality = normalizeGuarantorNationalityCode(o.nationality ?? o.nationality_code);
      out.push({
        referenceId:
          ref ||
          stableFallbackGuarantorId(out.length, "individual", normalizeIdentifier(govRaw)),
        guarantorType: "individual",
        email: String(o.email ?? "").trim().toLowerCase(),
        name,
        icNumber: clampGuarantorIcInput(govRaw),
        nationality,
        ...(agreement ? { guarantorAgreement: agreement } : {}),
      });
    } else if (gt === "company") {
      const bizId = String(o.ssm_number ?? o.ssmNumber ?? o.business_id_number ?? o.businessIdNumber ?? "");
      const agreement = parseGuarantorAgreementFromUnknown(o.guarantor_agreement ?? o.guarantorAgreement);
      out.push({
        referenceId:
          ref ||
          stableFallbackGuarantorId(out.length, "company", normalizeIdentifier(bizId)),
        guarantorType: "company",
        email: String(o.email ?? "").trim().toLowerCase(),
        businessName: String(o.business_name ?? o.businessName ?? o.company_name ?? o.companyName ?? ""),
        ssmNumber: bizId,
        ...(agreement ? { guarantorAgreement: agreement } : {}),
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
  /** Business & guarantor step config from the active product workflow (e.g. guarantor agreement template). */
  stepConfig?: Record<string, unknown>;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

/** Match supporting-documents-step.tsx action links (guarantor agreement row). */
const supportingDocActionLink =
  "inline-flex items-center justify-start gap-1.5 text-sm font-medium leading-tight whitespace-nowrap rounded-md px-0.5 py-1 -mx-0.5 w-full min-w-0";
const supportingDocTemplateOn =
  "text-muted-foreground hover:text-foreground cursor-pointer";
const supportingDocUploadOn = "text-primary hover:opacity-80 cursor-pointer";
const supportingDocActionOff = "text-muted-foreground cursor-not-allowed select-none";


/** Helpers
 *
 * What: Canonical label + layout behavior.
 * Why: Keep typography consistent while maintaining the left-column alignment used in screenshots.
 * Data: Shared label typography + step-specific alignment utilities.
 */
const labelClassName = cn(formLabelClassName, "font-normal");
const labelInputClassName = cn(labelClassName, applicationFlowLabelCellAlignInputClassName);
const labelTextareaClassName = cn(labelClassName, applicationFlowLabelCellAlignTopClassName);

/**
 * Inputs
 */
const inputClassName = formInputClassName;
const textareaClassName = cn(formTextareaClassName, "min-h-[100px] resize-y");

/**
 * Core form grid
 * Includes px-3 for consistent indentation with other steps
 */
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-8 mt-5 w-full items-start px-3";

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

type GuarantorRowUpdater = GuarantorFormRow | ((prev: GuarantorFormRow) => GuarantorFormRow);

interface GuarantorCardFieldsProps {
  row: GuarantorFormRow;
  index: number;
  readOnly: boolean;
  hasAttemptedSave: boolean;
  replaceGuarantorRow: (index: number, next: GuarantorRowUpdater) => void;
  setGuarantorTypeAt: (index: number, type: "individual" | "company") => void;
  agreementTemplateS3Key?: string;
  agreementRequired: boolean;
  onDownloadAgreementTemplate: () => void | Promise<void>;
  onSelectGuarantorAgreementFile: (file: File) => void;
  onClearGuarantorAgreement: () => void;
}

function GuarantorCardFields({
  row,
  index,
  readOnly,
  hasAttemptedSave,
  replaceGuarantorRow,
  setGuarantorTypeAt,
  agreementTemplateS3Key,
  agreementRequired,
  onDownloadAgreementTemplate,
  onSelectGuarantorAgreementFile,
  onClearGuarantorAgreement,
}: GuarantorCardFieldsProps) {
  const inputClassName = formInputClassName;
  const agreement = row.guarantorAgreement;
  const hasAgreementFile = Boolean(agreement?.s3_key?.trim() || agreement?.client_id);
  const agreementInputId = `g-${index}-guarantor-agreement`;
  const handleNationalityChange = React.useCallback(
    (v: string) => {
      replaceGuarantorRow(index, (prev) => ({ ...prev, nationality: v }));
    },
    [index, replaceGuarantorRow]
  );
  return (
    <div className="space-y-5">
      <div className="space-y-2 w-full min-w-0">
        <Label className={labelInputClassName}>Guarantor type</Label>
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
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-name`} className={labelInputClassName}>
              Name
            </Label>
            <Input
              id={`g-${index}-name`}
              value={row.name}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  name: e.target.value.slice(0, 200),
                })
              }
              placeholder="Full name as per ID"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            {hasAttemptedSave && !row.name.trim() ? (
              <p className="text-xs text-destructive">Required</p>
            ) : null}
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-ic`} className={labelInputClassName}>
              IC number
            </Label>
            <div className="space-y-1 min-h-[48px]">
              <Input
                id={`g-${index}-ic`}
                value={row.icNumber}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    replaceGuarantorRow(index, { ...row, icNumber: "" });
                    return;
                  }
                  if (!/^\d{0,12}$/.test(raw)) return;
                  replaceGuarantorRow(index, { ...row, icNumber: raw });
                }}
                placeholder="e.g. 901212101234"
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                disabled={readOnly}
              />
              <p className="text-xs text-muted-foreground">12 digits</p>
              {hasAttemptedSave && !isValidMalaysianNric(row.icNumber) ? (
                <p className="text-xs text-destructive">IC number must be 12 digits</p>
              ) : null}
            </div>
          </div>
          <GuarantorNationalityAutocomplete
            id={`g-${index}-nationality`}
            nationality={row.nationality}
            readOnly={readOnly}
            hasAttemptedSave={hasAttemptedSave}
            onNationalityChange={handleNationalityChange}
            labelClassName={labelInputClassName}
          />
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-email`} className={labelInputClassName}>
              Email
            </Label>
            <Input
              id={`g-${index}-email`}
              type="email"
              value={row.email}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  email: e.target.value.slice(0, 200),
                })
              }
              placeholder="name@email.com"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            {hasAttemptedSave && !row.email.trim() ? (
              <p className="text-xs text-destructive">Required</p>
            ) : null}
            {hasAttemptedSave &&
            row.email.trim().length > 0 &&
            !GUARANTOR_EMAIL_STRICT.test(row.email.trim()) ? (
              <p className="text-xs text-destructive">Enter a valid email address</p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-biz-name`} className={labelInputClassName}>
              Business name
            </Label>
            <Input
              id={`g-${index}-biz-name`}
              value={row.businessName}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  businessName: e.target.value.slice(0, 200),
                })
              }
              placeholder="e.g. ABC Holdings Sdn Bhd"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            {hasAttemptedSave && !row.businessName.trim() ? (
              <p className="text-xs text-destructive">Required</p>
            ) : null}
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-biz-id`} className={labelInputClassName}>
              SSM number
            </Label>
            <Input
              id={`g-${index}-biz-id`}
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
            {hasAttemptedSave && !row.ssmNumber.trim() ? (
              <p className="text-xs text-destructive">Required</p>
            ) : null}
          </div>
          <div className="space-y-2 w-full min-w-0">
            <Label htmlFor={`g-${index}-email-co`} className={labelInputClassName}>
              Email
            </Label>
            <Input
              id={`g-${index}-email-co`}
              type="email"
              value={row.email}
              onChange={(e) =>
                replaceGuarantorRow(index, {
                  ...row,
                  email: e.target.value.slice(0, 200),
                })
              }
              placeholder="name@email.com"
              className={cn(inputClassName, readOnly && formInputDisabledClassName)}
              disabled={readOnly}
            />
            {hasAttemptedSave && !row.email.trim() ? (
              <p className="text-xs text-destructive">Required</p>
            ) : null}
            {hasAttemptedSave &&
            row.email.trim().length > 0 &&
            !GUARANTOR_EMAIL_STRICT.test(row.email.trim()) ? (
              <p className="text-xs text-destructive">Enter a valid email address</p>
            ) : null}
          </div>
        </>
      )}

      <div className="mt-4 border-t border-border pt-5">
        <div className="rounded-xl border border-border bg-background px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,17rem)_1fr] lg:gap-x-4 lg:items-start">
          <div className="min-w-0 space-y-1.5">
            <div>
              <h3 className={cn(applicationFlowSectionTitleClassName, "leading-snug")}>
                Guarantor Agreement
                {agreementRequired ? (
                  <>
                    <span className="text-primary font-semibold" aria-hidden="true">
                      *
                    </span>
                    <span className="sr-only">Required</span>
                  </>
                ) : null}
              </h3>
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <DocumentIcon className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
                <span>One file only</span>
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:gap-3 lg:items-start">
            <div className="min-w-0 flex-1 flex flex-col gap-2 max-w-[min(100%,26rem)] lg:max-w-[min(100%,28rem)]">
              {hasAgreementFile ? (
                <FileDisplayBadge
                  fileName={agreement?.file_name ?? "document.pdf"}
                  truncate
                  inlineChip
                  size="sm"
                  locked={readOnly}
                  className={cn(
                    "min-h-9 w-full",
                    readOnly ? "border-border" : "bg-background border-border"
                  )}
                  trailing={
                    <button
                      type="button"
                      disabled={readOnly}
                      onClick={onClearGuarantorAgreement}
                      className={cn(
                        "shrink-0 p-0.5",
                        readOnly
                          ? "text-muted-foreground opacity-50 cursor-not-allowed"
                          : "text-muted-foreground hover:text-foreground cursor-pointer"
                      )}
                      aria-label={`Remove ${agreement?.file_name ?? "file"}`}
                    >
                      <XMarkIcon className="h-3 w-3" />
                    </button>
                  }
                />
              ) : readOnly ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                <span className="text-sm text-muted-foreground">No file uploaded</span>
              )}
            </div>

            <div className="flex flex-col gap-1 w-full min-w-0 border-t border-border pt-3 lg:self-start lg:border-t-0 lg:pt-0 lg:min-w-[12rem] lg:w-[12rem] lg:shrink-0 lg:border-l lg:border-border lg:pl-3">
              {agreementTemplateS3Key ? (
                <button
                  type="button"
                  disabled={readOnly}
                  className={cn(
                    supportingDocActionLink,
                    readOnly ? supportingDocActionOff : supportingDocTemplateOn
                  )}
                  onClick={() => {
                    if (!readOnly) void onDownloadAgreementTemplate();
                  }}
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5 shrink-0" />
                  Download template
                </button>
              ) : null}

              {!hasAgreementFile ? (
                !readOnly ? (
                  <label
                    htmlFor={agreementInputId}
                    className={cn(supportingDocActionLink, supportingDocUploadOn)}
                  >
                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                    Upload file
                    <Input
                      id={agreementInputId}
                      type="file"
                      accept="application/pdf,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = "";
                        if (file) onSelectGuarantorAgreementFile(file);
                      }}
                    />
                  </label>
                ) : (
                  <span className={cn(supportingDocActionLink, supportingDocActionOff)}>
                    <CloudArrowUpIcon className="h-3.5 w-3.5 shrink-0" />
                    Upload file
                  </span>
                )
              ) : null}
            </div>
          </div>
        </div>
        {hasAttemptedSave && agreementRequired && !hasAgreementFile ? (
          <p className="text-xs text-destructive mt-2">Upload the guarantor agreement</p>
        ) : null}
        </div>
      </div>
    </div>
  );
}

export function BusinessDetailsStep({
  applicationId,
  stepConfig,
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
  const [pendingGuarantorAgreements, setPendingGuarantorAgreements] = React.useState<
    Array<{ index: number; file: File; client_id: string }>
  >([]);
  const initialGuarantorRowsForAgreementCleanup = React.useRef<GuarantorFormRow[]>([]);
  /** Collapsible guarantor cards; index 0 defaults open until user toggles. */
  const [guarantorPanelOpen, setGuarantorPanelOpen] = React.useState<Record<number, boolean>>({});
  /** After Save and Continue: show format errors (matches contract-details SSM pattern). */
  const [hasAttemptedSave, setHasAttemptedSave] = React.useState(false);

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

  React.useEffect(() => {
    setHasAttemptedSave(false);
  }, [applicationId]);

  const guarantorEmailOk = React.useCallback((email: string, mode: "presence" | "strict") => {
    const t = email.trim();
    if (!t) return false;
    if (mode === "presence") return true;
    return GUARANTOR_EMAIL_STRICT.test(t);
  }, []);

  /**
   * presence: required inputs have a value — only used to enable Save and Continue (not format rules).
   * strict: full validation when the user clicks Save (email shape, 12-digit IC, same-invoice block, etc.).
   */
  const productGuarantorAgreementTemplate = React.useMemo(() => {
    const t = stepConfig?.guarantor_agreement_template as { s3_key?: string } | undefined;
    const key = t?.s3_key?.trim();
    return key ? t : undefined;
  }, [stepConfig]);

  const requiresGuarantorAgreementUpload = Boolean(productGuarantorAgreementTemplate?.s3_key?.trim());

  const evaluateBusinessDetails = React.useCallback(
    (mode: "presence" | "strict") => {
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
        if (!platformName.trim() || !amountRaised.trim() || !sameInvoiceUsed.trim()) {
          return false;
        }
        if (mode === "strict" && sameInvoiceUsed === "yes") {
          return false;
        }
      }

      if (guarantors.length < 1) return false;
      for (let gi = 0; gi < guarantors.length; gi++) {
        const g = guarantors[gi];
        if (!guarantorEmailOk(g.email, mode)) return false;
        if (!g.referenceId.trim()) return false;
        if (g.guarantorType === "individual") {
          const icOk =
            mode === "presence"
              ? malaysianNricDigits(g.icNumber).length > 0
              : isValidMalaysianNric(g.icNumber);
          const natOk =
            mode === "presence"
              ? g.nationality.trim().length === 2
              : isRegtankIso3166Code(g.nationality.trim());
          if (!g.name.trim() || !icOk || !natOk) {
            return false;
          }
        } else {
          if (!g.businessName.trim() || !g.ssmNumber.trim()) {
            return false;
          }
        }
        if (requiresGuarantorAgreementUpload) {
          const hasAgreement =
            Boolean(g.guarantorAgreement?.s3_key?.trim()) ||
            pendingGuarantorAgreements.some((p) => p.index === gi);
          if (!hasAgreement) return false;
        }
      }

      return true;
    },
    [
      aboutYourBusiness,
      whyRaisingFunds,
      declarationConfirmed,
      guarantors,
      guarantorEmailOk,
      requiresGuarantorAgreementUpload,
      pendingGuarantorAgreements,
    ]
  );

  const areBusinessDetailsFieldsFilled = React.useMemo(
    () => evaluateBusinessDetails("presence"),
    [evaluateBusinessDetails]
  );

  const validateBusinessDetails = React.useCallback(
    () => evaluateBusinessDetails("strict"),
    [evaluateBusinessDetails]
  );

  const downloadGuarantorAgreementTemplate = React.useCallback(async () => {
    const key = productGuarantorAgreementTemplate?.s3_key?.trim();
    if (!key) return;
    const token = await getAccessToken();
    if (!token) {
      toast.error("Authentication required");
      return;
    }
    const resp = await fetch(`${API_URL}/v1/s3/download-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ s3Key: key }),
    });
    const j = await resp.json().catch(() => null);
    if (j?.success && j.data?.downloadUrl) {
      window.open(j.data.downloadUrl as string, "_blank");
    } else {
      toast.error("Could not download template");
    }
  }, [getAccessToken, productGuarantorAgreementTemplate]);

  const handleGuarantorAgreementFileAt = React.useCallback((index: number, file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB)");
      return;
    }
    const client_id = makeClientId();
    setPendingGuarantorAgreements((prev) => [
      ...prev.filter((p) => p.index !== index),
      { index, file, client_id },
    ]);
    setGuarantors((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        return {
          ...row,
          guarantorAgreement: {
            file_name: file.name,
            file_size: file.size,
            client_id,
            uploaded_at: new Date().toISOString(),
          },
        };
      })
    );
  }, []);

  const clearGuarantorAgreementAt = React.useCallback((index: number) => {
    setPendingGuarantorAgreements((prev) => prev.filter((p) => p.index !== index));
    setGuarantors((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (row.guarantorType === "individual") {
          const { guarantorAgreement, ...rest } = row;
          void guarantorAgreement;
          return rest as GuarantorIndividualRow;
        }
        const { guarantorAgreement, ...rest } = row;
        void guarantorAgreement;
        return rest as GuarantorCompanyRow;
      })
    );
  }, []);

  React.useEffect(() => {
    if (application === undefined || isInitialized) return;

    const saved = application?.business_details;
    const relational = (application as { application_guarantors?: unknown[] }).application_guarantors;
    const initial = fromSnakeSaved(saved, relational);
    setAboutYourBusiness(initial.aboutYourBusiness);
    setWhyRaisingFunds({
      ...initial.whyRaisingFunds,
      amountRaised: initial.whyRaisingFunds.amountRaised,
    });
    setDeclarationConfirmed(initial.declarationConfirmed);
    setGuarantors(initial.guarantors);
    setPendingSupportingDocuments([]);
    setPendingGuarantorAgreements([]);
    setInitialWhySupportingDocuments(initial.whyRaisingFunds.supportingDocuments);
    initialGuarantorRowsForAgreementCleanup.current = initial.guarantors.map((g) => ({ ...g }));
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
    setPendingGuarantorAgreements([]);
    setInitialWhySupportingDocuments(initial.whyRaisingFunds.supportingDocuments);
    initialGuarantorRowsForAgreementCleanup.current = initial.guarantors.map((g) => ({ ...g }));
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
    return (
      JSON.stringify(snakePayload) !== initialPayloadRef.current ||
      pendingSupportingDocuments.length > 0 ||
      pendingGuarantorAgreements.length > 0
    );
  }, [snakePayload, isInitialized, pendingSupportingDocuments.length, pendingGuarantorAgreements.length]);
  const hasRemovedGuarantorAgreements = React.useMemo(() => {
    const initialKeys = new Set(
      initialGuarantorRowsForAgreementCleanup.current
        .map((g) => g.guarantorAgreement?.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    const currentKeys = new Set(
      guarantors.map((g) => g.guarantorAgreement?.s3_key?.trim()).filter((key): key is string => Boolean(key))
    );
    for (const key of initialKeys) {
      if (!currentKeys.has(key)) return true;
    }
    return false;
  }, [guarantors]);
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

  const uploadGuarantorAgreementFilesAndDeletes = React.useCallback(
    async (
    token: string,
    guarantorsIn: GuarantorFormRow[],
    pendingSnap: Array<{ index: number; file: File; client_id: string }>
  ): Promise<GuarantorFormRow[]> => {
    const uploadedByClientId = new Map<
      string,
      { s3_key: string; file_name: string; file_size: number; uploaded_at: string }
    >();

    for (const pending of pendingSnap) {
      const presignRes = await fetch(`${API_URL}/v1/applications/${applicationId}/upload-document-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: pending.file.name,
          contentType: pending.file.type || "application/pdf",
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
          "Content-Type": pending.file.type || "application/pdf",
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

    let next = guarantorsIn.map((row) => ({ ...row }));
    for (const pending of pendingSnap) {
      const uploaded = uploadedByClientId.get(pending.client_id);
      if (!uploaded) continue;
      next = next.map((row, idx) => {
        if (idx !== pending.index) return row;
        return {
          ...row,
          guarantorAgreement: {
            file_name: uploaded.file_name,
            file_size: uploaded.file_size,
            s3_key: uploaded.s3_key,
            uploaded_at: uploaded.uploaded_at,
          },
        };
      });
    }

    const initialKeys = new Set(
      initialGuarantorRowsForAgreementCleanup.current
        .map((g) => g.guarantorAgreement?.s3_key?.trim())
        .filter((key): key is string => Boolean(key))
    );
    const nextKeys = new Set(
      next.map((g) => g.guarantorAgreement?.s3_key?.trim()).filter((key): key is string => Boolean(key))
    );
    for (const s3Key of Array.from(initialKeys).filter((key) => !nextKeys.has(key))) {
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
            : "Failed to delete removed guarantor agreement from storage."
        );
      }
    }

    return next;
  },
    [applicationId]
  );

  const uploadWhySectionSupportingDocuments = React.useCallback(async (guarantorsIn: GuarantorFormRow[]) => {
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
      guarantors: guarantorsIn,
    });
    initialPayloadRef.current = JSON.stringify(nextPayload);
    initialGuarantorRowsForAgreementCleanup.current = guarantorsIn.map((g) => ({ ...g }));
    return nextPayload;
  },
    [
      getAccessToken,
      applicationId,
      pendingSupportingDocuments,
      whyRaisingFunds,
      initialWhySupportingDocuments,
      aboutYourBusiness,
      declarationConfirmed,
    ]
  );

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;

    /**
     * Save stays enabled whenever required fields have values (presence). Format and business rules
     * run only in saveFunction; inline errors use hasAttemptedSave and do not change isValid.
     */
    onDataChangeRef.current({
      ...snakePayload,
      hasPendingChanges,
      isValid: readOnly || areBusinessDetailsFieldsFilled,
      saveFunction: async () => {
        setHasAttemptedSave(true);
        if (!validateBusinessDetails()) {
          toast.error("Please fix the highlighted fields");
          throw new Error("VALIDATION_BUSINESS_DETAILS_FAILED");
        }
        const token = await getAccessToken();
        if (!token) {
          toast.error("Authentication required");
          throw new Error("AUTH_REQUIRED");
        }
        const hadGuarantorWork =
          pendingGuarantorAgreements.length > 0 || hasRemovedGuarantorAgreements;
        const hadSupportingWork =
          pendingSupportingDocuments.length > 0 || hasRemovedSupportingDocuments;
        const pendingGuarantorSnap = [...pendingGuarantorAgreements];
        let nextGuarantors = guarantors;
        if (hadGuarantorWork) {
          nextGuarantors = await uploadGuarantorAgreementFilesAndDeletes(
            token,
            guarantors,
            pendingGuarantorSnap
          );
          setGuarantors(nextGuarantors);
          setPendingGuarantorAgreements([]);
          initialGuarantorRowsForAgreementCleanup.current = nextGuarantors.map((g) => ({ ...g }));
        }
        if (hadSupportingWork) {
          return uploadWhySectionSupportingDocuments(nextGuarantors);
        }
        if (hadGuarantorWork) {
          const nextPayload = toSnakePayload({
            aboutYourBusiness,
            whyRaisingFunds,
            declarationConfirmed,
            guarantors: nextGuarantors,
          });
          initialPayloadRef.current = JSON.stringify(nextPayload);
          return nextPayload;
        }
        return undefined;
      },
    });
  }, [
    snakePayload,
    hasPendingChanges,
    isInitialized,
    readOnly,
    areBusinessDetailsFieldsFilled,
    validateBusinessDetails,
    pendingSupportingDocuments.length,
    hasRemovedSupportingDocuments,
    pendingGuarantorAgreements,
    hasRemovedGuarantorAgreements,
    aboutYourBusiness,
    declarationConfirmed,
    getAccessToken,
    guarantors,
    uploadGuarantorAgreementFilesAndDeletes,
    uploadWhySectionSupportingDocuments,
    whyRaisingFunds,
  ]);

  const addWhySectionSupportingPdfFiles = React.useCallback((files: File[]) => {
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
  }, []);

  const whySupportingDocumentsDropZoneProps = React.useMemo(
    () => ({
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        addWhySectionSupportingPdfFiles(Array.from(e.dataTransfer.files ?? []));
      },
    }),
    [addWhySectionSupportingPdfFiles]
  );

  const handleWhySectionSupportingDocumentsSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    addWhySectionSupportingPdfFiles(Array.from(e.target.files ?? []));
    e.currentTarget.value = "";
  };

  const replaceGuarantorRow = React.useCallback(
    (index: number, next: GuarantorRowUpdater) => {
      setGuarantors((prev) =>
        prev.map((row, i) => {
          if (i !== index) return row;
          return typeof next === "function" ? next(row) : next;
        })
      );
    },
    []
  );

  if (isLoadingApp || !isInitialized || devTools?.showSkeletonDebug) {
    return <BusinessDetailsSkeleton />;
  }

  const sameInvoiceP2pBlocked =
    whyRaisingFunds.raisingOnOtherP2P === "yes" && whyRaisingFunds.sameInvoiceUsed === "yes";
  const fieldsLocked = readOnly || sameInvoiceP2pBlocked;

  const setGuarantorTypeAt = (index: number, type: "individual" | "company") => {
    const current = guarantors[index];
    const ref = current?.referenceId ?? makeClientId();
    const keepAgreement = current?.guarantorAgreement;
    replaceGuarantorRow(
      index,
      type === "individual"
        ? {
            ...emptyIndividualGuarantor(),
            referenceId: ref,
            ...(keepAgreement ? { guarantorAgreement: keepAgreement } : {}),
          }
        : {
            ...emptyCompanyGuarantor(),
            referenceId: ref,
            ...(keepAgreement ? { guarantorAgreement: keepAgreement } : {}),
          }
    );
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

        <div className={rowGridClassName}>
          <Label htmlFor="what-does-company-do" className={labelTextareaClassName}>
            What does your company do?
          </Label>
          <TextareaWithCharCount
            id="what-does-company-do"
            value={aboutYourBusiness.whatDoesCompanyDo}
            onChange={(e) =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                whatDoesCompanyDo: e.target.value.slice(0, MAX_CHARS_WHAT_COMPANY_DO),
              }))
            }
            placeholder="Add details"
            maxLength={MAX_CHARS_WHAT_COMPANY_DO}
            className={textareaClassName}
            countLabel={`${aboutYourBusiness.whatDoesCompanyDo.length}/${MAX_CHARS_WHAT_COMPANY_DO} characters`}
            disabled={fieldsLocked}
          />

          <Label htmlFor="main-customers" className={labelTextareaClassName}>
            Who are your main customers?
          </Label>
          <TextareaWithCharCount
            id="main-customers"
            value={aboutYourBusiness.mainCustomers}
            onChange={(e) =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                mainCustomers: e.target.value.slice(0, MAX_CHARS_OTHER_BUSINESS_TEXTAREA),
              }))
            }
            placeholder="Add details"
            maxLength={MAX_CHARS_OTHER_BUSINESS_TEXTAREA}
            className={textareaClassName}
            countLabel={`${aboutYourBusiness.mainCustomers.length}/${MAX_CHARS_OTHER_BUSINESS_TEXTAREA} characters`}
            disabled={fieldsLocked}
          />

          <Label className={labelInputClassName}>
            Does any single customer make up more than 50% of your revenue?
          </Label>
          <div className={applicationFlowRadioRowControlClassName}>
            <YesNoRadioGroup
              name="singleCustomerOver50Revenue"
              value={aboutYourBusiness.singleCustomerOver50Revenue}
              onValueChange={(v) =>
                setAboutYourBusiness((prev) => ({ ...prev, singleCustomerOver50Revenue: v }))
              }
              disabled={fieldsLocked}
            />
          </div>

          <Label htmlFor="accounting-software" className={labelInputClassName}>
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
          <div className="contents">
            <Label htmlFor="financing-for" className={labelTextareaClassName}>
              What is this financing for?
            </Label>
            <TextareaWithCharCount
              id="financing-for"
              value={whyRaisingFunds.financingFor}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  financingFor: e.target.value.slice(0, MAX_CHARS_OTHER_BUSINESS_TEXTAREA),
                }))
              }
              placeholder="Add details"
              maxLength={MAX_CHARS_OTHER_BUSINESS_TEXTAREA}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.financingFor.length}/${MAX_CHARS_OTHER_BUSINESS_TEXTAREA} characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="how-funds-used" className={labelTextareaClassName}>
              How will the funds be used?
            </Label>
            <TextareaWithCharCount
              id="how-funds-used"
              value={whyRaisingFunds.howFundsUsed}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  howFundsUsed: e.target.value.slice(0, MAX_CHARS_OTHER_BUSINESS_TEXTAREA),
                }))
              }
              placeholder="Add details"
              maxLength={MAX_CHARS_OTHER_BUSINESS_TEXTAREA}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.howFundsUsed.length}/${MAX_CHARS_OTHER_BUSINESS_TEXTAREA} characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="business-plan" className={labelTextareaClassName}>
              Tell us about your business plan
            </Label>
            <TextareaWithCharCount
              id="business-plan"
              value={whyRaisingFunds.businessPlan}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  businessPlan: e.target.value.slice(0, MAX_CHARS_BUSINESS_PLAN),
                }))
              }
              placeholder="Add details"
              maxLength={MAX_CHARS_BUSINESS_PLAN}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.businessPlan.length}/${MAX_CHARS_BUSINESS_PLAN} characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="risks-delay-repayment" className={labelTextareaClassName}>
              Are there any risks that may delay repayment of your invoices?
            </Label>
            <TextareaWithCharCount
              id="risks-delay-repayment"
              value={whyRaisingFunds.risksDelayRepayment}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  risksDelayRepayment: e.target.value.slice(0, MAX_CHARS_OTHER_BUSINESS_TEXTAREA),
                }))
              }
              placeholder="Add details"
              maxLength={MAX_CHARS_OTHER_BUSINESS_TEXTAREA}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.risksDelayRepayment.length}/${MAX_CHARS_OTHER_BUSINESS_TEXTAREA} characters`}
              disabled={fieldsLocked}
            />

            <Label htmlFor="backup-plan" className={labelTextareaClassName}>
              If payment is delayed, what is your backup plan?
            </Label>
            <TextareaWithCharCount
              id="backup-plan"
              value={whyRaisingFunds.backupPlan}
              onChange={(e) =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  backupPlan: e.target.value.slice(0, MAX_CHARS_OTHER_BUSINESS_TEXTAREA),
                }))
              }
              placeholder="Add details"
              maxLength={MAX_CHARS_OTHER_BUSINESS_TEXTAREA}
              className={textareaClassName}
              countLabel={`${whyRaisingFunds.backupPlan.length}/${MAX_CHARS_OTHER_BUSINESS_TEXTAREA} characters`}
              disabled={fieldsLocked}
            />
          </div>

          <Label className={labelTextareaClassName}>
            Upload any relevant supporting documents for this section{" "}
            <span className="text-muted-foreground">(optional)</span>
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
                    <div
                      className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors border-border bg-card/50 hover:bg-muted/50"
                      {...whySupportingDocumentsDropZoneProps}
                    >
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
            ) : fieldsLocked ? (
              <span className="text-[14px] text-muted-foreground">—</span>
            ) : (
              <label
                htmlFor="why-section-supporting-documents"
                className="cursor-pointer"
              >
                <div
                  className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors border-border bg-card/50 hover:bg-muted/50"
                  {...whySupportingDocumentsDropZoneProps}
                >
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

          <Label className={labelInputClassName}>
            Are you currently raising/applying funds on any other P2P platforms?
          </Label>
          <div className={applicationFlowRadioRowControlClassName}>
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
              <Label htmlFor="platform-name" className={labelInputClassName}>
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

              <Label htmlFor="amount-raised" className={labelInputClassName}>
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

              <Label className={labelInputClassName}>
                Have the same invoices been used to apply for funding in the aforementioned platform?
              </Label>
              <div className="min-w-0 space-y-2 w-full">
                <div className={applicationFlowRadioRowControlClassName}>
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
      <section className={cn(sectionWrapperClassName, "space-y-5")}>
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
                hasAttemptedSave={hasAttemptedSave}
                replaceGuarantorRow={replaceGuarantorRow}
                setGuarantorTypeAt={setGuarantorTypeAt}
                agreementTemplateS3Key={productGuarantorAgreementTemplate?.s3_key}
                agreementRequired={requiresGuarantorAgreementUpload}
                onDownloadAgreementTemplate={downloadGuarantorAgreementTemplate}
                onSelectGuarantorAgreementFile={(file) => handleGuarantorAgreementFileAt(index, file)}
                onClearGuarantorAgreement={() => clearGuarantorAgreementAt(index)}
              />
            );

            const subtitle = guarantorCardSummarySubtitle(row);
            const panelOpen =
              guarantorPanelOpen[index] !== undefined ? guarantorPanelOpen[index]! : index === 0;

            return (
              <details
                key={row.referenceId || index}
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
      <section className={cn(sectionWrapperClassName, "space-y-5")}>
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
