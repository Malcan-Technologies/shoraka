"use client";

import * as React from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay, StatusBadge } from "@cashsouk/ui";
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
import { useCreateApplicationCtosSubjectReport } from "@/hooks/use-admin-issuer-organization-ctos-mutations";
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
  comparisonRowGridClass,
  comparisonSurfaceChangedAfterClass,
  comparisonSurfaceChangedBeforeClass,
} from "../review-section-styles";
import { ComparisonProjectedRow } from "../comparison-document-pair";
import { ComparisonRowList, ComparisonSideSlot } from "../comparison-field-row";
import type { ReviewSectionId } from "../section-types";
import {
  kycAmlScreeningRiskToken,
  kycAmlScreeningStatusToken,
} from "@/lib/kyc-aml-screening-badge-classes";
import { cn } from "@/lib/utils";
import { CTOS_ACTION_BUTTON_COMPACT_CLASSNAME, CTOS_CONFIRM, CTOS_UI } from "@/lib/ctos-ui-labels";
import { usePermissions } from "@/hooks/use-permissions";
import { regtankNationalityDisplayLabel } from "@cashsouk/types";
import {
  INHERITED_FACILITY_GUARANTORS_ADMIN_COPY,
  SC_MONTHLY_CAMPAIGN,
} from "@cashsouk/types";
import {
  buildGuarantorAmlKey,
  guarantorKindLabel,
  guarantorNationalityCodeFromRelational,
  guarantorRelationshipDisplay,
  guarantorReviewSubtitle,
  normalizeEmail,
  parseBusinessDetails,
  parseRelationalGuarantors,
  type GuarantorReviewRow,
  type RelationalGuarantorEntry,
} from "@/lib/resubmit-comparison/business-details-parse";
import {
  BUSINESS_DECLARATIONS_BLOCK_ID,
  businessGuarantorBlockSubtitle,
  isBusinessGuarantorBlock,
  projectBusinessComparison,
} from "@/lib/resubmit-comparison/business-projection";
import type { ComparisonBlock } from "@/lib/resubmit-comparison/projection-types";
import { isPlainObjectRecord, reviewStr } from "@/lib/resubmit-comparison/shared-format";

