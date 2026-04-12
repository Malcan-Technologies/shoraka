"use client";

import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  DocumentTextIcon,
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
  onViewDocument: (s3Key: string) => void;
  onDownloadDocument: (s3Key: string, fileName?: string) => void;
  viewDocumentPending?: boolean;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
  hideSectionComments?: boolean;
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

/**
 * RegTank deep link for this guarantor row — wire URL / ids when API is ready.
 * Comparison uses two buttons (before vs after) when the guarantor may differ between versions.
 */
function RegTankGuarantorLinkButton({
  side,
  disabled,
  disabledReason,
}: {
  side?: "before" | "after";
  disabled?: boolean;
  disabledReason?: string;
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
      className="gap-2 w-full sm:w-auto shrink-0"
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => {}}
    >
      <ArrowTopRightOnSquareIcon className="h-4 w-4 shrink-0" aria-hidden />
      {label}
    </Button>
  );
}

function RegTankGuarantorControlRow({
  mode,
  comparisonSides,
}: {
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
          ? "pt-3 mt-1 border-t border-border/70 flex flex-col gap-2 sm:flex-row sm:flex-wrap"
          : "pt-3 mt-1 border-t border-border/70"
      }
    >
      {mode === "comparison" ? (
        <>
          <RegTankGuarantorLinkButton
            side="before"
            disabled={!beforeOk}
            disabledReason="No guarantor in the earlier revision for this row."
          />
          <RegTankGuarantorLinkButton
            side="after"
            disabled={!afterOk}
            disabledReason="No guarantor in the later revision for this row."
          />
        </>
      ) : (
        <RegTankGuarantorLinkButton />
      )}
    </div>
  );
}

type GuarantorReviewRow =
  | {
      kind: "individual";
      firstName: string;
      lastName: string;
      icNumber: string;
      relationshipLabel: string;
    }
  | {
      kind: "company";
      companyName: string;
      ssmNumber: string;
      relationshipLabel: string;
    };

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

function parseGuarantors(raw: unknown): GuarantorReviewRow[] {
  if (!raw || !Array.isArray(raw)) return [];
  const rows: GuarantorReviewRow[] = [];
  for (const item of raw) {
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
        firstName: reviewStr(o.first_name ?? o.firstName),
        lastName: reviewStr(o.last_name ?? o.lastName),
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
        companyName: reviewStr(o.company_name ?? o.companyName),
        ssmNumber: reviewStr(o.ssm_number ?? o.ssmNumber),
        relationshipLabel: relKey ? GUARANTOR_COMPANY_RELATIONSHIP_LABELS[relKey] : REVIEW_EMPTY_LABEL,
      });
    }
  }
  return rows;
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
  onViewDocument,
  onDownloadDocument,
  viewDocumentPending = false,
  comments,
  onAddComment,
  sectionComparison,
  hideSectionComments = false,
}: BusinessSectionProps) {
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
            <div className="space-y-4">
              {Array.from({
                length: Math.max(b.guarantors.length, a.guarantors.length),
              }).map((_, idx) => {
                const gB = b.guarantors[idx];
                const gA = a.guarantors[idx];
                const kind = gB?.kind ?? gA?.kind;
                const hasBeforeGuarantor = gB != null;
                const hasAfterGuarantor = gA != null;
                const changed =
                  isPathChanged("business_details") ||
                  isPathChanged(`business_details.guarantors[${idx}]`);
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Guarantor {idx + 1}
                      {kind ? ` · ${kind === "individual" ? "Individual" : "Company"}` : ""}
                    </p>
                    {kind === "individual" ? (
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
                    {kind === "company" ? (
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
                    <RegTankGuarantorControlRow
                      mode="comparison"
                      comparisonSides={{
                        beforeAvailable: hasBeforeGuarantor,
                        afterAvailable: hasAfterGuarantor,
                      }}
                    />
                  </div>
                );
              })}
            </div>
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
              <div className="flex flex-col gap-4">
                {view.guarantors.map((g, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-muted/20 p-3 space-y-2"
                  >
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Guarantor {idx + 1} · {g.kind === "individual" ? "Individual" : "Company"}
                    </p>
                    <div className={reviewRowGridClass}>
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
                        </>
                      ) : (
                        <>
                          <Label className={reviewLabelClass}>Company name</Label>
                          <ReviewValue value={g.companyName || REVIEW_EMPTY_LABEL} multiline />
                          <Label className={reviewLabelClass}>SSM number</Label>
                          <ReviewValue value={g.ssmNumber || REVIEW_EMPTY_LABEL} />
                          <Label className={reviewLabelClass}>Relationship</Label>
                          <ReviewValue value={g.relationshipLabel} />
                        </>
                      )}
                    </div>
                    <RegTankGuarantorControlRow mode="single" />
                  </div>
                ))}
              </div>
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
