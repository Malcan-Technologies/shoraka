"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuthToken } from "@cashsouk/config";
import { useCreateIssuerOrganizationCtosSubjectReport } from "@/hooks/use-admin-issuer-organization-ctos-mutations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewValue } from "../review-value";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
  comparisonCellSurfaceShellClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
  comparisonSplitAfterColClass,
  comparisonSplitBeforeColClass,
  comparisonSplitRowGridClass,
} from "../review-section-styles";
import {
  ComparisonDocumentTitleRow,
  businessSupportingDocsToChips,
} from "../comparison-document-pair";
import type { ReviewSectionId } from "../section-types";
import {
  kycAmlScreeningRiskLevelBadgeClass,
  kycAmlScreeningStatusBadgeClass,
} from "@/lib/kyc-aml-screening-badge-classes";
import { cn } from "@/lib/utils";
import { CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, CTOS_CONFIRM, CTOS_UI } from "@/lib/ctos-ui-labels";
import { regtankNationalityDisplayLabel } from "@cashsouk/types";
import {
  ComparisonFieldRow,
  ComparisonYesNoRadioRow,
} from "../comparison-field-row";

export type BusinessSectionComparisonProps = {
  beforeDetails: unknown;
  afterDetails: unknown;
  beforeGuarantors?: unknown;
  afterGuarantors?: unknown;
  isPathChanged: (path: string) => boolean;
};

