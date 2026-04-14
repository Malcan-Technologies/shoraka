"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewValue } from "../review-value";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import { Button } from "@/components/ui/button";
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
  GUARANTOR_COMPANY_RELATIONSHIP_LABELS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS,
  type GuarantorCompanyRelationship,
  type GuarantorIndividualRelationship,
} from "@cashsouk/types";
import { cn } from "@/lib/utils";
import {
  ComparisonFieldRow,
  ComparisonYesNoRadioRow,
} from "../comparison-field-row";

export type BusinessSectionComparisonProps = {
  beforeDetails: unknown;
  afterDetails: unknown;
  isPathChanged: (path: string) => boolean;
};

export interface BusinessSectionProps {
  businessDetails: unknown;
  issuerOrganizationBusinessAmlStatus?: unknown;
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
  onRefreshGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  onRefreshAllGuarantorAml?: () => Promise<void> | void;
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  hideSectionComments?: boolean;
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

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
      ? "View guarantor in RegTank (before)"
      : side === "after"
        ? "View guarantor in RegTank (after)"
        : "View guarantor in RegTank";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-1.5 h-9 shrink-0 px-3 text-sm", className)}
      disabled={disabled || !url}
      title={disabled || !url ? disabledReason || "RegTank URL is not available yet." : undefined}
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
  onRefreshGuarantorAml,
  mode,
  comparisonSides,
}: {
  guarantor?: GuarantorReviewRow;
  amlByKey: Map<string, GuarantorAmlEntry>;
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  onRefreshGuarantorAml?: (guarantorId: string) => Promise<void> | void;
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
          ? "flex flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end"
          : "contents"
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
      ) : (
        (() => {
          if (!guarantor) return <RegTankGuarantorLinkButton />;
          const aml = amlByKey.get(buildGuarantorAmlKey(guarantor));
          return (
            <div className="flex flex-wrap items-center gap-2 justify-end">
              {aml ? amlBadge(aml.amlStatus) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 shrink-0 px-3 text-sm"
                disabled={!onTriggerGuarantorAml || !guarantor.email}
                onClick={(e) => {
                  e.stopPropagation();
                  void onTriggerGuarantorAml?.(guarantor.guarantorId);
                }}
              >
                Trigger AML
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 h-9 shrink-0 px-3 text-sm"
                disabled={!onRefreshGuarantorAml}
                onClick={(e) => {
                  e.stopPropagation();
                  void onRefreshGuarantorAml?.(guarantor.guarantorId);
                }}
              >
                <ArrowPathIcon className="h-4 w-4 shrink-0" aria-hidden />
                Refresh AML
              </Button>
              <RegTankGuarantorLinkButton url={aml?.regtankPortalUrl} />
            </div>
          );
        })()
      )}
    </div>
  );
}

type GuarantorReviewRow =
  | {
      kind: "individual";
      guarantorId: string;
      firstName: string;
      lastName: string;
      email: string;
      icNumber: string;
      relationshipLabel: string;
    }
  | {
      kind: "company";
      guarantorId: string;
      companyName: string;
      email: string;
      ssmNumber: string;
      relationshipLabel: string;
    };

type GuarantorAmlStatus = "Unresolved" | "Approved" | "Rejected" | "Pending";
type GuarantorAmlMessageStatus = "DONE" | "PENDING" | "ERROR";

