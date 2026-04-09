"use client";

import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewValue } from "../review-value";
import { SectionComments, type SectionCommentItem } from "../section-comments";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  reviewEmptyStateClass,
  REVIEW_EMPTY_LABEL,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";
import {
  GUARANTOR_COMPANY_RELATIONSHIP_LABELS,
  GUARANTOR_INDIVIDUAL_RELATIONSHIP_LABELS,
  type GuarantorCompanyRelationship,
  type GuarantorIndividualRelationship,
} from "@cashsouk/types";

export interface BusinessSectionProps {
  businessDetails: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  isActionLocked?: boolean;
  actionLockTooltip?: string;
  sectionStatus?: string;
  onResetSectionToPending?: (section: ReviewSectionId) => void;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
  comments: SectionCommentItem[];
  onAddComment?: (comment: string) => Promise<void> | void;
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

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

function parseBusinessDetails(raw: unknown): BusinessDetailsView | null {
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
    },
    declarationConfirmed: Boolean(r.declaration_confirmed ?? r.declarationConfirmed),
    guarantors: parseGuarantors(r.guarantors),
  };
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
  comments,
  onAddComment,
}: BusinessSectionProps) {
  const view = parseBusinessDetails(businessDetails);
  const showP2PFields = view?.whyRaisingFunds.raisingOnOtherP2P === true;

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
      <SectionComments comments={comments} onSubmitComment={onAddComment} />
    </ReviewSectionCard>
  );
}