export interface BusinessSectionProps {
  /** Used to invalidate application detail after org-level CTOS mutations. */
  applicationId?: string;
  /** Issuer org id for organization-level CTOS subject reports (list + create + HTML). */
  issuerOrganizationId?: string | null;
  issuerOrganization?: {
    latest_organization_ctos_subject_reports?: Array<{
      id: string;
      subject_ref: string | null;
      fetched_at: string;
      has_report_html: boolean;
    }> | null;
  } | null;
  businessDetails: unknown;
  applicationGuarantors?: unknown;
  section: ReviewSectionId;
  /** When set, renders read-only before/after grid and hides review actions. */
  sectionComparison?: BusinessSectionComparisonProps;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  hideSectionComments?: boolean;
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

function ComparisonDeclarationCell({
  confirmed,
  side,
  valuesDiffer,
}: {
  confirmed: boolean;
  side: "before" | "after";
  valuesDiffer: boolean;
}) {
  const shell = comparisonCellSurfaceShellClass;
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  return (
    <div
      className={cn(
        shell,
        "items-start",
        side === "before" ? "text-muted-foreground" : "text-foreground",
        changedHighlight
      )}
    >
      <div className="w-full rounded-lg border border-input bg-background p-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              confirmed ? "border-primary bg-primary" : "border-muted-foreground"
            )}
            aria-hidden
          >
            {confirmed ? (
              <svg
                className="h-2.5 w-2.5 text-primary-foreground"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M2 6l3 3 5-6" />
              </svg>
            ) : null}
          </div>
          <span
            className={cn(
              "text-sm",
              side === "before" ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {DECLARATION_TEXT}
          </span>
        </div>
      </div>
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Em dash placeholder (matches financial CTOS tables). */
const CTOS_HEADER_PLACEHOLDER = "\u2014";

/** RegTank client portal origin (no trailing slash), e.g. https://your-company.regtank.com */
const REGTANK_PORTAL_BASE_URL =
  typeof process !== "undefined" ? (process.env.NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL ?? "").trim() : "";

/**
 * Opens Acuris KYC/KYB screening results in the RegTank client portal.
 * Individual: /app/screen-kyc/result/{requestId}
 * Company: /app/screen-kyb/result/{requestId}
 */
function regTankAcurisScreeningResultUrl(
  portalBaseUrl: string,
  guarantorKind: "individual" | "company",
  requestId: string | undefined
): string | undefined {
  const base = portalBaseUrl.replace(/\/+$/, "");
  if (!base || !requestId) return undefined;
  const enc = encodeURIComponent(requestId);
  if (guarantorKind === "company") {
    return `${base}/app/screen-kyb/result/${enc}`;
  }
  return `${base}/app/screen-kyc/result/${enc}`;
}

function RegTankGuarantorLinkButton({
  url,
  side,
  disabled,
  disabledReason,
  className,
}: {
  url?: string;
  side?: "before" | "after";
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const label =
    side === "before"
      ? "View in RegTank (before)"
      : side === "after"
        ? "View in RegTank (after)"
        : "View in RegTank";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5 h-9 shrink-0 px-3 text-sm", className)}
      disabled={disabled || !url}
      title={disabled || !url ? disabledReason || "RegTank screening result URL is not available yet." : undefined}
      onClick={(e) => {
        e.stopPropagation();
        if (!url) return;
        window.open(url, "_blank", "noopener,noreferrer");
      }}
    >
      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  );
}

function RegTankGuarantorControlRow({
  guarantor,
  amlByKey,
  onTriggerGuarantorAml,
  mode,
  comparisonSides,
}: {
  guarantor?: GuarantorReviewRow;
  amlByKey: Map<string, GuarantorAmlEntry>;
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  mode: "single" | "comparison";
  /** When a side has no guarantor (e.g. newly added row), that RegTank button is disabled. */
  comparisonSides?: { beforeAvailable: boolean; afterAvailable: boolean };
}) {
  const beforeOk = comparisonSides?.beforeAvailable ?? true;
  const afterOk = comparisonSides?.afterAvailable ?? true;
  return (
    <div
      className={
        mode === "comparison"
          ? "flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-start"
          : "flex flex-wrap items-center gap-2 sm:gap-2.5"
      }
    >
      {mode === "comparison" ? (
        <>
          <RegTankGuarantorLinkButton
            side="before"
            url={undefined}
            disabled={!beforeOk}
            disabledReason="No guarantor in the earlier revision for this row."
          />
          <RegTankGuarantorLinkButton
            side="after"
            url={undefined}
            disabled={!afterOk}
            disabledReason="No guarantor in the later revision for this row."
          />
        </>
      ) : guarantor ? (
        (() => {
          const aml = amlByKey.get(buildGuarantorAmlKey(guarantor));
          const screeningRequestId = aml?.amlScreening?.requestId;
          const hasScreeningStarted = Boolean(
            aml?.requestId || screeningRequestId || aml?.regtankPortalUrl
          );
          const resultUrl =
            regTankAcurisScreeningResultUrl(
              REGTANK_PORTAL_BASE_URL,
              guarantor.kind,
              aml?.requestId ?? screeningRequestId
            ) ?? aml?.regtankPortalUrl;
          const viewDisabledReason = !resultUrl
            ? !aml?.requestId && !screeningRequestId
              ? "Start AML screening first, or configure NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL."
              : "Configure NEXT_PUBLIC_REGTANK_PORTAL_BASE_URL to open Acuris screening in RegTank."
            : undefined;
          return (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 shrink-0 px-3 text-sm"
                disabled={!onTriggerGuarantorAml || !guarantor.email || hasScreeningStarted}
                title={
                  hasScreeningStarted
                    ? "AML screening has already been started for this guarantor."
                    : !guarantor.email
                      ? "Guarantor email is required to start AML screening."
                      : undefined
                }
                onClick={(e) => {
                  e.stopPropagation();
                  void onTriggerGuarantorAml?.(guarantor.referenceId);
                }}
              >
                Start AML
              </Button>
              <RegTankGuarantorLinkButton
                url={resultUrl}
                disabled={!resultUrl}
                disabledReason={viewDisabledReason}
              />
            </>
          );
        })()
      ) : (
        <RegTankGuarantorLinkButton />
      )}
    </div>
  );
}

type GuarantorAgreementFile = { s3Key: string; fileName: string; fileSize?: number };

type GuarantorReviewRow =
  | ({
      kind: "individual";
      referenceId: string;
      name: string;
      icNumber: string;
      /** RegTank ISO 3166 alpha-2; empty if legacy row. */
      nationalityCode: string;
      email: string;
    } & { guarantorAgreement?: GuarantorAgreementFile })
  | ({
      kind: "company";
      referenceId: string;
      businessName: string;
      ssmNumber: string;
      email: string;
    } & { guarantorAgreement?: GuarantorAgreementFile });

/**
 * SECTION: CTOS subject key + lookup for guarantors
 * WHY: Same normalization as director/shareholder CTOS list (`subject_ref` keys in API).
 * INPUT: IC/SSM string from guarantor row
 * OUTPUT: Lowercased compact key or null
 * WHERE USED: Map lookup and POST `subjectRef` for guarantor CTOS
 */
function normalizeCtosSubjectKey(raw: string | null | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .replace(/\s+/g, "");
  if (!s) return null;
  return s.toLowerCase();
}

function ctosSubjectReportLookupKeyFromGuarantor(g: GuarantorReviewRow): string | null {
  const raw = g.kind === "individual" ? g.icNumber : g.ssmNumber;
  return normalizeCtosSubjectKey(raw);
}

function lookupSubjectReportSnapForGuarantor(
  m: Map<string, { id: string; has_report_html: boolean; fetched_at: string }>,
  g: GuarantorReviewRow
): { id: string; has_report_html: boolean; fetched_at: string } | undefined {
  const k = ctosSubjectReportLookupKeyFromGuarantor(g);
  if (!k) return undefined;
  return m.get(k);
}

function formatCtosFetchedAtShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return null;
  }
}

function guarantorCtosLastFetchLabel(g: GuarantorReviewRow, snap?: { fetched_at: string }): React.ReactNode {
  const refKey = ctosSubjectReportLookupKeyFromGuarantor(g);
  if (!refKey) {
    return <span className="text-muted-foreground">{CTOS_HEADER_PLACEHOLDER}</span>;
  }
  const formatted = snap?.fetched_at ? formatCtosFetchedAtShort(snap.fetched_at) : null;
  if (formatted) {
    return <span className="tabular-nums text-muted-foreground text-xs">{formatted}</span>;
  }
  return <span className="text-muted-foreground">{CTOS_HEADER_PLACEHOLDER}</span>;
}

type GuarantorAmlStatus = "Unresolved" | "Approved" | "Rejected" | "Pending";
type GuarantorAmlMessageStatus = "DONE" | "PENDING" | "ERROR";

/** RegTank DJKYC/DJKYB snapshot from `metadata.aml_screening` (webhook-driven). */
export interface GuarantorAmlScreeningSnapshot {
  possibleMatchCount?: number;
  blacklistedMatchCount?: number;
  regtankStatus?: string;
  messageStatus?: string;
  /** RegTank webhook `riskScore` (displayed as “Score”). */
  riskScore?: string;
  riskLevel?: string;
  screeningUpdatedAt?: string;
  requestId?: string;
}

interface GuarantorAmlEntry {
  orgGuarantorKey: string;
  guarantorType: "individual" | "company";
  guarantorId: string;
  email: string;
  name?: string;
  icNumber?: string;
  businessName?: string;
  ssmNumber?: string;
  requestId?: string;
  onboardingVerifyLink?: string;
  regtankPortalUrl?: string;
  amlStatus: GuarantorAmlStatus;
  amlMessageStatus: GuarantorAmlMessageStatus;
  amlScreening?: GuarantorAmlScreeningSnapshot;
}

interface RelationalGuarantorEntry {
  id?: string;
  position?: number;
  client_guarantor_id?: string;
  guarantor_type?: string;
  email?: string;
  name?: string | null;
  ic_number?: string | null;
  business_name?: string | null;
  ssm_number?: string | null;
  guarantor?: Record<string, unknown> | null;
  aml_screening?: unknown;
  source_data?: unknown;
}

/** Normalized view model for Business Details review. Supports snake_case and camelCase from API/DB. */
interface BusinessDetailsView {
  about: {
    whatDoesCompanyDo: string;
    mainCustomers: string;
    singleCustomerOver50Revenue: boolean | null;
  };
  whyRaisingFunds: {
    financingFor: string;
    howFundsUsed: string;
    businessPlan: string;
    risksDelayRepayment: string;
    backupPlan: string;
    raisingOnOtherP2P: boolean | null;
    platformName: string;
    amountRaised: number | null;
    sameInvoiceUsed: boolean | null;
    accountingSoftware: string;
    supportingDocuments: Array<{ s3Key: string; fileName: string; fileSize?: number }>;
  };
  declarationConfirmed: boolean;
  guarantors: GuarantorReviewRow[];
}

function reviewStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isPlainObjectRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizeIdentifier(v: unknown): string {
  return reviewStr(v).replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function normalizeEmail(v: unknown): string {
  return reviewStr(v).toLowerCase();
}

function safeToken(v: string): string {
  const token = v.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  return token.length > 0 ? token : "unknown";
}

function deterministicGuarantorId(
  index: number,
  kind: "individual" | "company",
  icOrSsm: string
): string {
  return `g-${kind}-${safeToken(icOrSsm || `idx${index + 1}`)}`;
}

function parseGuarantorAgreementField(raw: unknown): GuarantorAgreementFile | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const s3Key = reviewStr(o.s3_key ?? o.s3Key);
  if (!s3Key) return undefined;
  const fileName =
    reviewStr(o.file_name ?? o.fileName) || "Guarantor agreement.pdf";
  const sz = o.file_size ?? o.fileSize;
  const fileSize =
    typeof sz === "number" && Number.isFinite(sz) && sz > 0 ? sz : undefined;
  return { s3Key, fileName, ...(fileSize != null ? { fileSize } : {}) };
}

function guarantorNationalityCodeFromRelational(
  entry: RelationalGuarantorEntry,
  g: Record<string, unknown>
): string {
  const two = (v: unknown) => {
    const s = reviewStr(v).toUpperCase();
    return s.length === 2 ? s : "";
  };
  const fromG = two(g.nationality ?? g.nationality_code);
  if (fromG) return fromG;
  const entryRec = entry as Record<string, unknown>;
  const src = entryRec.source_data ?? entryRec.sourceData;
  if (isPlainObjectRecord(src)) {
    const fromSrc = two(src.nationality ?? src.nationality_code);
    if (fromSrc) return fromSrc;
  }
  return "";
}

function guarantorAgreementFromRelationalEntry(
  entry: RelationalGuarantorEntry,
  g: Record<string, unknown>
): GuarantorAgreementFile | undefined {
  const direct = parseGuarantorAgreementField(
    g.guarantor_agreement ?? g.guarantorAgreement
  );
  if (direct) return direct;
  const entryRec = entry as Record<string, unknown>;
  const src = entryRec.source_data ?? entryRec.sourceData;
  if (!isPlainObjectRecord(src)) return undefined;
  return parseGuarantorAgreementField(
    src.guarantor_agreement ?? src.guarantorAgreement
  );
}

function parseGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const gt = o.guarantor_type ?? o.guarantorType;
    const agreement = parseGuarantorAgreementField(
      o.guarantor_agreement ?? o.guarantorAgreement
    );
    const ref =
      reviewStr(o.reference_id ?? o.referenceId ?? o.guarantor_id ?? o.guarantorId) ||
      deterministicGuarantorId(
        index,
        gt === "company" ? "company" : "individual",
        normalizeIdentifier(
          o.ic_number ?? o.icNumber ?? o.government_id_number ?? o.ssm_number ?? o.ssmNumber
        )
      );
    if (gt === "individual") {
      const legacyFirst = reviewStr(o.first_name ?? o.firstName);
      const legacyLast = reviewStr(o.last_name ?? o.lastName);
      const nameFromLegacy = [legacyFirst, legacyLast].filter(Boolean).join(" ").trim();
      const name = reviewStr(o.name) || nameFromLegacy;
      const gov = reviewStr(o.ic_number ?? o.icNumber ?? o.government_id_number);
      const nationalityRaw = reviewStr(o.nationality ?? o.nationality_code).toUpperCase();
      const nationalityCode = nationalityRaw.length === 2 ? nationalityRaw : "";
      rows.push({
        kind: "individual",
        referenceId: ref,
        name,
        icNumber: gov,
        nationalityCode,
        email: normalizeEmail(o.email),
        ...(agreement ? { guarantorAgreement: agreement } : {}),
      });
    } else if (gt === "company") {
      rows.push({
        kind: "company",
        referenceId: ref,
        businessName: reviewStr(o.business_name ?? o.businessName ?? o.company_name ?? o.companyName),
        ssmNumber: reviewStr(o.ssm_number ?? o.ssmNumber ?? o.business_id_number),
        email: normalizeEmail(o.email),
        ...(agreement ? { guarantorAgreement: agreement } : {}),
      });
    }
  }
  return rows;
}

function buildGuarantorAmlKey(row: GuarantorReviewRow): string {
  if (row.kind === "individual") {
    const gid = normalizeIdentifier(row.icNumber);
    if (gid) return `individual:${gid}`;
    return `individual:email:${normalizeEmail(row.email)}`;
  }
  const bid = normalizeIdentifier(row.ssmNumber);
  if (bid) return `company:${bid}`;
  return `company:email:${normalizeEmail(row.email)}`;
}