interface GuarantorAmlEntry {
  orgGuarantorKey: string;
  guarantorType: "individual" | "company";
  guarantorId: string;
  email: string;
  icNumber?: string;
  ssmNumber?: string;
  requestId?: string;
  regtankPortalUrl?: string;
  amlStatus: GuarantorAmlStatus;
  amlMessageStatus: GuarantorAmlMessageStatus;
  amlRiskScore: number | null;
  amlRiskLevel: string | null;
  lastUpdated?: string;
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

function parseGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const gt = o.guarantor_type ?? o.guarantorType;
    if (gt === "individual") {
      const rel = o.relationship;
      const relKey =
        typeof rel === "string" && rel in GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS
          ? (rel as GuarantorIndividualRelationship)
          : null;
      rows.push({
        kind: "individual",
        guarantorId:
          reviewStr(o.guarantor_id ?? o.guarantorId) ||
          deterministicGuarantorId(
            index,
            "individual",
            normalizeIdentifier(o.ic_number ?? o.icNumber)
          ),
        firstName: reviewStr(o.first_name ?? o.firstName),
        lastName: reviewStr(o.last_name ?? o.lastName),
        email: normalizeEmail(o.email),
        icNumber: reviewStr(o.ic_number ?? o.icNumber),
        relationshipLabel: relKey ? GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS[relKey] : REVIEW_EMPTY_LABEL,
      });
    } else if (gt === "company") {
      const rel = o.relationship;
      const relKey =
        typeof rel === "string" && rel in GUARANTOR_COMPANY_RELATIONSHIP_LABELS
          ? (rel as GuarantorCompanyRelationship)
          : null;
      rows.push({
        kind: "company",
        guarantorId:
          reviewStr(o.guarantor_id ?? o.guarantorId) ||
          deterministicGuarantorId(
            index,
            "company",
            normalizeIdentifier(o.ssm_number ?? o.ssmNumber)
          ),
        companyName: reviewStr(o.company_name ?? o.companyName),
        email: normalizeEmail(o.email),
        ssmNumber: reviewStr(o.ssm_number ?? o.ssmNumber),
        relationshipLabel: relKey ? GUARANTOR_COMPANY_RELATIONSHIP_LABELS[relKey] : REVIEW_EMPTY_LABEL,
      });
    }
  }
  return rows;
}

function buildGuarantorAmlKey(row: GuarantorReviewRow): string {
  if (row.kind === "individual") {
    const ic = normalizeIdentifier(row.icNumber);
    if (ic) return `individual:${ic}`;
    return `individual:email:${normalizeEmail(row.email)}`;
  }
  const ssm = normalizeIdentifier(row.ssmNumber);
  if (ssm) return `company:${ssm}`;
  return `company:email:${normalizeEmail(row.email)}`;
}

function parseGuarantorAmlEntries(raw: unknown): GuarantorAmlEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.guarantors)) return [];
  return record.guarantors
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const status = reviewStr(row.amlStatus) as GuarantorAmlStatus;
      const message = reviewStr(row.amlMessageStatus) as GuarantorAmlMessageStatus;
      const isStatusValid =
        status === "Approved" || status === "Rejected" || status === "Unresolved" || status === "Pending";
      const isMessageValid = message === "DONE" || message === "PENDING" || message === "ERROR";
      return {
        orgGuarantorKey: reviewStr(row.orgGuarantorKey),
        guarantorType: row.guarantorType === "company" ? "company" : "individual",
        guarantorId: reviewStr(row.guarantorId),
        email: normalizeEmail(row.email),
        icNumber: reviewStr(row.icNumber) || undefined,
        ssmNumber: reviewStr(row.ssmNumber) || undefined,
        requestId: reviewStr(row.requestId) || undefined,
        regtankPortalUrl: reviewStr(row.regtankPortalUrl) || undefined,
        amlStatus: isStatusValid ? status : "Pending",
        amlMessageStatus: isMessageValid ? message : "PENDING",
        amlRiskScore: typeof row.amlRiskScore === "number" ? row.amlRiskScore : null,
        amlRiskLevel: reviewStr(row.amlRiskLevel) || null,
        lastUpdated: reviewStr(row.lastUpdated) || undefined,
      } satisfies GuarantorAmlEntry;
    })
    .filter((entry): entry is GuarantorAmlEntry => Boolean(entry?.orgGuarantorKey));
}