export type BusinessSectionComparisonProps = {
  beforeDetails: unknown;
  afterDetails: unknown;
  beforeGuarantors?: unknown;
  afterGuarantors?: unknown;
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
  guarantorsReviewMode?: "live" | "inherited";
  inheritedSourceApplication?: { id: string; productId: string | null };
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

/**
 * SECTION: One side of the declaration comparison row
 * WHY: Renders the live declaration box once per side; the changed tint sits on that box (no outer shell).
 * INPUT: confirmed per side, whether Before and After differ
 * OUTPUT: live checkbox + statement + Confirmed caption
 */
function ComparisonDeclarationCell({
  confirmed,
  side,
  valuesDiffer,
}: {
  confirmed: boolean;
  side: "before" | "after";
  valuesDiffer: boolean;
}) {
  const changedHighlight =
    valuesDiffer &&
    (side === "before" ? comparisonSurfaceChangedBeforeClass : comparisonSurfaceChangedAfterClass);
  return (
    <div className={cn("rounded-lg border border-input bg-background p-3", changedHighlight)}>
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
      <p className="mt-1.5 text-xs text-muted-foreground">
        {confirmed ? "Confirmed" : "Not confirmed"}
      </p>
    </div>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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

function guarantorCtosLastFetchDisplay(
  g: GuarantorReviewRow | undefined,
  snap?: { fetched_at: string }
): string | null {
  if (!g || !ctosSubjectReportLookupKeyFromGuarantor(g) || !snap?.fetched_at) return null;
  return formatCtosFetchedAtShort(snap.fetched_at) ?? snap.fetched_at;
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
            guarantorAgreements: [],
          }
        : {
            kind: "company",
            referenceId,
            businessName: reviewStr(g.business_name ?? g.company_name),
            ssmNumber: reviewStr(g.ssm_number ?? g.business_id_number),
            email: normalizeEmail(g.email),
            guarantorAgreements: [],
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
                <StatusBadge
                  label={screening.regtankStatus}
                  status={kycAmlScreeningStatusToken(screening.regtankStatus)}
                />
              </div>
            ) : null}
            {hasRiskLevel ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Risk Level:</span>
                <StatusBadge
                  label={riskLevelLabel}
                  status={kycAmlScreeningRiskToken(screening.riskLevel)}
                />
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
  canManageGuarantorCtos = true,
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
  canManageGuarantorCtos?: boolean;
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
    noRow ||
    !applicationId ||
    !subjectRef ||
    createSubjectPending ||
    ctosSubjectLoading ||
    !canManageGuarantorCtos;
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
    ? !canManageGuarantorCtos
      ? "You do not have permission to perform this action."
      : noRow
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

  const lastFetchDisplay = guarantorCtosLastFetchDisplay(guarantor, snap);
  const lastFetchForTitle = lastFetchDisplay
    ? `Last CTOS fetch: ${lastFetchDisplay}`
    : guarantor
      ? "Last CTOS fetch: none yet"
      : (missingGuarantorReason ?? "No guarantor");

  const viewButtonTitle = viewDisabled
    ? viewTitle
    : compactLabels
      ? `${viewLabelLong}. ${lastFetchForTitle}`
      : lastFetchDisplay
        ? lastFetchForTitle
        : viewTitle;
  const getButtonTitle = getDisabled
    ? getTitle
    : compactLabels
      ? `${getLabelBase}. ${lastFetchForTitle}`
      : lastFetchDisplay
        ? lastFetchForTitle
        : getTitle;

  const justify = align === "start" ? "justify-start" : "justify-end";
  const textAlign = align === "start" ? "text-start" : "text-end";

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1", justify)}>
      {showLastFetch && lastFetchDisplay ? (
        <span
          className={cn(
            "max-w-[11rem] min-w-0 truncate text-xs tabular-nums text-muted-foreground",
            textAlign
          )}
          title={lastFetchForTitle}
        >
          {lastFetchDisplay}
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

const guarantorCardClass = "group min-w-0 rounded-xl border border-border bg-background";
const guarantorHeaderRowClass =
  "flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-2";
const guarantorHeaderTitleClass =
  "flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left";
const guarantorHeaderActionsClass =
  "ml-auto flex min-w-0 max-w-full flex-wrap items-center justify-end gap-2";

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
  canManageGuarantorCtos = true,
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
  canManageGuarantorCtos?: boolean;
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
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:gap-8 sm:px-2">
      {guarantors.map((g, idx) => {
        const open = panelOpen[idx] !== undefined ? panelOpen[idx]! : true;
        const subtitle = guarantorReviewSubtitle(g);
        const aml = amlByKey.get(buildGuarantorAmlKey(g));
        return (
          <details
            key={idx}
            className={guarantorCardClass}
            open={open}
            onToggle={(e) => {
              const d = e.currentTarget;
              setPanelOpen((p) => ({ ...p, [idx]: d.open }));
            }}
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="border-b border-border px-4 py-3">
                <div className={guarantorHeaderRowClass}>
                  <div className={guarantorHeaderTitleClass}>
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
                    className={guarantorHeaderActionsClass}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <RegTankGuarantorControlRow
                      mode="single"
                      guarantor={g}
                      amlByKey={amlByKey}
                      onTriggerGuarantorAml={onTriggerGuarantorAml}
                    />
                    <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden />
                    <GuarantorCtosToolbar
                      applicationId={applicationId}
                      guarantor={g}
                      subjectReportByRef={subjectReportByRef}
                      ctosSubjectLoading={ctosSubjectLoading}
                      createSubjectPending={createSubjectPending}
                      onOpenSubjectHtml={onOpenSubjectHtml}
                      onRequestGetReport={onRequestGuarantorCtos}
                      canManageGuarantorCtos={canManageGuarantorCtos}
                    />
                  </div>
                </div>
              </div>
            </summary>
            <div className="min-w-0 space-y-4 px-4 pb-4 pt-3">
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
                    <Label className={reviewLabelClass}>Relationship</Label>
                    <ReviewValue value={guarantorRelationshipDisplay(g)} />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                  </>
                ) : (
                  <>
                    <Label className={reviewLabelClass}>Business name</Label>
                    <ReviewValue value={g.businessName || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>SSM number</Label>
                    <ReviewValue value={g.ssmNumber || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Relationship</Label>
                    <ReviewValue value={guarantorRelationshipDisplay(g)} />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                  </>
                )}
                <Label className={reviewLabelClass}>Guarantor agreement</Label>
                <div className="flex min-h-0 min-w-0 w-full flex-col items-start justify-center gap-2">
                  {g.guarantorAgreements.length > 0 ? (
                    g.guarantorAgreements.map((file) => (
                      <div
                        key={file.s3Key}
                        className="flex min-w-0 w-full max-w-full flex-wrap items-center gap-2"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-9 gap-1 shrink-0"
                          onClick={() => onViewDocument(file.s3Key)}
                          disabled={viewDocumentPending}
                        >
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg h-9 gap-1 shrink-0"
                          onClick={() => onDownloadDocument(file.s3Key, file.fileName)}
                          disabled={viewDocumentPending}
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                          Download
                        </Button>
                        <span
                          className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                          title={file.fileName}
                        >
                          {file.fileName}
                        </span>
                      </div>
                    ))
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

/**
 * SECTION: Guarantor cards in resubmit comparison
 * WHY: Rows come from the Business projection so card highlights match the tab Diff badge.
 *      Read-only: no RegTank / CTOS actions on historical revisions.
 * INPUT: Projected guarantor blocks (one per guarantor index)
 * OUTPUT: Same collapsible card shell as the live list, Before/After rows inside
 * WHERE USED: BusinessSection comparison branch
 */
function AdminGuarantorComparisonList({
  blocks,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
}: {
  blocks: ComparisonBlock[];
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
}) {
  const count = blocks.length;
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
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:gap-8 sm:px-2">
      {blocks.map((block, idx) => {
        const open = panelOpen[idx] !== undefined ? panelOpen[idx]! : true;
        const subtitle = businessGuarantorBlockSubtitle(block);

        return (
          <details
            key={block.id}
            className={guarantorCardClass}
            open={open}
            onToggle={(e) => {
              const d = e.currentTarget;
              setPanelOpen((p) => ({ ...p, [idx]: d.open }));
            }}
          >
            <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <div className="border-b border-border px-4 py-3">
                <div className={guarantorHeaderRowClass}>
                  <div className={guarantorHeaderTitleClass}>
                    <span className="shrink-0 text-sm font-semibold text-foreground leading-6">
                      {block.title}
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
                </div>
              </div>
            </summary>
            {/* Body pt-3 + list mt-4 = live first-row offset (pt-3 + reviewRowGridClass mt-4). */}
            <div className="min-w-0 px-4 pb-4 pt-3">
              <ComparisonRowList>
                {block.rows.map((row) => (
                  <ComparisonProjectedRow
                    key={row.key}
                    row={row}
                    onViewDocument={onViewDocument}
                    onDownloadDocument={onDownloadDocument}
                    viewDocumentPending={viewDocumentPending}
                  />
                ))}
              </ComparisonRowList>
            </div>
          </details>
        );
      })}
    </div>
  );
}

/**
 * SECTION: Declaration side-by-side in resubmit comparison
 * WHY: Same checkbox + statement + Confirmed caption as live review, not "Confirmed" text alone.
 * INPUT: business_details.declaration_confirmed per side (projection row)
 */
function ComparisonDeclarationRow({
  label,
  beforeConfirmed,
  afterConfirmed,
}: {
  label: string;
  beforeConfirmed: boolean;
  afterConfirmed: boolean;
}) {
  const valuesDiffer = beforeConfirmed !== afterConfirmed;
  return (
    <div
      className={comparisonRowGridClass}
      role="group"
      aria-label={valuesDiffer ? `${label}, confirmation differs between revisions` : label}
    >
      {/* The block heading already reads "Declarations": keep the 220px column empty; the group aria-label names it. */}
      <div aria-hidden className="hidden md:block" />
      <ComparisonSideSlot side="before">
        <ComparisonDeclarationCell
          confirmed={beforeConfirmed}
          side="before"
          valuesDiffer={valuesDiffer}
        />
      </ComparisonSideSlot>
      <ComparisonSideSlot side="after">
        <ComparisonDeclarationCell
          confirmed={afterConfirmed}
          side="after"
          valuesDiffer={valuesDiffer}
        />
      </ComparisonSideSlot>
    </div>
  );
}

/** Same copy and link as the live Business tab for existing-contract drawdowns. */
function InheritedGuarantorsBanner({
  inheritedSourceApplication,
}: {
  inheritedSourceApplication?: { id: string; productId: string | null };
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
      {INHERITED_FACILITY_GUARANTORS_ADMIN_COPY}
      {inheritedSourceApplication?.productId && inheritedSourceApplication.id ? (
        <>
          {" "}
          in{" "}
          <Link
            href={`/applications/${encodeURIComponent(inheritedSourceApplication.productId)}/${encodeURIComponent(inheritedSourceApplication.id)}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            the originating application
          </Link>
        </>
      ) : (
        " in the originating application"
      )}
      .
    </div>
  );
}

const yesNoScaleWrapper = "inline-block scale-[0.88] origin-left";

export function BusinessSection({
  applicationId = "",
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
  guarantorsReviewMode = "live",
  inheritedSourceApplication,
}: BusinessSectionProps) {
  const isInheritedGuarantors = guarantorsReviewMode === "inherited";
  const ctosAppId = applicationId.trim() || undefined;
  const { getAccessToken } = useAuthToken();
  const { can } = usePermissions();
  const canManageGuarantorCtos =
    can("applications.business_guarantor.manage") && !isInheritedGuarantors;
  const ctosSubjectLoading = false;
  const createSubjectCtos = useCreateApplicationCtosSubjectReport(ctosAppId);

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
      if (!ctosAppId) return;
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in");
        return;
      }
      const url = `${API_URL}/v1/admin/applications/${encodeURIComponent(ctosAppId)}/ctos-reports/${reportId}/html`;
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
    [ctosAppId, getAccessToken]
  );

  const onCreateGuarantorSubjectCtos = React.useCallback(
    (g: GuarantorReviewRow) => {
      if (!ctosAppId) return;
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
    [ctosAppId, createSubjectCtos]
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

  const comparisonBeforeDetails = sectionComparison?.beforeDetails;
  const comparisonAfterDetails = sectionComparison?.afterDetails;
  const comparisonBeforeGuarantors = sectionComparison?.beforeGuarantors;
  const comparisonAfterGuarantors = sectionComparison?.afterGuarantors;
  const hasSectionComparison = sectionComparison != null;
  const comparisonBlocks = React.useMemo(
    () =>
      hasSectionComparison
        ? projectBusinessComparison(
            {
              business_details: comparisonBeforeDetails,
              application_guarantors: comparisonBeforeGuarantors,
            },
            {
              business_details: comparisonAfterDetails,
              application_guarantors: comparisonAfterGuarantors,
            }
          )
        : null,
    [
      hasSectionComparison,
      comparisonBeforeDetails,
      comparisonAfterDetails,
      comparisonBeforeGuarantors,
      comparisonAfterGuarantors,
    ]
  );

  if (comparisonBlocks) {
    const blocks = comparisonBlocks;
    if (blocks.length === 0) {
      return (
        <ReviewSectionCard
          title="Business & Guarantor Details"
          icon={DocumentTextIcon}
          section={section}
          isReviewable={false}
        >
          <p className={reviewEmptyStateClass}>No business details submitted.</p>
        </ReviewSectionCard>
      );
    }

    const guarantorBlocks = blocks.filter(isBusinessGuarantorBlock);
    const declarationRow = blocks
      .find((block) => block.id === BUSINESS_DECLARATIONS_BLOCK_ID)
      ?.rows.find((row) => row.kind === "yesno");
    const otherBlocks = blocks.filter(
      (block) => !isBusinessGuarantorBlock(block) && block.id !== BUSINESS_DECLARATIONS_BLOCK_ID
    );

    return (
      <ReviewSectionCard
        title="Business & Guarantor Details"
        icon={DocumentTextIcon}
        section={section}
        isReviewable={false}
      >
        {isInheritedGuarantors ? (
          <InheritedGuarantorsBanner inheritedSourceApplication={inheritedSourceApplication} />
        ) : null}
        {otherBlocks.map((block) => (
          <ReviewFieldBlock key={block.id} title={block.title}>
            <ComparisonRowList>
              {block.rows.map((row) => (
                <ComparisonProjectedRow
                  key={row.key}
                  row={row}
                  onViewDocument={onViewDocument}
                  onDownloadDocument={onDownloadDocument}
                  viewDocumentPending={viewDocumentPending}
                />
              ))}
            </ComparisonRowList>
          </ReviewFieldBlock>
        ))}

        {guarantorBlocks.length > 0 ? (
          <ReviewFieldBlock title="Guarantor details">
            <AdminGuarantorComparisonList
              blocks={guarantorBlocks}
              onViewDocument={onViewDocument}
              onDownloadDocument={onDownloadDocument}
              viewDocumentPending={viewDocumentPending}
            />
          </ReviewFieldBlock>
        ) : null}

        {declarationRow?.kind === "yesno" ? (
          <ReviewFieldBlock title="Declarations">
            <ComparisonRowList>
              <ComparisonDeclarationRow
                label={declarationRow.label}
                beforeConfirmed={declarationRow.before === true}
                afterConfirmed={declarationRow.after === true}
              />
            </ComparisonRowList>
          </ReviewFieldBlock>
        ) : null}

        {!hideSectionComments ? (
          <SectionComments comments={comments} onSubmitComment={onAddComment} />
        ) : null}
      </ReviewSectionCard>
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
          {isInheritedGuarantors ? (
            <InheritedGuarantorsBanner inheritedSourceApplication={inheritedSourceApplication} />
          ) : null}
          <ReviewFieldBlock title="Why Are You Raising Funds?">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>Purpose of Fund Raising</Label>
              <ReviewValue value={view.whyRaisingFunds.purposeOfFundRaising} multiline />
              {view.whyRaisingFunds.purposeOther != null ? (
                <>
                  <Label className={reviewLabelClass}>{SC_MONTHLY_CAMPAIGN.purposeOfFundRaisingOthers.label}</Label>
                  <ReviewValue value={view.whyRaisingFunds.purposeOther} multiline />
                </>
              ) : null}
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
                applicationId={ctosAppId ?? ""}
                subjectReportByRef={subjectReportByRef}
                ctosSubjectLoading={ctosSubjectLoading}
                createSubjectPending={createSubjectCtos.isPending}
                onOpenSubjectHtml={openSubjectHtmlReport}
                onRequestGuarantorCtos={setPendingGuarantorCtos}
                onViewDocument={onViewDocument}
                onDownloadDocument={onDownloadDocument}
                viewDocumentPending={viewDocumentPending}
                canManageGuarantorCtos={canManageGuarantorCtos}
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
