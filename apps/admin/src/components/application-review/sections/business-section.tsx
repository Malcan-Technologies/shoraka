"use client";

import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { ReviewSectionCard } from "../review-section-card";
import { ReviewFieldBlock } from "../review-field-block";
import { ReviewValue } from "../review-value";
import {
  reviewLabelClass,
  reviewValueClass,
  reviewRowGridClass,
  REVIEW_EMPTY_LABEL,
} from "../review-section-styles";
import type { ReviewSectionId } from "../section-types";

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
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

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
  };
  declarationConfirmed: boolean;
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

  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

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
    },
    declarationConfirmed: Boolean(r.declaration_confirmed ?? r.declarationConfirmed),
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
}: BusinessSectionProps) {
  const view = parseBusinessDetails(businessDetails);
  const showP2PFields = view?.whyRaisingFunds.raisingOnOtherP2P === true;

  return (
    <ReviewSectionCard
      title="Business Details"
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
          <ReviewFieldBlock title="About your business">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>What does your company do?</Label>
              <ReviewValue value={view.about.whatDoesCompanyDo} multiline />
              <Label className={reviewLabelClass}>Who are your main customers?</Label>
              <ReviewValue value={view.about.mainCustomers} multiline />
              <Label className={reviewLabelClass}>
                Does any single customer make up more than 50% of your revenue?
              </Label>
              <span className={yesNoScaleWrapper}>
                <YesNoRadioDisplay value={view.about.singleCustomerOver50Revenue} />
              </span>
            </div>
          </ReviewFieldBlock>

          <ReviewFieldBlock title="Why are you raising funds?">
            <div className={reviewRowGridClass}>
              <Label className={reviewLabelClass}>What is this financing for?</Label>
              <ReviewValue value={view.whyRaisingFunds.financingFor} multiline />
              <Label className={reviewLabelClass}>How will the funds be used?</Label>
              <ReviewValue value={view.whyRaisingFunds.howFundsUsed} multiline />
              <Label className={reviewLabelClass}>Tell us about your business plan</Label>
              <ReviewValue value={view.whyRaisingFunds.businessPlan} multiline />
              <Label className={reviewLabelClass}>
                Are there any risks that may delay repayment of your invoices?
              </Label>
              <ReviewValue value={view.whyRaisingFunds.risksDelayRepayment} multiline />
              <Label className={reviewLabelClass}>
                If payment is delayed, what is your backup plan?
              </Label>
              <ReviewValue value={view.whyRaisingFunds.backupPlan} multiline />
              <Label className={reviewLabelClass}>
                Are you currently raising/applying funds on any other P2P platforms?
              </Label>
              <span className={yesNoScaleWrapper}>
                <YesNoRadioDisplay value={view.whyRaisingFunds.raisingOnOtherP2P} />
              </span>
              {showP2PFields && (
                <>
                  <Label className={reviewLabelClass}>Name of platform</Label>
                  <ReviewValue value={view.whyRaisingFunds.platformName} />
                  <Label className={reviewLabelClass}>Amount raised</Label>
                  <div className={`${reviewValueClass} !min-h-0 h-9`}>
                    {view.whyRaisingFunds.amountRaised != null
                      ? formatCurrency(view.whyRaisingFunds.amountRaised)
                      : REVIEW_EMPTY_LABEL}
                  </div>
                  <Label className={reviewLabelClass}>Is the same invoice being used?</Label>
                  <span className={yesNoScaleWrapper}>
                    <YesNoRadioDisplay value={view.whyRaisingFunds.sameInvoiceUsed} />
                  </span>
                </>
              )}
            </div>
          </ReviewFieldBlock>

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
        <p className="text-sm text-muted-foreground">No business details submitted.</p>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">Add Remarks</Label>
        <div className="mt-1 h-24 rounded-xl border bg-muted/30" />
      </div>
    </ReviewSectionCard>
  );
}