function amlBadge(status: GuarantorAmlStatus) {
  if (status === "Approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs">
        <CheckCircleIcon className="h-3.5 w-3.5 text-green-600" aria-hidden />
        Approved
      </span>
    );
  }
  if (status === "Rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs">
        <XCircleIcon className="h-3.5 w-3.5 text-destructive" aria-hidden />
        Rejected
      </span>
    );
  }
  if (status === "Unresolved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1 text-xs">
        <ExclamationTriangleIcon className="h-3.5 w-3.5 text-yellow-600" aria-hidden />
        Unresolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-gray-400/30 bg-gray-400/10 px-2 py-1 text-xs">
      <ClockIcon className="h-3.5 w-3.5 text-gray-500" aria-hidden />
      Pending
    </span>
  );
}

export function parseBusinessDetails(raw: unknown): BusinessDetailsView | null {
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
    guarantors: parseGuarantors(r.guarantors),
  };
}

function guarantorKindLabel(kind: "individual" | "company"): string {
  return kind === "individual" ? "Individual" : "Company";
}

/** Collapsed-card subtitle (name or company + relationship), aligned with issuer guarantor cards. */
function guarantorReviewSubtitle(g: GuarantorReviewRow): string {
  if (g.kind === "individual") {
    const name = [g.firstName, g.lastName]
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
    const rel =
      g.relationshipLabel && g.relationshipLabel !== REVIEW_EMPTY_LABEL ? g.relationshipLabel : "";
    if (name && rel) return `${name} (${rel})`;
    if (name) return name;
    if (rel) return `(${rel})`;
    return "";
  }
  const co = g.companyName.trim();
  const rel =
    g.relationshipLabel && g.relationshipLabel !== REVIEW_EMPTY_LABEL ? g.relationshipLabel : "";
  if (co && rel) return `${co} (${rel})`;
  if (co) return co;
  if (rel) return `(${rel})`;
  return "";
}

function sideGuarantorTypeLabel(g: GuarantorReviewRow | undefined): string {
  return g ? guarantorKindLabel(g.kind) : "—";
}

