"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

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
}

interface BusinessDetailsPayload {
  aboutYourBusiness: AboutYourBusiness;
  whyRaisingFunds: WhyRaisingFunds;
  declarationConfirmed: boolean;
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
    platform_name?: string;
    amount_raised?: string;
    same_invoice_used?: boolean;
  };
  declaration_confirmed?: boolean;
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

function toSnakePayload(p: BusinessDetailsPayload): BusinessDetailsSnake {
  return {
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
      platform_name: p.whyRaisingFunds.platformName ?? "",
      amount_raised: p.whyRaisingFunds.amountRaised ?? "",
      same_invoice_used: yesNoToBoolean(p.whyRaisingFunds.sameInvoiceUsed),
    },
    declaration_confirmed: p.declarationConfirmed,
  };
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
      amountRaised: w?.amount_raised ?? w?.amountRaised ?? "",
      sameInvoiceUsed: booleanToYesNo(w?.same_invoice_used ?? w?.sameInvoiceUsed),
    },
    declarationConfirmed: raw?.declaration_confirmed ?? raw?.declarationConfirmed ?? false,
  };
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
};

interface BusinessDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

const sectionHeaderClassName =
  "text-base sm:text-lg md:text-xl font-semibold";

const labelClassName =
  "text-sm md:text-base leading-6 text-foreground min-h-10 flex items-start";

/**
 * Inputs
 */
const inputClassName =
  "rounded-xl border border-border bg-background text-foreground w-full h-11";

const textareaClassName =
  "rounded-xl border border-border bg-background text-foreground min-h-[100px] w-full";

/**
 * Core form grid
 * ❌ removed pl-3 / sm:pl-4 / md:pl-6
 * ✅ alignment now matches Financing Type + other steps
 */
const rowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-5 mt-4 w-full max-w-[1200px] items-start px-3";

/**
 * Section wrapper
 */
const sectionWrapperClassName =
  "w-full max-w-[1200px]";

/**
 * Outer form spacing
 * gap-8 = consistent section separation
 */
const formOuterClassName =
  "w-full max-w-[1200px] flex flex-col gap-10";

/**
 * Radio labels
 */
const radioSelectedLabel =
  "text-sm md:text-base text-foreground";

const radioUnselectedLabel =
  "text-sm md:text-base text-muted-foreground";


