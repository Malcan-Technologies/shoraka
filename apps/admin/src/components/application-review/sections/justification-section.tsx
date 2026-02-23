"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { YesNoRadioDisplay } from "@cashsouk/ui";
import { formatCurrency } from "@cashsouk/config";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { SectionActionDropdown } from "../section-action-dropdown";
import type { ReviewSectionId } from "../section-types";

export interface JustificationSectionProps {
  businessDetails: unknown;
  section: ReviewSectionId;
  isReviewable: boolean;
  approvePending: boolean;
  onApprove: (section: ReviewSectionId) => void;
  onReject: (section: ReviewSectionId) => void;
  onRequestAmendment: (section: ReviewSectionId) => void;
}

const DECLARATION_TEXT =
  "I confirm that all information provided is true, accurate, and not misleading, and I understand that false or incomplete information may result in removal from the platform and regulatory action.";

const EMPTY_LABEL = "Not provided";

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
      whatDoesCompanyDo: str(a?.what_does_company_do ?? a?.whatDoesCompanyDo) || EMPTY_LABEL,
      mainCustomers: str(a?.main_customers ?? a?.mainCustomers) || EMPTY_LABEL,
      singleCustomerOver50Revenue: bool(a?.single_customer_over_50_revenue ?? a?.singleCustomerOver50Revenue),
    },
    whyRaisingFunds: {
      financingFor: str(w?.financing_for ?? w?.financingFor) || EMPTY_LABEL,
      howFundsUsed: str(w?.how_funds_used ?? w?.howFundsUsed) || EMPTY_LABEL,
      businessPlan: str(w?.business_plan ?? w?.businessPlan) || EMPTY_LABEL,
      risksDelayRepayment: str(w?.risks_delay_repayment ?? w?.risksDelayRepayment) || EMPTY_LABEL,
      backupPlan: str(w?.backup_plan ?? w?.backupPlan) || EMPTY_LABEL,
      raisingOnOtherP2P: bool(w?.raising_on_other_p2p ?? w?.raisingOnOtherP2P),
      platformName: str(w?.platform_name ?? w?.platformName) || EMPTY_LABEL,
      amountRaised: num(w?.amount_raised ?? w?.amountRaised),
      sameInvoiceUsed: bool(w?.same_invoice_used ?? w?.sameInvoiceUsed),
    },
    declarationConfirmed: Boolean(r.declaration_confirmed ?? r.declarationConfirmed),
  };
}

/** Typography and layout aligned with Financial/Documents sections */
const sectionHeaderClass = "text-sm font-semibold";
const yesNoScaleWrapper = "inline-block scale-[0.88] origin-left";
const rowGridClass =
  "grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-x-8 gap-y-4 mt-3 w-full items-start";
const labelClass = "text-sm font-normal text-foreground";
const valueClass =
  "min-h-[36px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground flex items-center";
const valueClassTextarea =
  "min-h-[60px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground flex items-start";

function TextValue({
  value,
  className,
  multiline,
}: {
  value: string;
  className?: string;
  multiline?: boolean;
}) {
  const isEmpty = value === EMPTY_LABEL;
  const baseClass = multiline ? valueClassTextarea : valueClass;
  return (
    <div className={`${baseClass} ${className ?? ""}`}>
      <span className={isEmpty ? "text-muted-foreground" : ""}>{value}</span>
    </div>
  );
}

export function JustificationSection({
  businessDetails,
  section,
  isReviewable,
  approvePending,
  onApprove,
  onReject,
  onRequestAmendment,
}: JustificationSectionProps) {
  const view = parseBusinessDetails(businessDetails);
  const showP2PFields = view?.whyRaisingFunds.raisingOnOtherP2P === true;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">Justification</CardTitle>
          </div>
          <SectionActionDropdown
            section={section}
            isReviewable={isReviewable}
            onApprove={onApprove}
            onReject={onReject}
            onRequestAmendment={onRequestAmendment}
            isPending={approvePending}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {view ? (
          <>
            {/* About your business */}
            <section className="space-y-3">
              <div>
                <h3 className={sectionHeaderClass}>About your business</h3>
                <div className="mt-1.5 h-px bg-border" />
              </div>
              <div className={rowGridClass}>
                <Label className={labelClass}>What does your company do?</Label>
                <TextValue value={view.about.whatDoesCompanyDo} multiline />
                <Label className={labelClass}>Who are your main customers?</Label>
                <TextValue value={view.about.mainCustomers} multiline />
                <Label className={labelClass}>
                  Does any single customer make up more than 50% of your revenue?
                </Label>
                <span className={yesNoScaleWrapper}>
                  <YesNoRadioDisplay value={view.about.singleCustomerOver50Revenue} />
                </span>
              </div>
            </section>

            {/* Why are you raising funds? */}
            <section className="space-y-3">
              <div>
                <h3 className={sectionHeaderClass}>Why are you raising funds?</h3>
                <div className="mt-1.5 h-px bg-border" />
              </div>
              <div className={rowGridClass}>
                <Label className={labelClass}>What is this financing for?</Label>
                <TextValue value={view.whyRaisingFunds.financingFor} multiline />
                <Label className={labelClass}>How will the funds be used?</Label>
                <TextValue value={view.whyRaisingFunds.howFundsUsed} multiline />
                <Label className={labelClass}>Tell us about your business plan</Label>
                <TextValue value={view.whyRaisingFunds.businessPlan} multiline />
                <Label className={labelClass}>
                  Are there any risks that may delay repayment of your invoices?
                </Label>
                <TextValue value={view.whyRaisingFunds.risksDelayRepayment} multiline />
                <Label className={labelClass}>
                  If payment is delayed, what is your backup plan?
                </Label>
                <TextValue value={view.whyRaisingFunds.backupPlan} multiline />
                <Label className={labelClass}>
                  Are you currently raising/applying funds on any other P2P platforms?
                </Label>
                <span className={yesNoScaleWrapper}>
                  <YesNoRadioDisplay value={view.whyRaisingFunds.raisingOnOtherP2P} />
                </span>
                {showP2PFields && (
                  <>
                    <Label className={labelClass}>Name of platform</Label>
                    <TextValue value={view.whyRaisingFunds.platformName} />
                    <Label className={labelClass}>Amount raised</Label>
                    <div className={`${valueClass} !min-h-0 h-9`}>
                      {view.whyRaisingFunds.amountRaised != null
                        ? formatCurrency(view.whyRaisingFunds.amountRaised)
                        : EMPTY_LABEL}
                    </div>
                    <Label className={labelClass}>Is the same invoice being used?</Label>
                    <span className={yesNoScaleWrapper}>
                      <YesNoRadioDisplay value={view.whyRaisingFunds.sameInvoiceUsed} />
                    </span>
                  </>
                )}
              </div>
            </section>

            {/* Declarations */}
            <section className="space-y-3">
              <div>
                <h3 className={sectionHeaderClass}>Declarations</h3>
                <div className="mt-1.5 h-px bg-border" />
              </div>
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
            </section>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No justification details submitted.</p>
        )}
      </CardContent>
    </Card>
  );
}