function AdminGuarantorSingleList({
  guarantors,
  amlByKey,
  onTriggerGuarantorAml,
  onRefreshGuarantorAml,
}: {
  guarantors: GuarantorReviewRow[];
  amlByKey: Map<string, GuarantorAmlEntry>;
  onTriggerGuarantorAml?: (guarantorId: string) => Promise<void> | void;
  onRefreshGuarantorAml?: (guarantorId: string) => Promise<void> | void;
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
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
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <RegTankGuarantorControlRow
                    mode="single"
                    guarantor={g}
                    amlByKey={amlByKey}
                    onTriggerGuarantorAml={onTriggerGuarantorAml}
                    onRefreshGuarantorAml={onRefreshGuarantorAml}
                  />
                </div>
              </div>
            </summary>
            <div className="px-4 pb-4 pt-3">
              <div className={reviewRowGridClass}>
                <Label className={reviewLabelClass}>Guarantor type</Label>
                <ReviewValue value={guarantorKindLabel(g.kind)} />
                {g.kind === "individual" ? (
                  <>
                    <Label className={reviewLabelClass}>First name</Label>
                    <ReviewValue value={g.firstName || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Last name</Label>
                    <ReviewValue value={g.lastName || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>IC number</Label>
                    <ReviewValue value={g.icNumber || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Relationship</Label>
                    <ReviewValue value={g.relationshipLabel} />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Last AML update</Label>
                    <ReviewValue value={aml?.lastUpdated || REVIEW_EMPTY_LABEL} />
                  </>
                ) : (
                  <>
                    <Label className={reviewLabelClass}>Company name</Label>
                    <ReviewValue value={g.companyName || REVIEW_EMPTY_LABEL} multiline />
                    <Label className={reviewLabelClass}>SSM number</Label>
                    <ReviewValue value={g.ssmNumber || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Relationship</Label>
                    <ReviewValue value={g.relationshipLabel} />
                    <Label className={reviewLabelClass}>Email</Label>
                    <ReviewValue value={g.email || REVIEW_EMPTY_LABEL} />
                    <Label className={reviewLabelClass}>Last AML update</Label>
                    <ReviewValue value={aml?.lastUpdated || REVIEW_EMPTY_LABEL} />
                  </>
                )}
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
}: {
  b: BusinessDetailsView;
  a: BusinessDetailsView;
  amlByKey: Map<string, GuarantorAmlEntry>;
  isPathChanged: (path: string) => boolean;
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
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border px-4 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
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
                  className="flex flex-wrap items-center gap-2"
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
                    label="First name"
                    before={gB?.kind === "individual" ? gB.firstName : "—"}
                    after={gA?.kind === "individual" ? gA.firstName : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Last name"
                    before={gB?.kind === "individual" ? gB.lastName : "—"}
                    after={gA?.kind === "individual" ? gA.lastName : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="IC number"
                    before={gB?.kind === "individual" ? gB.icNumber : "—"}
                    after={gA?.kind === "individual" ? gA.icNumber : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Relationship"
                    before={gB?.kind === "individual" ? gB.relationshipLabel : "—"}
                    after={gA?.kind === "individual" ? gA.relationshipLabel : "—"}
                    changed={changed}
                  />
                </div>
              ) : null}
              {showCompany ? (
                <div className="space-y-2">
                  <ComparisonFieldRow
                    label="Company name"
                    before={gB?.kind === "company" ? gB.companyName : "—"}
                    after={gA?.kind === "company" ? gA.companyName : "—"}
                    changed={changed}
                    multiline
                  />
                  <ComparisonFieldRow
                    label="SSM number"
                    before={gB?.kind === "company" ? gB.ssmNumber : "—"}
                    after={gA?.kind === "company" ? gA.ssmNumber : "—"}
                    changed={changed}
                  />
                  <ComparisonFieldRow
                    label="Relationship"
                    before={gB?.kind === "company" ? gB.relationshipLabel : "—"}
                    after={gA?.kind === "company" ? gA.relationshipLabel : "—"}
                    changed={changed}
                  />
                </div>
              ) : null}
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
  const Cell = ({ confirmed, side }: { confirmed: boolean; side: "before" | "after" }) => {
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
  };
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
          <Cell confirmed={beforeConfirmed} side="before" />
        </div>
        <div className={comparisonSplitAfterColClass}>
          <Cell confirmed={afterConfirmed} side="after" />
        </div>
      </div>
    </div>
  );
}

const yesNoScaleWrapper = "inline-block scale-[0.88] origin-left";

export function BusinessSection({
  businessDetails,
  issuerOrganizationBusinessAmlStatus,
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
  onRefreshGuarantorAml,
  onRefreshAllGuarantorAml,
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
}: BusinessSectionProps) {
  const guarantorAmlEntries = React.useMemo(
    () => parseGuarantorAmlEntries(issuerOrganizationBusinessAmlStatus),
    [issuerOrganizationBusinessAmlStatus]
  );
  const guarantorAmlByKey = React.useMemo(() => {
    const m = new Map<string, GuarantorAmlEntry>();
    for (const entry of guarantorAmlEntries) {
      m.set(entry.orgGuarantorKey, entry);
    }
    return m;
  }, [guarantorAmlEntries]);

  if (sectionComparison) {
    const vb = parseBusinessDetails(sectionComparison.beforeDetails);
    const va = parseBusinessDetails(sectionComparison.afterDetails);
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
    );
  }

  const view = parseBusinessDetails(businessDetails);
  const showP2PFields = view?.whyRaisingFunds.raisingOnOtherP2P === true;
  const supportingFiles = view?.whyRaisingFunds.supportingDocuments ?? [];
  const canViewMultiple = supportingFiles.length > 1;
  const canViewSingle = supportingFiles.length === 1;

  return (
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
              <div className="mb-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-9"
                  disabled={!onRefreshAllGuarantorAml}
                  onClick={() => void onRefreshAllGuarantorAml?.()}
                >
                  <ArrowPathIcon className="h-4 w-4" aria-hidden />
                  Refresh all AML
                </Button>
              </div>
              <AdminGuarantorSingleList
                guarantors={view.guarantors}
                amlByKey={guarantorAmlByKey}
                onTriggerGuarantorAml={onTriggerGuarantorAml}
                onRefreshGuarantorAml={onRefreshGuarantorAml}
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
  );
}