function CustomRadio({
  name,
  value,
  checked,
  onChange,
  label,
  selectedLabelClass,
  unselectedLabelClass,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  selectedLabelClass: string;
  unselectedLabelClass: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="sr-only"
          aria-hidden
        />
        <span
          className={`pointer-events-none relative block h-5 w-5 shrink-0 rounded-full ${
            checked
              ? "bg-primary"
              : "border-2 border-muted-foreground/50 bg-muted/30"
          }`}
          aria-hidden
        >
          {checked && (
            <span className="absolute inset-1 rounded-full bg-white" aria-hidden />
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

function restrictDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function TextareaWithCharCount({
  id,
  value,
  onChange,
  placeholder,
  maxLength,
  className,
  countLabel,
}: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  maxLength: number;
  className: string;
  countLabel: string;
}) {
  return (
    <div className="relative">
      <Textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        maxLength={maxLength}
        className={`${className} pb-8`}
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

export function BusinessDetailsStep({
  applicationId,
  onDataChange,
}: BusinessDetailsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);

  const [aboutYourBusiness, setAboutYourBusiness] = React.useState<AboutYourBusiness>(defaultAbout);
  const [whyRaisingFunds, setWhyRaisingFunds] = React.useState<WhyRaisingFunds>(defaultWhy);
  const [declarationConfirmed, setDeclarationConfirmed] = React.useState(false);

  const [isInitialized, setIsInitialized] = React.useState(false);
  const initialPayloadRef = React.useRef<string>("");

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    if (application === undefined || isInitialized) return;

    const saved = application?.business_details;
    const initial = fromSnakeSaved(saved);
    setAboutYourBusiness(initial.aboutYourBusiness);
    setWhyRaisingFunds({
      ...initial.whyRaisingFunds,
      amountRaised: restrictDigitsOnly(initial.whyRaisingFunds.amountRaised),
    });
    setDeclarationConfirmed(initial.declarationConfirmed);
    initialPayloadRef.current = JSON.stringify(toSnakePayload(initial));
    setIsInitialized(true);
  }, [application, isInitialized]);

  const payload: BusinessDetailsPayload = React.useMemo(
    () => ({
      aboutYourBusiness,
      whyRaisingFunds,
      declarationConfirmed,
    }),
    [aboutYourBusiness, whyRaisingFunds, declarationConfirmed]
  );

  const snakePayload = React.useMemo(() => toSnakePayload(payload), [payload]);

  const hasPendingChanges = React.useMemo(() => {
    if (!isInitialized) return false;
    return JSON.stringify(snakePayload) !== initialPayloadRef.current;
  }, [snakePayload, isInitialized]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;

    onDataChangeRef.current({
      ...snakePayload,
      hasPendingChanges,
      isDeclarationConfirmed: declarationConfirmed,
    });
  }, [snakePayload, hasPendingChanges, declarationConfirmed, isInitialized]);

  if (isLoadingApp || !isInitialized) {
    return (
    <BusinessDetailsSkeleton />
    );
  }

return (
  <div className={formOuterClassName}>
    {/* ===================== ABOUT YOUR BUSINESS ===================== */}
    <section className={`${sectionWrapperClassName} space-y-4`}>
      <div>
        <h3 className={sectionHeaderClassName}>About your business</h3>
        <div className="mt-2 h-px bg-border" />
      </div>

      <div className={rowGridClassName}>
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
        />

        <Label className={labelClassName}>
          Does any single customer make up more than 50% of your revenue?
        </Label>
        <div className="flex gap-6 items-center">
          <CustomRadio
            name="singleCustomerOver50Revenue"
            value="yes"
            checked={aboutYourBusiness.singleCustomerOver50Revenue === "yes"}
            onChange={() =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                singleCustomerOver50Revenue: "yes",
              }))
            }
            label="Yes"
            selectedLabelClass={radioSelectedLabel}
            unselectedLabelClass={radioUnselectedLabel}
          />
          <CustomRadio
            name="singleCustomerOver50Revenue"
            value="no"
            checked={aboutYourBusiness.singleCustomerOver50Revenue === "no"}
            onChange={() =>
              setAboutYourBusiness((prev) => ({
                ...prev,
                singleCustomerOver50Revenue: "no",
              }))
            }
            label="No"
            selectedLabelClass={radioSelectedLabel}
            unselectedLabelClass={radioUnselectedLabel}
          />
        </div>
      </div>
    </section>

    {/* ===================== WHY ARE YOU RAISING FUNDS ===================== */}
    <section className={`${sectionWrapperClassName} space-y-4`}>
      <div>
        <h3 className={sectionHeaderClassName}>Why are you raising funds?</h3>
        <div className="mt-2 h-px bg-border" />
      </div>

      <div className={rowGridClassName}>
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
        />

        <Label className={labelClassName}>
          Are you currently raising/applying funds on any other P2P platforms?
        </Label>
        <div className="flex gap-6 items-center">
                   <CustomRadio
              name="raisingOnOtherP2P"
              value="yes"
              checked={whyRaisingFunds.raisingOnOtherP2P === "yes"}
              onChange={() =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  raisingOnOtherP2P: "yes",
                }))
              }
              label="Yes"
              selectedLabelClass={radioSelectedLabel}
              unselectedLabelClass={radioUnselectedLabel}
            />
            <CustomRadio
              name="raisingOnOtherP2P"
              value="no"
              checked={whyRaisingFunds.raisingOnOtherP2P === "no"}
              onChange={() =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  raisingOnOtherP2P: "no",
                }))
              }
              label="NO"
              selectedLabelClass={radioSelectedLabel}
              unselectedLabelClass={radioUnselectedLabel}
            />
        </div>

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
          placeholder="e.g. CARPAY"
          className={inputClassName}
        />

        <Label htmlFor="amount-raised" className={labelClassName}>
          Amount raised
        </Label>
        <div className="flex items-center rounded-xl border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary">
          <span className="pl-4 text-foreground text-sm md:text-base shrink-0">RM</span>
          <Input
            id="amount-raised"
            type="text"
            inputMode="numeric"
            value={whyRaisingFunds.amountRaised}
            onChange={(e) =>
              setWhyRaisingFunds((prev) => ({
                ...prev,
                amountRaised: restrictDigitsOnly(e.target.value),
              }))
            }
            placeholder="0"
            className="border-0 rounded-none focus-visible:ring-0 shadow-none flex-1 h-11"
          />
        </div>

        <Label className={labelClassName}>
          Is the same invoice being used?
        </Label>
        <div className="flex gap-6 items-center">
           <CustomRadio
              name="sameInvoiceUsed"
              value="yes"
              checked={whyRaisingFunds.sameInvoiceUsed === "yes"}
              onChange={() =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  sameInvoiceUsed: "yes",
                }))
              }
              label="Yes"
              selectedLabelClass={radioSelectedLabel}
              unselectedLabelClass={radioUnselectedLabel}
            />
            <CustomRadio
              name="sameInvoiceUsed"
              value="no"
              checked={whyRaisingFunds.sameInvoiceUsed === "no"}
              onChange={() =>
                setWhyRaisingFunds((prev) => ({
                  ...prev,
                  sameInvoiceUsed: "no",
                }))
              }
              label="NO"
              selectedLabelClass={radioSelectedLabel}
              unselectedLabelClass={radioUnselectedLabel}
            />
        </div>
      </div>
    </section>

    {/* ===================== DECLARATIONS ===================== */}
    <section className={`${sectionWrapperClassName} space-y-4`}>
      <div>
        <h3 className={sectionHeaderClassName}>Declarations</h3>
        <div className="mt-2 h-px bg-border" />
      </div>

      <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
        <label className="flex items-start gap-3 cursor-pointer">
          <Checkbox
            checked={declarationConfirmed}
            onCheckedChange={(checked) => setDeclarationConfirmed(checked === true)}
            className="mt-0.5 rounded-[4px]"
          />
          <span className="text-sm md:text-base leading-6 text-foreground">
            {DECLARATION_TEXT}
          </span>
        </label>
      </div>
    </section>
  </div>
);

}