function parseAmlScreening(raw: unknown): GuarantorAmlScreeningSnapshot | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const pm = o.possibleMatchCount;
  const bm = o.blacklistedMatchCount;
  const possibleMatchCount =
    typeof pm === "number" && Number.isFinite(pm)
      ? pm
      : typeof pm === "string"
        ? parseInt(pm, 10)
        : undefined;
  const blacklistedMatchCount =
    typeof bm === "number" && Number.isFinite(bm)
      ? bm
      : typeof bm === "string"
        ? parseInt(bm, 10)
        : undefined;
  const screening: GuarantorAmlScreeningSnapshot = {};
  if (possibleMatchCount !== undefined && !Number.isNaN(possibleMatchCount)) {
    screening.possibleMatchCount = possibleMatchCount;
  }
  if (blacklistedMatchCount !== undefined && !Number.isNaN(blacklistedMatchCount)) {
    screening.blacklistedMatchCount = blacklistedMatchCount;
  }
  const rs = reviewStr(o.regtankStatus);
  const ms = reviewStr(o.messageStatus);
  const su = reviewStr(o.screeningUpdatedAt);
  const rid = reviewStr(o.requestId);
  const rawRiskScore = o.riskScore;
  const rScore =
    typeof rawRiskScore === "number" && Number.isFinite(rawRiskScore)
      ? String(rawRiskScore)
      : reviewStr(rawRiskScore);
  const rLevel = reviewStr(o.riskLevel);
  if (rs) screening.regtankStatus = rs;
  if (ms) screening.messageStatus = ms;
  if (su) screening.screeningUpdatedAt = su;
  if (rid) screening.requestId = rid;
  if (rScore) screening.riskScore = rScore;
  if (rLevel) screening.riskLevel = rLevel;
  if (
    screening.possibleMatchCount === undefined &&
    screening.blacklistedMatchCount === undefined &&
    !screening.regtankStatus &&
    !screening.messageStatus &&
    !screening.riskScore &&
    !screening.riskLevel &&
    !screening.screeningUpdatedAt &&
    !screening.requestId
  ) {
    return undefined;
  }
  return screening;
}

function parseGuarantorAmlEntries(raw: unknown): GuarantorAmlEntry[] {
  if (!Array.isArray(raw)) return [];
  const entries: GuarantorAmlEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const nested =
      row.guarantor && typeof row.guarantor === "object" && !Array.isArray(row.guarantor)
        ? (row.guarantor as Record<string, unknown>)
        : null;
    const g = nested ?? row;
    const guarantorType = g.guarantor_type === "company" ? "company" : "individual";
    const linkId = reviewStr(row.id) || reviewStr(g.id);
    const referenceId =
      reviewStr(row.client_guarantor_id ?? g.client_guarantor_id) || linkId;
    const entryForNationality = item as RelationalGuarantorEntry;
    const reviewRow: GuarantorReviewRow =
      guarantorType === "individual"
        ? {
            kind: "individual",
            referenceId,
            name:
              reviewStr(g.name) ||
              [reviewStr(g.first_name), reviewStr(g.last_name)].filter(Boolean).join(" ").trim(),
            icNumber: reviewStr(g.ic_number ?? g.government_id_number),
            nationalityCode: guarantorNationalityCodeFromRelational(entryForNationality, g),
            email: normalizeEmail(g.email),
          }
        : {
            kind: "company",
            referenceId,
            businessName: reviewStr(g.business_name ?? g.company_name),
            ssmNumber: reviewStr(g.ssm_number ?? g.business_id_number),
            email: normalizeEmail(g.email),
          };
    const orgGuarantorKey = buildGuarantorAmlKey(reviewRow);
    if (!orgGuarantorKey || !linkId || !reviewStr(g.email)) continue;
    const rowRec = row as Record<string, unknown>;
    const amlScreening =
      parseAmlScreening(rowRec.aml_screening) ??
      parseAmlScreening(rowRec.amlScreening) ??
      parseAmlScreening(
        isPlainObjectRecord(rowRec.metadata) ? rowRec.metadata.aml_screening : undefined
      ) ??
      parseAmlScreening((g as Record<string, unknown>).aml_screening);
    const message = reviewStr(row.amlMessageStatus) as GuarantorAmlMessageStatus;
    const amlStatus = reviewStr(g.aml_status) as GuarantorAmlStatus;
    const amlMessageStatus = reviewStr(g.aml_message_status) as GuarantorAmlMessageStatus;
    const isStatusValid =
      amlStatus === "Approved" ||
      amlStatus === "Rejected" ||
      amlStatus === "Unresolved" ||
      amlStatus === "Pending";
    const isMessageValid = message === "DONE" || message === "PENDING" || message === "ERROR";
    const isAmlMessageValid =
      amlMessageStatus === "DONE" || amlMessageStatus === "PENDING" || amlMessageStatus === "ERROR";

    entries.push({
      orgGuarantorKey,
      guarantorType,
      guarantorId: linkId,
      email: normalizeEmail(g.email),
      name: reviewRow.kind === "individual" ? reviewRow.name : undefined,
      icNumber:
        reviewRow.kind === "individual" ? reviewRow.icNumber : undefined,
      businessName: reviewRow.kind === "company" ? reviewRow.businessName : undefined,
      ssmNumber: reviewRow.kind === "company" ? reviewRow.ssmNumber : undefined,
      requestId:
        reviewStr(g.onboarding_request_id) || reviewStr(g.onboardingRequestId) || undefined,
      onboardingVerifyLink: reviewStr(g.onboarding_verify_link) || undefined,
      regtankPortalUrl: reviewStr(g.regtank_portal_url) || undefined,
      amlStatus: isStatusValid ? amlStatus : "Pending",
      amlMessageStatus: isAmlMessageValid ? amlMessageStatus : isMessageValid ? message : "PENDING",
      amlScreening,
    });
  }
  return entries;
}

function parseRelationalGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  const sorted = [...raw]
    .map((item) => (item && typeof item === "object" ? (item as RelationalGuarantorEntry) : null))
    .filter((item): item is RelationalGuarantorEntry => Boolean(item))
    .sort((a, b) => (typeof a.position === "number" ? a.position : 0) - (typeof b.position === "number" ? b.position : 0));

  for (const entry of sorted) {
    const nested =
      entry.guarantor && typeof entry.guarantor === "object" && !Array.isArray(entry.guarantor)
        ? entry.guarantor
        : null;
    const g = (nested ?? entry) as Record<string, unknown>;
    const linkId = reviewStr(entry.id) || reviewStr(g.id);
    if (!linkId) continue;
    const ref = reviewStr(entry.client_guarantor_id) || linkId;
    const guarantorType = g.guarantor_type === "company" ? "company" : "individual";
    const agreement = guarantorAgreementFromRelationalEntry(entry, g);
    if (guarantorType === "individual") {
      const legacyFirst = reviewStr(g.first_name);
      const legacyLast = reviewStr(g.last_name);
      const name =
        reviewStr(g.name) || [legacyFirst, legacyLast].filter(Boolean).join(" ").trim();
      const nationalityCode = guarantorNationalityCodeFromRelational(entry, g);
      rows.push({
        kind: "individual",
        referenceId: ref,
        name,
        icNumber: reviewStr(g.ic_number ?? g.government_id_number),
        nationalityCode,
        email: normalizeEmail(g.email),
        ...(agreement ? { guarantorAgreement: agreement } : {}),
      });
      continue;
    }
    rows.push({
      kind: "company",
      referenceId: ref,
      businessName: reviewStr(g.business_name ?? g.company_name),
      ssmNumber: reviewStr(g.ssm_number ?? g.business_id_number),
      email: normalizeEmail(g.email),
      ...(agreement ? { guarantorAgreement: agreement } : {}),
    });
  }
  return rows;
}

