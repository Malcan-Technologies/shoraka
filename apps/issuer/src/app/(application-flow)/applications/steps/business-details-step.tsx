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
  formInputClassName,
  formInputDisabledClassName,
  formTextareaClassName,
  formLabelClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { MoneyInput } from "@cashsouk/ui";
import { parseMoney, formatMoney } from "@cashsouk/ui";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { BusinessDetailsSkeleton } from "@/app/(application-flow)/applications/components/business-details-skeleton";
import { generateBusinessDetailsData } from "@/app/(application-flow)/applications/utils/dev-data-generator";

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
  accountingSoftware: string;
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
    platform_name?: string | null;
    amount_raised?: number | null;
    same_invoice_used?: boolean | null;
    accounting_software?: string;
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
    },
    declaration_confirmed: p.declarationConfirmed,
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
    },
    declarationConfirmed: raw?.declaration_confirmed ?? raw?.declarationConfirmed ?? false,
  };
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
};

interface BusinessDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
  readOnly?: boolean;
}

const sectionHeaderClassName = "text-base font-semibold text-foreground";

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
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-12 gap-y-6 mt-4 w-full max-w-[1200px] items-center px-3";

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
  "w-full max-w-[1200px] flex flex-col gap-10 px-3";

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

export function BusinessDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: BusinessDetailsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const devTools = useDevTools();

  const [aboutYourBusiness, setAboutYourBusiness] = React.useState<AboutYourBusiness>(defaultAbout);
  const [whyRaisingFunds, setWhyRaisingFunds] = React.useState<WhyRaisingFunds>(defaultWhy);
  const [declarationConfirmed, setDeclarationConfirmed] = React.useState(false);

  const [isInitialized, setIsInitialized] = React.useState(false);
  const initialPayloadRef = React.useRef<string>("");

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

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
    }
    return true;
  }, [aboutYourBusiness, whyRaisingFunds, declarationConfirmed]);

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
    });
  }, [snakePayload, hasPendingChanges, declarationConfirmed, isInitialized, validateBusinessDetails]);

  if (isLoadingApp || !isInitialized || devTools?.showSkeletonDebug) {
    return <BusinessDetailsSkeleton />;
  }

  return (
    <>
      <div className={formOuterClassName}>
        {/* ===================== ABOUT YOUR BUSINESS ===================== */}
        <section className={`${sectionWrapperClassName} space-y-3`}>
        <div>
          <h3 className={sectionHeaderClassName}>About your business</h3>
          <div className="border-b border-border mt-2 mb-4" />
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
            disabled={readOnly}
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
            disabled={readOnly}
          />

          <Label className={labelClassName}>
            Does any single customer make up more than 50% of your revenue?
          </Label>
          <YesNoRadioGroup
            name="singleCustomerOver50Revenue"
            value={aboutYourBusiness.singleCustomerOver50Revenue}
            onValueChange={(v) =>
              setAboutYourBusiness((prev) => ({ ...prev, singleCustomerOver50Revenue: v }))
            }
            disabled={readOnly}
          />

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
            className={cn(inputClassName, readOnly && formInputDisabledClassName)}
            disabled={readOnly}
          />
        </div>
      </section>

      {/* ===================== WHY ARE YOU RAISING FUNDS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-3`}>
        <div>
          <h3 className={sectionHeaderClassName}>Why are you raising funds?</h3>
          <div className="border-b border-border mt-2 mb-4" />
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
            disabled={readOnly}
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
            disabled={readOnly}
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
            disabled={readOnly}
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
            disabled={readOnly}
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
            disabled={readOnly}
          />

          <Label className={labelClassName}>
            Are you currently raising/applying funds on any other P2P platforms?
          </Label>
          <YesNoRadioGroup
            name="raisingOnOtherP2P"
            value={whyRaisingFunds.raisingOnOtherP2P}
            onValueChange={(v) =>
              setWhyRaisingFunds((prev) => ({ ...prev, raisingOnOtherP2P: v }))
            }
            disabled={readOnly}
          />

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
                className={cn(inputClassName, readOnly && formInputDisabledClassName)}
                disabled={readOnly}
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
                    inputClassName={cn(inputClassName, "pl-12", readOnly && formInputDisabledClassName)}
                    disabled={readOnly}
                  />
                </div>
              </div>

              <Label className={labelClassName}>
                Have the same invoices been used to apply for funding in the aforementioned platform?
              </Label>
              <YesNoRadioGroup
                name="sameInvoiceUsed"
                value={whyRaisingFunds.sameInvoiceUsed}
                onValueChange={(v) =>
                  setWhyRaisingFunds((prev) => ({ ...prev, sameInvoiceUsed: v }))
                }
                disabled={readOnly}
              />
            </>
          )}
        </div>
      </section>

      {/* ===================== DECLARATIONS ===================== */}
      <section className={`${sectionWrapperClassName} space-y-3`}>
        <div>
          <h3 className={sectionHeaderClassName}>Declarations</h3>
          <div className="border-b border-border mt-2 mb-4" />
        </div>

        <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={declarationConfirmed}
              onCheckedChange={(checked) => setDeclarationConfirmed(checked === true)}
              disabled={readOnly}
              className={cn(
                "mt-0.5 rounded-[4px]",
                readOnly && "disabled:opacity-100 data-[state=checked]:bg-muted data-[state=checked]:border-muted-foreground data-[state=checked]:text-muted-foreground"
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