function BusinessDetailsSkeleton() {
  return (
    <div className={`${formOuterClassName} mt-1`}>
      {/* ===================== ABOUT YOUR BUSINESS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-5`}>
        <div>
          <Skeleton className="h-6 w-[220px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={rowGridClassName}>
          {/* What does your company do */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Main customers */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Single customer > 50% */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>
        </div>
      </section>

      {/* ===================== WHY ARE YOU RAISING FUNDS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-4`}>
        <div>
          <Skeleton className="h-6 w-[260px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={rowGridClassName}>
          {/* Financing for */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Funds usage */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Business plan */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[160px] w-full rounded-xl" />

          {/* Risks */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Backup plan */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-[120px] w-full rounded-xl" />

          {/* Other P2P */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>

          {/* Platform name */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Amount raised */}
          <Skeleton className="h-5 w-[280px]" />
          <Skeleton className="h-10 w-full rounded-xl" />

          {/* Same invoice */}
          <Skeleton className="h-5 w-[280px]" />
          <div className="flex gap-6 items-center">
            <Skeleton className="h-5 w-[80px]" />
            <Skeleton className="h-5 w-[80px]" />
          </div>
        </div>
      </section>

      {/* ===================== DECLARATIONS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-4`}>
        <div>
          <Skeleton className="h-6 w-[160px]" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Skeleton className="h-4 w-4 rounded-sm mt-1" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[92%]" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