function GuarantorAmlScreeningCard({ screening }: { screening: GuarantorAmlScreeningSnapshot }) {
  const hasCounts =
    screening.possibleMatchCount !== undefined || screening.blacklistedMatchCount !== undefined;
  const hasFooter = screening.requestId || screening.screeningUpdatedAt;
  const scoreLabel = screening.riskScore?.trim() ?? "";
  const hasScore = scoreLabel.length > 0;
  const riskLevelLabel = screening.riskLevel?.trim() ?? "";
  const hasRiskLevel = riskLevelLabel.length > 0;

  if (
    !screening.regtankStatus &&
    !hasCounts &&
    !hasFooter &&
    !hasScore &&
    !hasRiskLevel
  ) {
    return null;
  }

  let screeningDate: string | null = null;
  if (screening.screeningUpdatedAt) {
    const d = new Date(screening.screeningUpdatedAt);
    screeningDate = Number.isNaN(d.getTime()) ? null : format(d, "PPpp");
  }

  return (
    <Card className="rounded-xl border-dashed">
      <CardHeader className="pb-2 pt-3">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <ShieldExclamationIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          KYC/AML screening
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pb-3 pt-0">
        {screening.regtankStatus || hasRiskLevel || hasScore ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {screening.regtankStatus ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge className={kycAmlScreeningStatusBadgeClass(screening.regtankStatus)}>
                  {screening.regtankStatus}
                </Badge>
              </div>
            ) : null}
            {hasRiskLevel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Risk Level:</span>
                <Badge className={kycAmlScreeningRiskLevelBadgeClass(screening.riskLevel)}>
                  {riskLevelLabel}
                </Badge>
              </div>
            ) : null}
            {hasScore ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Risk Score:</span>
                <Badge variant="outline" className="font-mono tabular-nums">
                  {scoreLabel}
                </Badge>
              </div>
            ) : null}
          </div>
        ) : null}

        {hasCounts ? (
          <div className="flex flex-wrap gap-3 rounded-lg bg-muted/50 p-2.5">
            {screening.possibleMatchCount !== undefined ? (
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    screening.possibleMatchCount > 0 ? "text-amber-500" : "text-muted-foreground"
                  }`}
                  aria-hidden
                />
                <span className="text-xs">
                  <span className="font-medium">{screening.possibleMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    possible {screening.possibleMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            ) : null}
            {screening.blacklistedMatchCount !== undefined ? (
              <div className="flex items-center gap-2">
                <ShieldExclamationIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    screening.blacklistedMatchCount > 0 ? "text-red-500" : "text-muted-foreground"
                  }`}
                  aria-hidden
                />
                <span className="text-xs">
                  <span className="font-medium">{screening.blacklistedMatchCount}</span>{" "}
                  <span className="text-muted-foreground">
                    blacklisted {screening.blacklistedMatchCount === 1 ? "match" : "matches"}
                  </span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {screening.requestId || screeningDate ? (
          <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            {screening.requestId ? (
              <div>
                <div className="text-[11px] text-muted-foreground">Request ID</div>
                <div className="font-mono text-xs break-all">{screening.requestId}</div>
              </div>
            ) : null}
            {screeningDate ? (
              <div className="sm:col-span-2">
                <div className="text-[11px] text-muted-foreground">Screening updated</div>
                <div>{screeningDate}</div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function parseBusinessDetails(raw: unknown, relationalGuarantors?: GuarantorReviewRow[]): BusinessDetailsView | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const a = (r.about_your_business ?? r.aboutYourBusiness) as Record<string, unknown> | undefined;
  const w = (r.why_raising_funds ?? r.whyRaisingFunds) as Record<string, unknown> | undefined;

  const bool = (v: unknown): boolean | null => {
    if (v === true || v === "yes") return true;
    if (v === false || v === "no") return false;
    return null;
  };

  const str = reviewStr;
  const supportDocsRaw = w?.supporting_documents ?? w?.supportingDocuments;
  const supportingDocuments = Array.isArray(supportDocsRaw)
    ? supportDocsRaw
        .map((doc, index) => {
          if (!doc || typeof doc !== "object") return null;
          const row = doc as Record<string, unknown>;
          const s3Key = reviewStr(row.s3_key ?? row.s3Key);
          if (!s3Key) return null;
          const fileName =
            reviewStr(row.file_name ?? row.fileName) || `Supporting Document ${index + 1}.pdf`;
          const sz = row.file_size ?? row.fileSize;
          const fileSize =
            typeof sz === "number" && Number.isFinite(sz) && sz > 0 ? sz : undefined;
          return { s3Key, fileName, ...(fileSize != null ? { fileSize } : {}) };
        })
        .filter((d): d is { s3Key: string; fileName: string; fileSize?: number } => Boolean(d))
    : [];

  const num = (v: unknown): number | null => {
    if (typeof v === "number" && !Number.isNaN(v)) return v;
    if (typeof v === "string") {
      const parsed = parseFloat(v.replace(/[^0-9.-]/g, ""));
      return Number.isNaN(parsed) ? null : parsed;
    }
    return null;
  };

  return {
    about: {
      whatDoesCompanyDo: str(a?.what_does_company_do ?? a?.whatDoesCompanyDo) || REVIEW_EMPTY_LABEL,
      mainCustomers: str(a?.main_customers ?? a?.mainCustomers) || REVIEW_EMPTY_LABEL,
      singleCustomerOver50Revenue: bool(a?.single_customer_over_50_revenue ?? a?.singleCustomerOver50Revenue),
    },
    whyRaisingFunds: {
      financingFor: str(w?.financing_for ?? w?.financingFor) || REVIEW_EMPTY_LABEL,
      howFundsUsed: str(w?.how_funds_used ?? w?.howFundsUsed) || REVIEW_EMPTY_LABEL,
      businessPlan: str(w?.business_plan ?? w?.businessPlan) || REVIEW_EMPTY_LABEL,
      risksDelayRepayment: str(w?.risks_delay_repayment ?? w?.risksDelayRepayment) || REVIEW_EMPTY_LABEL,
      backupPlan: str(w?.backup_plan ?? w?.backupPlan) || REVIEW_EMPTY_LABEL,
      raisingOnOtherP2P: bool(w?.raising_on_other_p2p ?? w?.raisingOnOtherP2P),
      platformName: str(w?.platform_name ?? w?.platformName) || REVIEW_EMPTY_LABEL,
      amountRaised: num(w?.amount_raised ?? w?.amountRaised),
      sameInvoiceUsed: bool(w?.same_invoice_used ?? w?.sameInvoiceUsed),
      accountingSoftware: str(w?.accounting_software ?? w?.accountingSoftware) || REVIEW_EMPTY_LABEL,
      supportingDocuments,
    },
    declarationConfirmed: Boolean(r.declaration_confirmed ?? r.declarationConfirmed),
    guarantors:
      relationalGuarantors && relationalGuarantors.length > 0
        ? relationalGuarantors
        : parseGuarantors(r.guarantors),
  };
}

function guarantorKindLabel(kind: "individual" | "company"): string {
  return kind === "individual" ? "Individual" : "Company";
}

/** Collapsed-card subtitle (individual name or company name). */
function guarantorReviewSubtitle(g: GuarantorReviewRow): string {
  if (g.kind === "individual") {
    return g.name.trim();
  }
  return g.businessName.trim();
}

function sideGuarantorTypeLabel(g: GuarantorReviewRow | undefined): string {
  return g ? guarantorKindLabel(g.kind) : "—";
}

/**
 * SECTION: Guarantor CTOS toolbar (Get / View subject report)
 * WHY: Guarantors are not on issuer org JSON; POST uses `enquiryOverride` like director comparison CTOS.
 * INPUT: application id, guarantor row, subject report map from API
 * OUTPUT: Buttons + last fetch hint
 * WHERE USED: Guarantor card header (single + resubmit comparison)
 */
function GuarantorCtosToolbar({
  applicationId,
  guarantor,
  subjectReportByRef,
  ctosSubjectLoading,
  createSubjectPending,
  onOpenSubjectHtml,
  onRequestGetReport,
  comparisonSide,
  missingGuarantorReason,
  align = "end",
  showLastFetch = true,
  compactLabels = false,
}: {
  applicationId?: string;
  guarantor?: GuarantorReviewRow;
  subjectReportByRef: Map<string, { id: string; has_report_html: boolean; fetched_at: string }>;
  ctosSubjectLoading: boolean;
  createSubjectPending: boolean;
  onOpenSubjectHtml: (reportId: string) => void | Promise<void>;
  onRequestGetReport: (g: GuarantorReviewRow) => void;
  comparisonSide?: "before" | "after";
  missingGuarantorReason?: string;
  /** `end`: right-align block (single guarantor CTOS column). `start`: left-align (Before/After columns). */
  align?: "start" | "end";
  showLastFetch?: boolean;
  /** Shorter button text for one-row comparison headers; full phrase kept in `title`. */
  compactLabels?: boolean;
}) {
  const snap = guarantor ? lookupSubjectReportSnapForGuarantor(subjectReportByRef, guarantor) : undefined;
  const subjectRef = guarantor ? ctosSubjectReportLookupKeyFromGuarantor(guarantor) : null;
  const canView = Boolean(snap?.has_report_html);
  const noRow = !guarantor;
  const viewDisabled =
    noRow ||
    !applicationId ||
    !subjectRef ||
    !canView ||
    ctosSubjectLoading ||
    !snap?.id;
  const getDisabled =
    noRow || !applicationId || !subjectRef || createSubjectPending || ctosSubjectLoading;
  const viewTitle = viewDisabled
    ? noRow
      ? missingGuarantorReason ?? "No guarantor on this side."
      : !canView
        ? `No stored CTOS report for this subject yet. Use ${CTOS_UI.fetchReport} first.`
        : !applicationId
          ? "Issuer organization id is missing."
          : undefined
    : undefined;
  const getTitle = getDisabled
    ? noRow
      ? missingGuarantorReason ?? "No guarantor on this side."
      : !subjectRef
        ? "IC number or SSM number is required to fetch CTOS."
        : undefined
    : undefined;
  const viewLabelLong =
    comparisonSide === "before"
      ? `${CTOS_UI.viewReport} (before)`
      : comparisonSide === "after"
        ? `${CTOS_UI.viewReport} (after)`
        : CTOS_UI.viewReport;
  const getLabelBase =
    comparisonSide === "before"
      ? `${CTOS_UI.fetchReport} (before)`
      : comparisonSide === "after"
        ? `${CTOS_UI.fetchReport} (after)`
        : CTOS_UI.fetchReport;
  const viewLabel = compactLabels ? CTOS_UI.viewShort : viewLabelLong;
  const getLabel = createSubjectPending
    ? CTOS_UI.fetching
    : compactLabels
      ? CTOS_UI.fetchShort
      : getLabelBase;

  const lastFetchForTitle = guarantor
    ? snap?.fetched_at
      ? `Last CTOS fetch: ${formatCtosFetchedAtShort(snap.fetched_at) ?? snap.fetched_at}`
      : "Last CTOS fetch: none yet"
    : (missingGuarantorReason ?? "No guarantor");

  const viewButtonTitle = viewDisabled
    ? viewTitle
    : compactLabels
      ? `${viewLabelLong}. ${lastFetchForTitle}`
      : viewTitle;
  const getButtonTitle = getDisabled
    ? getTitle
    : compactLabels
      ? `${getLabelBase}. ${lastFetchForTitle}`
      : getTitle;

  const justify = align === "start" ? "justify-start" : "justify-end";
  const textAlign = align === "start" ? "text-start" : "text-end";

  return (
    <div className={cn("flex min-w-0 flex-nowrap items-center gap-x-2 gap-y-0", justify)}>
      {showLastFetch ? (
        <span
          className={cn(
            "max-w-[11rem] shrink truncate text-xs text-muted-foreground",
            textAlign
          )}
          title="Last CTOS fetch"
        >
          {guarantor ? (
            guarantorCtosLastFetchLabel(guarantor, snap)
          ) : (
            <span>{CTOS_HEADER_PLACEHOLDER}</span>
          )}
        </span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, "shrink-0")}
        disabled={viewDisabled}
        title={viewButtonTitle}
        onClick={(e) => {
          e.stopPropagation();
          if (!snap?.id) return;
          void onOpenSubjectHtml(snap.id);
        }}
      >
        {viewLabel}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className={cn(CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, "shrink-0")}
        disabled={getDisabled}
        title={getButtonTitle}
        onClick={(e) => {
          e.stopPropagation();
          if (!guarantor) return;
          onRequestGetReport(guarantor);
        }}
      >
        {getLabel}
      </Button>
    </div>
  );
}

function AdminGuarantorSingleList({
  guarantors,
  amlByKey,
  onTriggerGuarantorAml,
  applicationId,
  subjectReportByRef,
  ctosSubjectLoading,
  createSubjectPending,
  onOpenSubjectHtml,
  onRequestGuarantorCtos,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
}: {
  guarantors: GuarantorReviewRow[];
  amlByKey: Map<string, GuarantorAmlEntry>;
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  applicationId?: string;
  subjectReportByRef: Map<string, { id: string; has_report_html: boolean; fetched_at: string }>;
  ctosSubjectLoading: boolean;
  createSubjectPending: boolean;
  onOpenSubjectHtml: (reportId: string) => void | Promise<void>;
  onRequestGuarantorCtos: (g: GuarantorReviewRow) => void;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const [panelOpen, setPanelOpen] = React.useState<Record<number, boolean>>({});
  const count = guarantors.length;

  React.useEffect(() => {
    setPanelOpen((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) {
        if (next[i] === undefined) next[i] = true;
      }
      for (const k of Object.keys(next)) {
        const n = Number(k);
        if (n >= count) delete next[n];
      }
      return next;
    });
  }, [count]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 px-1 sm:px-2">
      {guarantors.map((g, idx) => {
        const open = panelOpen[idx] !== undefined ? panelOpen[idx]! : true;
        const subtitle = guarantorReviewSubtitle(g);
        const aml = amlByKey.get(buildGuarantorAmlKey(g));
        return (
          <details
            key={idx}
            className="group rounded-xl border border-border bg-background"
            open={open}
            onToggle={(e) => {
              const d = e.currentTarget;
              setPanelOpen((p) => ({ ...p, [idx]: d.open }));
            }}
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                    <span className="shrink-0 text-sm font-semibold text-foreground leading-6">
                      Guarantor {idx + 1}
                    </span>
                    <ChevronRightIcon
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                      aria-hidden
                    />
                    {subtitle ? (
                      <span className="min-w-0 truncate text-sm text-muted-foreground leading-6">
                        {subtitle}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="flex min-w-0 shrink-0 items-center gap-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RegTankGuarantorControlRow
                      mode="single"
                      guarantor={g}
                      amlByKey={amlByKey}
                      onTriggerGuarantorAml={onTriggerGuarantorAml}
                    />
                    <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                    <GuarantorCtosToolbar
                      applicationId={applicationId}
                      guarantor={g}
                      subjectReportByRef={subjectReportByRef}
                      ctosSubjectLoading={ctosSubjectLoading}
                      createSubjectPending={createSubjectPending}
                      onOpenSubjectHtml={onOpenSubjectHtml}
                      onRequestGetReport={onRequestGuarantorCtos}
                    />
                  </div>
                </div>
              </div>
            </summary>
            <div className="px-4 pb-4 pt-3 space-y-4">
              {aml?.amlScreening ? (
                <GuarantorAmlScreeningCard screening={aml.amlScreening} />
              ) : null}
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Guarantor type</Label>
                <ReviewValue value={guarantorKindLabel(g.kind)} />
                {g.kind === "individual" ? (
                  <>
                    <Label className={reviewLabelClass}>Name</Label>
                    <ReviewValue value={g.name || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>IC number</Label>
                    <ReviewValue value={g.icNumber || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Nationality</Label>
                    <ReviewValue
                      value={
                        g.nationalityCode
                          ? regtankNationalityDisplayLabel(g.nationalityCode)
                          : REVIEW_EMPTY_LABEL
                      }
                    />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                  </>
                ) : (
                  <>
                    <Label className={reviewLabelClass}>Business name</Label>
                    <ReviewValue value={g.businessName || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>SSM number</Label>
                    <ReviewValue value={g.ssmNumber || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                  </>
                )}
                <Label className={reviewLabelClass}>Guarantor agreement</Label>
                <div className="min-h-0 h-9 flex items-center justify-start">
                  {g.guarantorAgreement?.s3Key ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 gap-1"
                        onClick={() => onViewDocument(g.guarantorAgreement!.s3Key)}
                        disabled={viewDocumentPending}
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 gap-1"
                        onClick={() =>
                          onDownloadDocument(
                            g.guarantorAgreement!.s3Key,
                            g.guarantorAgreement!.fileName
                          )
                        }
                        disabled={viewDocumentPending}
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Download
                      </Button>
                    </div>
                  ) : (
                    REVIEW_EMPTY_LABEL
                  )}
                </div>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}

function AdminGuarantorComparisonList({
  b,
  a,
  amlByKey,
  isPathChanged,
  applicationId,
  subjectReportByRef,
  ctosSubjectLoading,
  createSubjectPending,
  onOpenSubjectHtml,
  onRequestGuarantorCtos,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
}: {
  b: BusinessDetailsView;
  a: BusinessDetailsView;
  amlByKey: Map<string, GuarantorAmlEntry>;
  isPathChanged: (path: string) => boolean;
  applicationId?: string;
  subjectReportByRef: Map<string, { id: string; has_report_html: boolean; fetched_at: string }>;
  ctosSubjectLoading: boolean;
  createSubjectPending: boolean;
  onOpenSubjectHtml: (reportId: string) => void | Promise<void>;
  onRequestGuarantorCtos: (g: GuarantorReviewRow) => void;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const count = Math.max(b.guarantors.length, a.guarantors.length);
  const [panelOpen, setPanelOpen] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    setPanelOpen((prev) => {
      const next = { ...prev };
      for (let i = 0; i < count; i++) {
        if (next[i] === undefined) next[i] = true;
      }
      for (const k of Object.keys(next)) {
        const n = Number(k);
        if (n >= count) delete next[n];
      }
      return next;
    });
  }, [count]);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 px-1 sm:px-2">
      {Array.from({ length: count }).map((_, idx) => {
        const gB = b.guarantors[idx];
        const gA = a.guarantors[idx];
        const hasBeforeGuarantor = gB != null;
        const hasAfterGuarantor = gA != null;
        const changed =
          isPathChanged("business_details") || isPathChanged(`business_details.guarantors[${idx}]`);
        const open = panelOpen[idx] !== undefined ? panelOpen[idx]! : true;
        const subtitleSource = gA ?? gB;
        const subtitle = subtitleSource ? guarantorReviewSubtitle(subtitleSource) : "";
        const showIndividual = gB?.kind === "individual" || gA?.kind === "individual";
        const showCompany = gB?.kind === "company" || gA?.kind === "company";

        return (
          <details
            key={idx}
            className="group rounded-xl border border-border bg-background"
            open={open}
            onToggle={(e) => {
              const d = e.currentTarget;
              setPanelOpen((p) => ({ ...p, [idx]: d.open }));
            }}
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
                    <span className="shrink-0 text-sm font-semibold text-foreground leading-6">
                      Guarantor {idx + 1}
                    </span>
                    <ChevronRightIcon
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-90"
                      aria-hidden
                    />
                    {subtitle ? (
                      <span className="min-w-0 truncate text-sm text-muted-foreground leading-6">
                        {subtitle}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-3"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RegTankGuarantorControlRow
                      mode="comparison"
                      amlByKey={amlByKey}
                      comparisonSides={{
                        beforeAvailable: hasBeforeGuarantor,
                        afterAvailable: hasAfterGuarantor,
                      }}
                    />
                    <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
                    <span className="shrink-0 text-xs text-muted-foreground">Before</span>
                    <GuarantorCtosToolbar
                      applicationId={applicationId}
                      guarantor={gB}
                      subjectReportByRef={subjectReportByRef}
                      ctosSubjectLoading={ctosSubjectLoading}
                      createSubjectPending={createSubjectPending}
                      onOpenSubjectHtml={onOpenSubjectHtml}
                      onRequestGetReport={onRequestGuarantorCtos}
                      comparisonSide="before"
                      missingGuarantorReason="No guarantor in the earlier revision for this row."
                      align="start"
                      showLastFetch={false}
                      compactLabels
                    />
                    <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                    <span className="shrink-0 text-xs text-muted-foreground">After</span>
                    <GuarantorCtosToolbar
                      applicationId={applicationId}
                      guarantor={gA}
                      subjectReportByRef={subjectReportByRef}
                      ctosSubjectLoading={ctosSubjectLoading}
                      createSubjectPending={createSubjectPending}
                      onOpenSubjectHtml={onOpenSubjectHtml}
                      onRequestGetReport={onRequestGuarantorCtos}
                      comparisonSide="after"
                      missingGuarantorReason="No guarantor in the later revision for this row."
                      align="start"
                      showLastFetch={false}
                      compactLabels
                    />
                  </div>
                </div>
              </div>
            </summary>
            <div className="space-y-2 px-4 pb-4 pt-3">
              <ComparisonFieldRow
                label="Guarantor type"
                before={sideGuarantorTypeLabel(gB)}
                after={sideGuarantorTypeLabel(gA)}
                changed={changed}
              />
              {showIndividual ? (
                <div className="space-y-2">
                  <ComparisonFieldRow
                    label="Name"
                    before={gB?.kind === "individual" ? gB.name : "—"}
                    after={gA?.kind === "individual" ? gA.name : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="IC number"
                    before={gB?.kind === "individual" ? gB.icNumber : "—"}
                    after={gA?.kind === "individual" ? gA.icNumber : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Nationality"
                    before={
                      gB?.kind === "individual" && gB.nationalityCode
                        ? regtankNationalityDisplayLabel(gB.nationalityCode)
                        : "—"
                    }
                    after={
                      gA?.kind === "individual" && gA.nationalityCode
                        ? regtankNationalityDisplayLabel(gA.nationalityCode)
                        : "—"
                    }
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Email"
                    before={
                      gB?.kind === "individual"
                        ? gB.email || REVIEW_EMPTY_LABEL
                        : "—"
                    }
                    after={
                      gA?.kind === "individual"
                        ? gA.email || REVIEW_EMPTY_LABEL
                        : "—"
                    }
                    changed={changed}
                  />
                </div>
              ) : null}
              {showCompany ? (
                <div className="space-y-2">
                  <ComparisonFieldRow
                    label="Business name"
                    before={gB?.kind === "company" ? gB.businessName : "—"}
                    after={gA?.kind === "company" ? gA.businessName : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="SSM number"
                    before={gB?.kind === "company" ? gB.ssmNumber : "—"}
                    after={gA?.kind === "company" ? gA.ssmNumber : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Email"
                    before={
                      gB?.kind === "company" ? gB.email || REVIEW_EMPTY_LABEL : "—"
                    }
                    after={
                      gA?.kind === "company" ? gA.email || REVIEW_EMPTY_LABEL : "—"
                    }
                    changed={changed}
                  />
                </div>
              ) : null}
              <ComparisonDocumentTitleRow
                title="Guarantor agreement"
                beforeFiles={businessSupportingDocsToChips(
                  gB?.guarantorAgreement ? [gB.guarantorAgreement] : []
                )}
                afterFiles={businessSupportingDocsToChips(
                  gA?.guarantorAgreement ? [gA.guarantorAgreement] : []
                )}
                markChanged={
                  changed ||
                  (gB?.guarantorAgreement?.s3Key ?? "") !==
                    (gA?.guarantorAgreement?.s3Key ?? "")
                }
                onViewDocument={onViewDocument}
                onDownloadDocument={onDownloadDocument}
                viewDocumentPending={viewDocumentPending}
              />
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * SECTION: Declaration side-by-side in resubmit comparison
 * WHY: Same checkbox + statement as live review, not "Confirmed" text.
 */
function ComparisonDeclarationRow({
  beforeConfirmed,
  afterConfirmed,
  changed,
}: {
  beforeConfirmed: boolean;
  afterConfirmed: boolean;
  changed: boolean;
}) {
  const valuesDiffer = beforeConfirmed !== afterConfirmed;
  return (
    <div
      className="py-2 space-y-3"
      role="group"
      aria-label={
        valuesDiffer || changed
          ? "Declarations, confirmation differs between revisions"
          : "Declarations"
      }
    >
      <div className={comparisonSplitRowGridClass}>
        <div className={comparisonSplitBeforeColClass}>
          <ComparisonDeclarationCell
            confirmed={beforeConfirmed}
            side="before"
            valuesDiffer={valuesDiffer}
          />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <ComparisonDeclarationCell
            confirmed={afterConfirmed}
            side="after"
            valuesDiffer={valuesDiffer}
          />
        </div>
      </div>
    </div>
  );
}

const yesNoScaleWrapper = "inline-block scale-[0.88] origin-left";

export function BusinessSection({
  applicationId = "",
  issuerOrganizationId = null,
  issuerOrganization = null,
  businessDetails,
  applicationGuarantors,
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
  onTriggerGuarantorAml,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
}: BusinessSectionProps) {
  const ctosAppId = applicationId.trim() || undefined;
  const issuerOrgId = issuerOrganizationId?.trim() || undefined;
  const { getAccessToken } = useAuthToken();
  const ctosSubjectLoading = false;
  const createSubjectCtos = useCreateIssuerOrganizationCtosSubjectReport(
    issuerOrgId,
    ctosAppId
  );

  const subjectReportByRef = React.useMemo(() => {
    const m = new Map<string, { id: string; has_report_html: boolean; fetched_at: string }>();
    const raw = issuerOrganization?.latest_organization_ctos_subject_reports;
    for (const r of raw ?? []) {
      const ref = r.subject_ref;
      if (!ref) continue;
      const k = ref.trim().replace(/\s+/g, "").toLowerCase();
      m.set(k, {
        id: r.id,
        has_report_html: Boolean(r.has_report_html),
        fetched_at: r.fetched_at,
      });
    }
    return m;
  }, [issuerOrganization?.latest_organization_ctos_subject_reports]);

  const openSubjectHtmlReport = React.useCallback(
    async (reportId: string) => {
      if (!issuerOrgId) return;
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/organizations/issuer/${encodeURIComponent(issuerOrgId)}/ctos-reports/${reportId}/html`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        toast.error("Could not load report");
        return;
      }
      const html = await res.text();
      const w = window.open("", "_blank");
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    },
    [issuerOrgId, getAccessToken]
  );

  const onCreateGuarantorSubjectCtos = React.useCallback(
    (g: GuarantorReviewRow) => {
      if (!issuerOrgId) return;
      const subjectRef = ctosSubjectReportLookupKeyFromGuarantor(g);
      if (!subjectRef) return;
      const subjectKind = g.kind === "individual" ? "INDIVIDUAL" : "CORPORATE";
      const displayName = (g.kind === "individual" ? g.name : g.businessName).trim();
      const idNumberRaw = g.kind === "individual" ? g.icNumber : g.ssmNumber;
      const idNumber = String(idNumberRaw).trim();
      const t = toast.loading("Fetching CTOS report…");
      createSubjectCtos.mutate(
        {
          subjectRef,
          subjectKind,
          enquiryOverride: {
            displayName: displayName || subjectRef,
            idNumber: idNumber.replace(/\s+/g, "") || subjectRef,
          },
        },
        {
          onSuccess: () => {
            toast.dismiss(t);
            toast.success("CTOS report saved.");
          },
          onError: (e: Error) => {
            toast.dismiss(t);
            toast.error(e.message || "CTOS request failed");
          },
        }
      );
    },
    [issuerOrgId, createSubjectCtos]
  );

  const [pendingGuarantorCtos, setPendingGuarantorCtos] = React.useState<GuarantorReviewRow | null>(null);

  const guarantorCtosConfirmDialog = (
    <AlertDialog
      open={pendingGuarantorCtos != null}
      onOpenChange={(open) => {
        if (!open) setPendingGuarantorCtos(null);
      }}
    >
      <AlertDialogContent className="rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{CTOS_CONFIRM.title}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              {pendingGuarantorCtos ? (
                <>
                  <p className="m-0">{CTOS_CONFIRM.subjectLead}</p>
                  <p className="m-0">
                    <span className="font-medium text-foreground">Type:</span>{" "}
                    {pendingGuarantorCtos.kind === "individual" ? "Individual" : "Company"}
                  </p>
                  <p className="m-0">
                    <span className="font-medium text-foreground">Name:</span>{" "}
                    {pendingGuarantorCtos.kind === "individual"
                      ? pendingGuarantorCtos.name
                      : pendingGuarantorCtos.businessName}
                  </p>
                  <p className="m-0">
                    <span className="font-medium text-foreground">ID:</span>{" "}
                    {pendingGuarantorCtos.kind === "individual"
                      ? pendingGuarantorCtos.icNumber || "—"
                      : pendingGuarantorCtos.ssmNumber || "—"}
                  </p>
                </>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-lg" disabled={createSubjectCtos.isPending}>
            {CTOS_CONFIRM.cancel}
          </AlertDialogCancel>
          <AlertDialogAction
            className={cn(buttonVariants({ variant: "secondary" }), "rounded-lg")}
            disabled={createSubjectCtos.isPending}
            onClick={() => {
              if (pendingGuarantorCtos) onCreateGuarantorSubjectCtos(pendingGuarantorCtos);
              setPendingGuarantorCtos(null);
            }}
          >
            {createSubjectCtos.isPending ? CTOS_UI.fetching : CTOS_CONFIRM.primaryAction}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const guarantorAmlEntries = React.useMemo(
    () => parseGuarantorAmlEntries(applicationGuarantors),
    [applicationGuarantors]
  );
  const guarantorAmlByKey = React.useMemo(() => {
    const m = new Map<string, GuarantorAmlEntry>();
    for (const entry of guarantorAmlEntries) {
      m.set(entry.orgGuarantorKey, entry);
    }
    return m;
  }, [guarantorAmlEntries]);

  if (sectionComparison) {
    const vb = parseBusinessDetails(
      sectionComparison.beforeDetails,
      parseRelationalGuarantors(sectionComparison.beforeGuarantors)
    );
    const va = parseBusinessDetails(
      sectionComparison.afterDetails,
      parseRelationalGuarantors(sectionComparison.afterGuarantors)
    );
    const { isPathChanged } = sectionComparison;
    const money = (n: number | null) => (n != null ? formatCurrency(n) : REVIEW_EMPTY_LABEL);
    if (!vb && !va) {
      return (
        <ReviewSectionCard
          title="Business & Guarantor Details"
          icon={DocumentTextIcon}
          section={section}
          isReviewable={false}
        >
          <p className={reviewEmptyStateClass}>No business details in these snapshots.</p>
        </ReviewSectionCard>
      );
    }

    const b = vb ?? va!;
    const a = va ?? vb!;
    const showP2PBefore = b.whyRaisingFunds.raisingOnOtherP2P === true;
    const showP2PAfter = a.whyRaisingFunds.raisingOnOtherP2P === true;

    return (
      <>
        <ReviewSectionCard
          title="Business & Guarantor Details"
          icon={DocumentTextIcon}
          section={section}
          isReviewable={false}
        >
          <ReviewFieldBlock title="About Your Business">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="What Does Your Company Do?"
              before={b.about.whatDoesCompanyDo}
              after={a.about.whatDoesCompanyDo}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonFieldRow
              label="Who Are Your Main Customers?"
              before={b.about.mainCustomers}
              after={a.about.mainCustomers}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonYesNoRadioRow
              label="Does Any Single Customer Make Up More Than 50% of Your Revenue?"
              beforeValue={vb?.about.singleCustomerOver50Revenue ?? null}
              afterValue={va?.about.singleCustomerOver50Revenue ?? null}
              changed={isPathChanged("business_details")}
            />
            <ComparisonFieldRow
              label="Which Accounting Software Does the Issuer Use?"
              before={b.whyRaisingFunds.accountingSoftware}
              after={a.whyRaisingFunds.accountingSoftware}
              changed={isPathChanged("business_details")}
            />
          </div>
        </ReviewFieldBlock>

        <ReviewFieldBlock title="Why Are You Raising Funds?">
          <div className="space-y-2">
            <ComparisonFieldRow
              label="What Is This Financing For?"
              before={b.whyRaisingFunds.financingFor}
              after={a.whyRaisingFunds.financingFor}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonFieldRow
              label="How Will the Funds Be Used?"
              before={b.whyRaisingFunds.howFundsUsed}
              after={a.whyRaisingFunds.howFundsUsed}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonFieldRow
              label="Tell Us About Your Business Plan"
              before={b.whyRaisingFunds.businessPlan}
              after={a.whyRaisingFunds.businessPlan}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonFieldRow
              label="Are There Any Risks That May Delay Repayment of Your Invoices?"
              before={b.whyRaisingFunds.risksDelayRepayment}
              after={a.whyRaisingFunds.risksDelayRepayment}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonFieldRow
              label="If Payment Is Delayed, What Is Your Backup Plan?"
              before={b.whyRaisingFunds.backupPlan}
              after={a.whyRaisingFunds.backupPlan}
              changed={isPathChanged("business_details")}
              multiline
            />
            <ComparisonDocumentTitleRow
              title="Relevant Supporting Documents for This Section"
              beforeFiles={businessSupportingDocsToChips(vb?.whyRaisingFunds?.supportingDocuments ?? [])}
              afterFiles={businessSupportingDocsToChips(va?.whyRaisingFunds?.supportingDocuments ?? [])}
              markChanged={isPathChanged("business_details")}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              viewDocumentPending={viewDocumentPending}
            />
            <ComparisonYesNoRadioRow
              label="Are You Currently Raising/Applying Funds on Any Other P2P Platforms?"
              beforeValue={vb?.whyRaisingFunds.raisingOnOtherP2P ?? null}
              afterValue={va?.whyRaisingFunds.raisingOnOtherP2P ?? null}
              changed={isPathChanged("business_details")}
            />
            {showP2PBefore || showP2PAfter ? (
              <>
                <ComparisonFieldRow
                  label="Name of Platform"
                  before={b.whyRaisingFunds.platformName}
                  after={a.whyRaisingFunds.platformName}
                  changed={isPathChanged("business_details")}
                />
                <ComparisonFieldRow
                  label="Amount Raised"
                  before={money(vb?.whyRaisingFunds.amountRaised ?? null)}
                  after={money(va?.whyRaisingFunds.amountRaised ?? null)}
                  changed={isPathChanged("business_details")}
                />
                <ComparisonYesNoRadioRow
                  label="Have the same invoices been used to apply for funding in the aforementioned platform?"
                  beforeValue={vb?.whyRaisingFunds.sameInvoiceUsed ?? null}
                  afterValue={va?.whyRaisingFunds.sameInvoiceUsed ?? null}
                  changed={isPathChanged("business_details")}
                />
              </>
            ) : null}
          </div>
        </ReviewFieldBlock>

        {(b.guarantors.length > 0 || a.guarantors.length > 0) && (
          <ReviewFieldBlock title="Guarantor details">
            <AdminGuarantorComparisonList
              b={b}
              a={a}
              amlByKey={guarantorAmlByKey}
              isPathChanged={isPathChanged}
              applicationId={issuerOrgId ?? ""}
              subjectReportByRef={subjectReportByRef}
              ctosSubjectLoading={ctosSubjectLoading}
              createSubjectPending={createSubjectCtos.isPending}
              onOpenSubjectHtml={openSubjectHtmlReport}
              onRequestGuarantorCtos={setPendingGuarantorCtos}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              viewDocumentPending={viewDocumentPending}
            />
          </ReviewFieldBlock>
        )}

        <ReviewFieldBlock title="Declarations">
          <ComparisonDeclarationRow
            beforeConfirmed={vb?.declarationConfirmed ?? false}
            afterConfirmed={va?.declarationConfirmed ?? false}
            changed={isPathChanged("declarations")}
          />
        </ReviewFieldBlock>

        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
        </ReviewSectionCard>
        {guarantorCtosConfirmDialog}
      </>
    );
  }

  const view = parseBusinessDetails(businessDetails, parseRelationalGuarantors(applicationGuarantors));
  const showP2PFields = view?.whyRaisingFunds.raisingOnOtherP2P === true;
  const supportingFiles = view?.whyRaisingFunds.supportingDocuments ?? [];
  const canViewMultiple = supportingFiles.length > 1;
  const canViewSingle = supportingFiles.length === 1;

  return (
    <>
      <ReviewSectionCard
        title="Business & Guarantor Details"
        icon={DocumentTextIcon}
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
      {view ? (
        <>
          <ReviewFieldBlock title="About Your Business">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>What Does Your Company Do?</Label>
              <ReviewValue value={view.about.whatDoesCompanyDo} multiline />
              <Label className={reviewLabelClass}>Who Are Your Main Customers?</Label>
              <ReviewValue value={view.about.mainCustomers} multiline />
              <Label className={reviewLabelClass}>
                Does Any Single Customer Make Up More Than 50% of Your Revenue?
              </Label>
              <span className={yesNoScaleWrapper}>
                <YesNoRadioDisplay value={view.about.singleCustomerOver50Revenue} />
              </span>
              <Label className={reviewLabelClass}>Which Accounting Software Does the Issuer Use?</Label>
              <ReviewValue value={view.whyRaisingFunds.accountingSoftware} />
            </div>
          </ReviewFieldBlock>

          <ReviewFieldBlock title="Why Are You Raising Funds?">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>What Is This Financing For?</Label>
              <ReviewValue value={view.whyRaisingFunds.financingFor} multiline />
              <Label className={reviewLabelClass}>How Will the Funds Be Used?</Label>
              <ReviewValue value={view.whyRaisingFunds.howFundsUsed} multiline />
              <Label className={reviewLabelClass}>Tell Us About Your Business Plan</Label>
              <ReviewValue value={view.whyRaisingFunds.businessPlan} multiline />
              <Label className={reviewLabelClass}>
                Are There Any Risks That May Delay Repayment of Your Invoices?
              </Label>
              <ReviewValue value={view.whyRaisingFunds.risksDelayRepayment} multiline />
              <Label className={reviewLabelClass}>
                If Payment Is Delayed, What Is Your Backup Plan?
              </Label>
              <ReviewValue value={view.whyRaisingFunds.backupPlan} multiline />
              <Label className={reviewLabelClass}>
                Relevant Supporting Documents for This Section
              </Label>
              <div className="min-h-0 h-9 flex items-center justify-start">
                {supportingFiles.length > 0 ? (
                  <div className="flex items-center gap-2 shrink-0">
                    {canViewSingle && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 gap-1"
                        onClick={() => onViewDocument(supportingFiles[0]!.s3Key)}
                        disabled={viewDocumentPending}
                      >
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                        View
                      </Button>
                    )}
                    {canViewMultiple && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1"
                            disabled={viewDocumentPending}
                          >
                            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                            View
                            <ChevronDownIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                          {supportingFiles.map((f, fileIndex) => (
                            <DropdownMenuItem
                              key={`${f.s3Key}-${fileIndex}`}
                              onClick={() => onViewDocument(f.s3Key)}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate min-w-0">{f.fileName}</span>
                              <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    {canViewSingle && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg h-9 gap-1"
                        onClick={() =>
                          onDownloadDocument(
                            supportingFiles[0]!.s3Key,
                            supportingFiles[0]!.fileName
                          )
                        }
                        disabled={viewDocumentPending}
                      >
                        <ArrowDownTrayIcon className="h-4 w-4" />
                        Download
                      </Button>
                    )}
                    {canViewMultiple && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg h-9 gap-1"
                            disabled={viewDocumentPending}
                          >
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Download
                            <ChevronDownIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[220px]">
                          {supportingFiles.map((f, fileIndex) => (
                            <DropdownMenuItem
                              key={`${f.s3Key}-${fileIndex}-download`}
                              onClick={() => onDownloadDocument(f.s3Key, f.fileName)}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate min-w-0">{f.fileName}</span>
                              <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ) : (
                  REVIEW_EMPTY_LABEL
                )}
              </div>
              <Label className={reviewLabelClass}>
                Are You Currently Raising/Applying Funds on Any Other P2P Platforms?
              </Label>
              <span className={yesNoScaleWrapper}>
                <YesNoRadioDisplay value={view.whyRaisingFunds.raisingOnOtherP2P} />
              </span>
              {showP2PFields && (
                <>
                  <Label className={reviewLabelClass}>Name of Platform</Label>
                  <ReviewValue value={view.whyRaisingFunds.platformName} />
                  <Label className={reviewLabelClass}>Amount Raised</Label>
                  <div className={`${reviewValueClass} !min-h-0 h-9`}>
                    {view.whyRaisingFunds.amountRaised != null
                      ? formatCurrency(view.whyRaisingFunds.amountRaised)
                      : REVIEW_EMPTY_LABEL}
                  </div>
                  <Label className={reviewLabelClass}>Have the same invoices been used to apply for funding in the aforementioned platform?</Label>
                  <span className={yesNoScaleWrapper}>
                    <YesNoRadioDisplay value={view.whyRaisingFunds.sameInvoiceUsed} />
                  </span>
                </>
              )}
            </div>
          </ReviewFieldBlock>

          {view.guarantors.length > 0 && (
            <ReviewFieldBlock title="Guarantor details">
              <AdminGuarantorSingleList
                guarantors={view.guarantors}
                amlByKey={guarantorAmlByKey}
                onTriggerGuarantorAml={onTriggerGuarantorAml}
                applicationId={issuerOrgId ?? ""}
                subjectReportByRef={subjectReportByRef}
                ctosSubjectLoading={ctosSubjectLoading}
                createSubjectPending={createSubjectCtos.isPending}
                onOpenSubjectHtml={openSubjectHtmlReport}
                onRequestGuarantorCtos={setPendingGuarantorCtos}
                onViewDocument={onViewDocument}
                onDownloadDocument={onDownloadDocument}
                viewDocumentPending={viewDocumentPending}
              />
            </ReviewFieldBlock>
          )}

          <ReviewFieldBlock title="Declarations">
              <div className="rounded-lg border border-input bg-background p-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center ${
                      view.declarationConfirmed ? "bg-primary border-primary" : "border-muted-foreground"
                    }`}
                    aria-hidden
                  >
                    {view.declarationConfirmed && (
                      <svg
                        className="h-2.5 w-2.5 text-primary-foreground"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M2 6l3 3 5-6" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-foreground">{DECLARATION_TEXT}</span>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {view.declarationConfirmed ? "Confirmed" : "Not confirmed"}
                </p>
              </div>
          </ReviewFieldBlock>
        </>
      ) : (
        <p className={reviewEmptyStateClass}>No business details submitted.</p>
      )}
      {!hideSectionComments ? (
        <SectionComments comments={comments} onSubmitComment={onAddComment} />
      ) : null}
      </ReviewSectionCard>
      {guarantorCtosConfirmDialog}
    </>
  );
}
