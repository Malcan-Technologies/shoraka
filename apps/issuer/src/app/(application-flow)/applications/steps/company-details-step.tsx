"use client";

/**
 * COMPANY DETAILS STEP - REBUILT FOR DETERMINISM
 *
 * Architecture:
 * - Single local form state (source of truth)
 * - Deterministic hydration (only once, after all data loads)
 * - Stable saveFunction via useCallback
 * - One onDataChange effect that computes validity from current state
 * - No double-click risk
 */

import * as React from "react";
import Link from "next/link";
import { createApiClient, useAuthToken, useOrganization, MALAYSIAN_BANKS } from "@cashsouk/config";
import { useQueryClient } from "@tanstack/react-query";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  formatPeopleRolesLineTitleCaseWithoutShare,
  formatShareOwnershipCell,
  getFinalStatusLabel,
  getFinalStatusToken,
  isMissingGovernmentIdPerson,
  parseAboutYourBusiness,
  isAboutYourBusinessComplete,
  ABOUT_YOUR_BUSINESS_LIMITS,
  resolveDirectorShareholderCtosEmptyWarning,
  UNRESOLVED_IDENTITY_RECOVERY_COPY,
  UNRESOLVED_IDENTITY_RECOVERY_TITLE,
} from "@cashsouk/types";
import {
  DirectorShareholderCtosEmptyAlert,
  DirectorShareholderUnresolvedIdentitySection,
  StatusBadge,
  YesNoRadioDisplay,
} from "@cashsouk/ui";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TextareaWithCharCount } from "@/components/textarea-with-char-count";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InformationCircleIcon, PencilIcon, EyeIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import {
  applicationFlowSectionDividerClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  formTextareaClassName,
  withFieldError,
} from "@/app/(application-flow)/applications/components/form-control";
import { CompanyDetailsSkeleton } from "@/app/(application-flow)/applications/components/company-details-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  AMENDMENT_CALLOUT_BODY,
  AMENDMENT_CALLOUT_CONTENT,
  AMENDMENT_CALLOUT_ICON_WRAP,
  AMENDMENT_CALLOUT_ROOT,
  AMENDMENT_CALLOUT_TITLE,
} from "@/app/(application-flow)/applications/components/amendments/amendment-callout-styles";

interface CompanyDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

/**
 * FORM DATA STATE - Single source of truth
 */
interface FormState {
  industry: string;
  numberOfEmployees: string;
  whatDoesCompanyDo: string;
  mainCustomers: string;
  singleCustomerOver50Revenue: boolean | null;
  accountingSoftware: string;
  businessAddress: Record<string, unknown> | null;
  registeredAddress: Record<string, unknown> | null;
  bankName: string;
  bankAccountNumber: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPosition: string;
  contactPersonContact: string;
}

/**
 * Mock data for dev Auto Fill Step (company_details).
 * IMPORTANT: Must fill required fields (not empty) so validation passes.
 */
export function generateMockData(): Record<string, unknown> {
  return {
    industry: "Technology",
    numberOfEmployees: "10",
    whatDoesCompanyDo:
      "We manufacture industrial equipment and provide maintenance services for mining and construction sectors.",
    mainCustomers:
      "Large enterprises in oil & gas, mining, and infrastructure. Top 3 customers: Petronas, Sime Darby, Tenaga Nasional.",
    singleCustomerOver50Revenue: false,
    accountingSoftware: "Xero",
    businessAddress: {
      line1: "23, Jalan Kiara",
      line2: "",
      city: "Kuala Lumpur",
      postalCode: "10250",
      state: "Kuala Lumpur",
      country: "MY",
    },
    registeredAddress: {
      line1: "24, Jalan Kiara",
      line2: "",
      city: "Kuala Lumpur",
      postalCode: "10150",
      state: "Kuala Lumpur",
      country: "MY",
    },
    bankName: "Maybank / Malayan Banking Berhad",
    bankAccountNumber: "1234567890",
    contactPersonName: "John Doe",
    contactPersonEmail: "john.doe@example.com",
    contactPersonPosition: "CEO",
    contactPersonContact: "+60123456789",
  };
}

function getBankField(bankDetails: Record<string, unknown> | null, fieldName: string): string {
  const content = bankDetails?.content;
  if (!Array.isArray(content)) return "";
  const field = content.find((f: { fieldName?: string; fieldValue?: string }) => f?.fieldName === fieldName);
  return field?.fieldValue ?? "";
}

const ADDRESS_PLACEHOLDER = "No address entered";

function formatAddress(addr: Record<string, unknown> | null): string {
  if (!addr) return ADDRESS_PLACEHOLDER;
  const parts = [
    addr.line1 as string,
    addr.line2 as string,
    addr.city as string,
    addr.postalCode as string,
    addr.state as string,
    addr.country as string,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : ADDRESS_PLACEHOLDER;
}

const BANK_ACCOUNT_REGEX = /^\d*$/;
const BANK_ACCOUNT_MIN_LENGTH = 10;
const BANK_ACCOUNT_MAX_LENGTH = 18;

function isValidNumberOfEmployees(value: string): boolean {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isInteger(n) && n > 0 && value.trim().replace(/^0+/, "") !== "";
}

function restrictDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Business and registered addresses require line1, city, postalCode, state, country. */
function isValidAddress(addr: Record<string, unknown> | null): boolean {
  if (!addr) return false;
  const line1 = (addr.line1 as string)?.trim();
  const city = (addr.city as string)?.trim();
  const postalCode = (addr.postalCode as string)?.trim();
  const state = (addr.state as string)?.trim();
  const country = (addr.country as string)?.trim();
  return !!(line1 && city && postalCode && state && country);
}

const inputClassName = cn(formInputClassName, formInputDisabledClassName);
const inputClassNameEditable = formInputClassName;
const labelClassName = formLabelClassName;
const labelClassNameEditable = formLabelClassName;
const textareaClassName = cn(formTextareaClassName, "min-h-[100px] resize-y");
const aboutRowGridClassName =
  "grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-x-6 gap-y-4 mt-4 px-3 items-start";
const investorBadgeTooltipContentClassName =
  "max-w-xs border border-border bg-popover px-3 py-2 text-sm font-normal normal-case leading-snug text-popover-foreground shadow-md";

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

function aboutFieldsFromProfile(corporateInfo: { aboutYourBusiness?: unknown } | null | undefined) {
  return parseAboutYourBusiness(corporateInfo?.aboutYourBusiness);
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function CompanyDetailsStep({
  applicationId,
  onDataChange,
}: CompanyDetailsStepProps) {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();
  const apiClient = createApiClient(API_URL, getAccessToken);
  const queryClient = useQueryClient();

  const devTools = useDevTools();

  // Company details are view-only; updates happen on the organisation profile
  const effectiveCanEdit = false;

  /* ================================================================
     DATA LOADING HOOKS
     ================================================================ */

  const { data: application } = useApplication(applicationId);
  const {
    corporateInfo,
    bankAccountDetails,
    isLoading: isLoadingInfo,
  } = useCorporateInfo(organizationId);
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const isLoadingData = isLoadingInfo || isLoadingEntities;
  const visiblePeopleRows = React.useMemo(
    () => filterVisiblePeopleRows(entitiesData?.people ?? []),
    [entitiesData?.people]
  );
  const [recoverPendingKey, setRecoverPendingKey] = React.useState<string | null>(null);
  const recoverUnresolvedIdentity = React.useCallback(
    async (payload: {
      eodRequestId: string;
      email?: string | null;
      role: "DIRECTOR" | "SHAREHOLDER";
      governmentId: string;
    }) => {
      if (!organizationId) return;
      const pendingKey = `${payload.eodRequestId}:${payload.email ?? ""}`;
      setRecoverPendingKey(pendingKey);
      try {
        const result = await apiClient.patch<{ success: true }>(
          `/v1/organizations/issuer/${organizationId}/unresolved-identity`,
          payload
        );
        if (!result.success) {
          toast.error(result.error.message);
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["corporate-entities", organizationId] });
        toast.success("Government ID saved. This record can now be matched.");
      } finally {
        setRecoverPendingKey(null);
      }
    },
    [apiClient, organizationId, queryClient]
  );

  const resolvedCtosEmptyWarning = React.useMemo(
    () =>
      resolveDirectorShareholderCtosEmptyWarning({
        directorShareholderListSource: entitiesData?.directorShareholderListSource ?? null,
        ctosDirectorShareholderWarning: entitiesData?.ctosDirectorShareholderWarning ?? null,
      }),
    [entitiesData?.directorShareholderListSource, entitiesData?.ctosDirectorShareholderWarning]
  );

  const resolveOrgContactPerson = React.useCallback(() => {
    const contact = corporateInfo?.contactPerson;
    if (
      contact?.name?.trim() ||
      contact?.email?.trim() ||
      contact?.position?.trim() ||
      contact?.contact?.trim()
    ) {
      return {
        name: contact.name || "",
        email: contact.email || "",
        position: contact.position || "",
        contact: contact.contact || "",
      };
    }
    const pic = corporateInfo?.personInCharge;
    return {
      name: pic?.name || "",
      email: pic?.email || "",
      position: pic?.position || "",
      contact: pic?.contactNumber || "",
    };
  }, [corporateInfo]);

  /* ================================================================
     LOCAL FORM STATE - Single source of truth
     ================================================================ */

  const [formState, setFormState] = React.useState<FormState>({
    industry: "",
    numberOfEmployees: "",
    whatDoesCompanyDo: "",
    mainCustomers: "",
    singleCustomerOver50Revenue: null,
    accountingSoftware: "",
    businessAddress: null,
    registeredAddress: null,
    bankName: "",
    bankAccountNumber: "",
    contactPersonName: "",
    contactPersonEmail: "",
    contactPersonPosition: "",
    contactPersonContact: "",
  });

  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);
  const [hasHydrated, setHasHydrated] = React.useState(false);

  /* ================================================================
     DETERMINISTIC HYDRATION - Run once after all data loads
     ================================================================ */

  React.useEffect(() => {
    if (hasHydrated) return;
    if (!application || !organizationId) return;
    if (isLoadingData) return;

    const basicInfo = corporateInfo?.basicInfo;
    const businessAddress = corporateInfo?.addresses?.business;
    const registeredAddress = corporateInfo?.addresses?.registered;
    const bankDetails = (bankAccountDetails as Record<string, unknown> | null) || null;
    const orgContact = resolveOrgContactPerson();

    const about = aboutFieldsFromProfile(corporateInfo);
    const hydratedState: FormState = {
      industry: basicInfo?.industry || "",
      numberOfEmployees: (basicInfo?.numberOfEmployees?.toString() || ""),
      whatDoesCompanyDo: about.whatDoesCompanyDo,
      mainCustomers: about.mainCustomers,
      singleCustomerOver50Revenue: about.singleCustomerOver50Revenue,
      accountingSoftware: about.accountingSoftware,
      businessAddress: (businessAddress as Record<string, unknown>) || null,
      registeredAddress: (registeredAddress as Record<string, unknown>) || null,
      bankName: getBankField(bankDetails, "Bank"),
      bankAccountNumber: getBankField(bankDetails, "Bank account number"),
      contactPersonName: orgContact.name,
      contactPersonEmail: orgContact.email,
      contactPersonPosition: orgContact.position,
      contactPersonContact: orgContact.contact,
    };

    setFormState(hydratedState);
    setHasHydrated(true);
  }, [application, organizationId, isLoadingData, corporateInfo, bankAccountDetails, resolveOrgContactPerson, hasHydrated]);

  // Keep display in sync with live organisation profile (step is read-only)
  React.useEffect(() => {
    if (!hasHydrated) return;
    if (isLoadingData) return;

    const basicInfo = corporateInfo?.basicInfo;
    const businessAddress = corporateInfo?.addresses?.business;
    const registeredAddress = corporateInfo?.addresses?.registered;
    const bankDetails = (bankAccountDetails as Record<string, unknown> | null) || null;
    const orgContact = resolveOrgContactPerson();

    const about = aboutFieldsFromProfile(corporateInfo);
    const next: FormState = {
      industry: basicInfo?.industry || "",
      numberOfEmployees: (basicInfo?.numberOfEmployees?.toString() || ""),
      whatDoesCompanyDo: about.whatDoesCompanyDo,
      mainCustomers: about.mainCustomers,
      singleCustomerOver50Revenue: about.singleCustomerOver50Revenue,
      accountingSoftware: about.accountingSoftware,
      businessAddress: (businessAddress as Record<string, unknown>) || null,
      registeredAddress: (registeredAddress as Record<string, unknown>) || null,
      bankName: getBankField(bankDetails, "Bank"),
      bankAccountNumber: getBankField(bankDetails, "Bank account number"),
      contactPersonName: orgContact.name,
      contactPersonEmail: orgContact.email,
      contactPersonPosition: orgContact.position,
      contactPersonContact: orgContact.contact,
    };

    setFormState(next);
  }, [corporateInfo, bankAccountDetails, isLoadingData, resolveOrgContactPerson, hasHydrated]);

  /* ================================================================
     DEV TOOLS AUTO FILL (company_details)
     ================================================================ */
  React.useEffect(() => {
    if (!devTools) return;
    if (!hasHydrated) return;

    const usingSingleAutoFill = devTools?.autoFillData?.stepKey === "company_details";
    const data = usingSingleAutoFill
      ? (devTools.autoFillData?.data as Record<string, unknown> | null | undefined)
      : (devTools?.autoFillDataMap?.["company_details"] as Record<string, unknown> | undefined);

    if (!data) return;

    setFormState((prev) => {
      const applied = data as Partial<{
        industry: string;
        numberOfEmployees: string;
        whatDoesCompanyDo: string;
        mainCustomers: string;
        singleCustomerOver50Revenue: boolean | null;
        accountingSoftware: string;
        businessAddress: Record<string, unknown>;
        registeredAddress: Record<string, unknown>;
        bankName: string;
        bankAccountNumber: string;
        contactPersonName: string;
        contactPersonEmail: string;
        contactPersonPosition: string;
        contactPersonContact: string;
      }>;

      return {
        ...prev,
        industry: String(applied.industry ?? prev.industry ?? ""),
        numberOfEmployees: String(applied.numberOfEmployees ?? prev.numberOfEmployees ?? ""),
        whatDoesCompanyDo: String(applied.whatDoesCompanyDo ?? prev.whatDoesCompanyDo ?? ""),
        mainCustomers: String(applied.mainCustomers ?? prev.mainCustomers ?? ""),
        singleCustomerOver50Revenue:
          applied.singleCustomerOver50Revenue !== undefined
            ? applied.singleCustomerOver50Revenue
            : prev.singleCustomerOver50Revenue,
        accountingSoftware: String(applied.accountingSoftware ?? prev.accountingSoftware ?? ""),
        businessAddress: (applied.businessAddress as Record<string, unknown> | null) ?? prev.businessAddress,
        registeredAddress:
          (applied.registeredAddress as Record<string, unknown> | null) ?? prev.registeredAddress,
        bankName: String(applied.bankName ?? prev.bankName ?? ""),
        bankAccountNumber: String(applied.bankAccountNumber ?? prev.bankAccountNumber ?? ""),
        contactPersonName: String(applied.contactPersonName ?? prev.contactPersonName ?? ""),
        contactPersonEmail: String(applied.contactPersonEmail ?? prev.contactPersonEmail ?? ""),
        contactPersonPosition: String(applied.contactPersonPosition ?? prev.contactPersonPosition ?? ""),
        contactPersonContact: String(applied.contactPersonContact ?? prev.contactPersonContact ?? ""),
      };
    });

    // Important: clear the correct source.
    // - "Auto Fill Step" uses `autoFillData` (single)
    // - "Fill Entire Application" uses `autoFillDataMap`
    if (usingSingleAutoFill) devTools.clearAutoFill();
    else devTools.clearAutoFillForStep("company_details");
  }, [devTools?.autoFillData, devTools?.autoFillDataMap, devTools, hasHydrated]);

  /* ================================================================
     VALIDATION - Pure function, no side effects
     ================================================================ */

  const validateAll = React.useCallback((): { errors: string[]; fieldErrors: Record<string, string> } => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // Contact person validation (sourced from organisation profile)
    if (!formState.contactPersonName?.trim()) {
      errors.push("Contact details incomplete — update your company profile");
      fieldErrors.contactPersonName = "Update on company profile";
    }
    if (!formState.contactPersonEmail?.trim()) {
      errors.push("Contact details incomplete — update your company profile");
      fieldErrors.contactPersonEmail = "Update on company profile";
    }
    if (!formState.contactPersonPosition?.trim()) {
      errors.push("Contact details incomplete — update your company profile");
      fieldErrors.contactPersonPosition = "Update on company profile";
    }
    if (!formState.contactPersonContact?.trim()) {
      errors.push("Contact details incomplete — update your company profile");
      fieldErrors.contactPersonContact = "Update on company profile";
    }

    // Address validation
    if (!isValidAddress(formState.businessAddress)) {
      errors.push("Business address is required (line 1, city, postal code, state, country)");
      fieldErrors.businessAddress = "Complete all required fields";
    }
    if (!isValidAddress(formState.registeredAddress)) {
      errors.push("Registered address is required (line 1, city, postal code, state, country)");
      fieldErrors.registeredAddress = "Complete all required fields";
    }

    // Company info validation
    if (!formState.industry?.trim()) {
      errors.push("Industry is required");
      fieldErrors.industry = "Required";
    }
    if (!formState.numberOfEmployees?.trim()) {
      errors.push("Number of employees is required");
      fieldErrors.numberOfEmployees = "Required";
    } else if (!isValidNumberOfEmployees(formState.numberOfEmployees)) {
      errors.push("Number of employees must be a positive whole number");
      fieldErrors.numberOfEmployees = "Enter a positive whole number";
    }

    if (!formState.whatDoesCompanyDo.trim()) {
      errors.push("About your business incomplete — update your company profile");
      fieldErrors.whatDoesCompanyDo = "Update on company profile";
    }
    if (!formState.mainCustomers.trim()) {
      errors.push("About your business incomplete — update your company profile");
      fieldErrors.mainCustomers = "Update on company profile";
    }
    if (formState.singleCustomerOver50Revenue === null) {
      errors.push("About your business incomplete — update your company profile");
      fieldErrors.singleCustomerOver50Revenue = "Update on company profile";
    }
    if (!formState.accountingSoftware.trim()) {
      errors.push("About your business incomplete — update your company profile");
      fieldErrors.accountingSoftware = "Update on company profile";
    }

    // Banking validation
    if (!formState.bankName?.trim()) {
      errors.push("Bank name is required");
      fieldErrors.bankName = "Select a bank";
    }
    if (!formState.bankAccountNumber?.trim()) {
      errors.push("Bank account number is required");
      fieldErrors.bankAccountNumber = "Required";
    } else {
      if (!BANK_ACCOUNT_REGEX.test(formState.bankAccountNumber)) {
        errors.push("Bank account number must contain only numbers");
        fieldErrors.bankAccountNumber = "Only numbers allowed";
      } else if (
        formState.bankAccountNumber.length < BANK_ACCOUNT_MIN_LENGTH ||
        formState.bankAccountNumber.length > BANK_ACCOUNT_MAX_LENGTH
      ) {
        errors.push(
          `Bank account number must be between ${BANK_ACCOUNT_MIN_LENGTH} and ${BANK_ACCOUNT_MAX_LENGTH} digits`
        );
        fieldErrors.bankAccountNumber = `Enter ${BANK_ACCOUNT_MIN_LENGTH}-${BANK_ACCOUNT_MAX_LENGTH} digits`;
      }
    }

    return { errors, fieldErrors };
  }, [formState]);

  /* ================================================================
     SAVE FUNCTION - Stable via useCallback
     ================================================================ */

  const saveFunction = React.useCallback(async () => {

    // Validate immediately
    const { errors, fieldErrors: nextFieldErrors } = validateAll();
    setFieldErrors(nextFieldErrors);

    if (errors.length > 0) {
      toast.error("Please update incomplete company details on your profile");
      throw new Error("VALIDATION_COMPANY_REQUIRED_FIELDS");
    }

    if (!organizationId) throw new Error("Organization ID required");

    setFieldErrors({});

    // Snapshot contact person from live org profile onto the application
    return {
      contact_person: {
        name: formState.contactPersonName.trim(),
        email: formState.contactPersonEmail.trim(),
        position: formState.contactPersonPosition.trim(),
        contact: formState.contactPersonContact.trim(),
      },
    };
  }, [formState, organizationId, validateAll]);

  /* ================================================================
     VALIDITY CHECK - Compute from current state
     ================================================================ */

  /** Form-only: director/shareholder identity readiness is enforced on final submit (declarations), not here. */
  const isValid = React.useMemo(() => {
    return !!(
      isValidAddress(formState.businessAddress) &&
      isValidAddress(formState.registeredAddress) &&
      formState.contactPersonName?.trim() &&
      formState.contactPersonEmail?.trim() &&
      formState.contactPersonPosition?.trim() &&
      formState.contactPersonContact?.trim() &&
      formState.industry?.trim() &&
      formState.numberOfEmployees?.trim() &&
      isAboutYourBusinessComplete({
        whatDoesCompanyDo: formState.whatDoesCompanyDo,
        mainCustomers: formState.mainCustomers,
        singleCustomerOver50Revenue: formState.singleCustomerOver50Revenue,
        accountingSoftware: formState.accountingSoftware,
      }) &&
      formState.bankName?.trim() &&
      formState.bankAccountNumber?.trim()
    );
  }, [formState]);

  /* ================================================================
     CHANGE DETECTION - Step is read-only (profile is source of truth)
     ================================================================ */

  const hasPendingChanges = false;

  /* ================================================================
     NOTIFY PARENT - One effect, stable dependencies
     ================================================================ */

  React.useEffect(() => {
    if (!onDataChange || !organizationId) return;

    onDataChange({
      issuer_organization_id: organizationId,
      contact_person: {
        name: formState.contactPersonName,
        position: formState.contactPersonPosition,
        contact: formState.contactPersonContact,
      },
      saveFunction,
      hasPendingChanges,
      isValid,
    });
  }, [organizationId, onDataChange, saveFunction, isValid, formState, hasPendingChanges]);

  /* ================================================================
     RENDER
     ================================================================ */

  if (isLoadingData || !hasHydrated || devTools?.showSkeletonDebug) {
    return <CompanyDetailsSkeleton />;
  }

  if (!organizationId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Please select an organization to continue.
      </div>
    );
  }

  const handleSaveAddress = (businessAddress: Record<string, string>, registeredAddress: Record<string, string>) => {
    setFormState((prev) => ({
      ...prev,
      businessAddress: businessAddress as Record<string, unknown>,
      registeredAddress: registeredAddress as Record<string, unknown>,
    }));
    setIsEditAddressOpen(false);
  };

  return (
    <>
      <div className={applicationFlowStepOuterClassName}>
        <div
          className={`${AMENDMENT_CALLOUT_ROOT} border-status-neutral-text/30 bg-status-neutral-bg text-foreground`}
          role="status"
        >
          <div
            className={`${AMENDMENT_CALLOUT_ICON_WRAP} border-status-neutral-text/30 bg-status-neutral-bg`}
            aria-hidden
          >
            <InformationCircleIcon className="h-5 w-5 text-status-neutral-text" />
          </div>
          <div className={AMENDMENT_CALLOUT_BODY}>
            <p className={`${AMENDMENT_CALLOUT_TITLE} text-foreground`}>
              Company details are view-only
            </p>
            <p className={`${AMENDMENT_CALLOUT_CONTENT} text-muted-foreground`}>
              These details come from your company profile. If anything needs to be updated, please edit your{" "}
              <Link href="/profile?focus=contact" className="font-medium text-foreground underline underline-offset-2">
                company profile
              </Link>{" "}
              and return here.
            </p>
          </div>
        </div>

        {/* Company Info Section */}
        <div className="space-y-3">
          <div>
          <h3 className={applicationFlowSectionTitleClassName}>Company Info</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            <div className={labelClassName}>Company name</div>
            <Input
              value={corporateInfo?.basicInfo?.businessName || "eg. Company Name"}
              disabled
              className={inputClassName}
            />

            <div className={labelClassName}>Type of entity</div>
            <Input
              value={corporateInfo?.basicInfo?.entityType || "eg. Private Limited Company"}
              disabled
              className={inputClassName}
            />

            <div className={labelClassName}>SSM no</div>
            <Input
              value={corporateInfo?.basicInfo?.ssmRegisterNumber || "eg. 1234567890"}
              disabled
              className={inputClassName}
            />

            <div className={labelClassNameEditable}>Industry</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.industry}
                onChange={(e) => setFormState((prev) => ({ ...prev, industry: e.target.value }))}
                disabled={!effectiveCanEdit}
                placeholder="eg. Technology"
                className={withFieldError(
                  effectiveCanEdit ? inputClassNameEditable : inputClassName,
                  Boolean(fieldErrors.industry)
                )}
              />
              {fieldErrors.industry && (
                <p className="text-xs text-destructive">{fieldErrors.industry}</p>
              )}
            </div>

            <div className={labelClassNameEditable}>Number of employees</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.numberOfEmployees}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    numberOfEmployees: restrictDigitsOnly(e.target.value),
                  }))
                }
                disabled={!effectiveCanEdit}
                placeholder="eg. 10"
                className={withFieldError(
                  effectiveCanEdit ? inputClassNameEditable : inputClassName,
                  Boolean(fieldErrors.numberOfEmployees)
                )}
              />
              {fieldErrors.numberOfEmployees && (
                <p className="text-xs text-destructive">
                  {fieldErrors.numberOfEmployees}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className={cn(applicationFlowSectionTitleClassName, "shrink-0")}>About your business</h3>
              <InvestorVisibilityBadge />
            </div>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className={aboutRowGridClassName}>
            <Label htmlFor="company-what-does-company-do" className={labelClassName}>
              What does your company do?
            </Label>
            <div className="flex flex-col gap-1">
              <TextareaWithCharCount
                id="company-what-does-company-do"
                value={formState.whatDoesCompanyDo}
                onChange={() => undefined}
                placeholder="Add details"
                maxLength={ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo}
                className={withFieldError(textareaClassName, Boolean(fieldErrors.whatDoesCompanyDo))}
                countLabel={`${formState.whatDoesCompanyDo.length}/${ABOUT_YOUR_BUSINESS_LIMITS.whatDoesCompanyDo} characters`}
                disabled
              />
              {fieldErrors.whatDoesCompanyDo ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.whatDoesCompanyDo}.{" "}
                  <Link href="/profile?focus=about" className="underline underline-offset-2">
                    Open company profile
                  </Link>
                </p>
              ) : null}
            </div>

            <Label htmlFor="company-main-customers" className={labelClassName}>
              Who are your main customers?
            </Label>
            <div className="flex flex-col gap-1">
              <TextareaWithCharCount
                id="company-main-customers"
                value={formState.mainCustomers}
                onChange={() => undefined}
                placeholder="Add details"
                maxLength={ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers}
                className={withFieldError(textareaClassName, Boolean(fieldErrors.mainCustomers))}
                countLabel={`${formState.mainCustomers.length}/${ABOUT_YOUR_BUSINESS_LIMITS.mainCustomers} characters`}
                disabled
              />
              {fieldErrors.mainCustomers ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.mainCustomers}.{" "}
                  <Link href="/profile?focus=about" className="underline underline-offset-2">
                    Open company profile
                  </Link>
                </p>
              ) : null}
            </div>

            <div className={labelClassName}>
              Does any single customer make up more than 50% of your revenue?
            </div>
            <div className="flex min-h-11 flex-col justify-center gap-1">
              <YesNoRadioDisplay value={formState.singleCustomerOver50Revenue} />
              {fieldErrors.singleCustomerOver50Revenue ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.singleCustomerOver50Revenue}.{" "}
                  <Link href="/profile?focus=about" className="underline underline-offset-2">
                    Open company profile
                  </Link>
                </p>
              ) : null}
            </div>

            <Label htmlFor="company-accounting-software" className={labelClassName}>
              Which accounting software does the issuer use?
            </Label>
            <div className="flex flex-col gap-1">
              <Input
                id="company-accounting-software"
                value={formState.accountingSoftware}
                disabled
                placeholder="e.g. QuickBooks, Xero, SAP"
                className={withFieldError(inputClassName, Boolean(fieldErrors.accountingSoftware))}
              />
              {fieldErrors.accountingSoftware ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.accountingSoftware}.{" "}
                  <Link href="/profile?focus=about" className="underline underline-offset-2">
                    Open company profile
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {/* Address Section */}
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className={applicationFlowSectionTitleClassName}>Address</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => effectiveCanEdit && setIsEditAddressOpen(true)}
              className={cn(
                "h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm",
                !effectiveCanEdit && "invisible pointer-events-none"
              )}
            >
              Edit
              <PencilIcon className="h-4 w-4" />
            </Button>
          </div>
          <div className={applicationFlowSectionDividerClassName} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            <div className={labelClassName}>Business address</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formatAddress(formState.businessAddress)}
                disabled
                className={withFieldError(inputClassName, Boolean(fieldErrors.businessAddress))}
              />
              {fieldErrors.businessAddress && (
                <p className="text-xs text-destructive">{fieldErrors.businessAddress}</p>
              )}
            </div>

            <div className={labelClassName}>Registered address</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formatAddress(formState.registeredAddress)}
                disabled
                className={withFieldError(inputClassName, Boolean(fieldErrors.registeredAddress))}
              />
              {fieldErrors.registeredAddress && (
                <p className="text-xs text-destructive">{fieldErrors.registeredAddress}</p>
              )}
            </div>
          </div>
        </div>

        {/* Directors & Shareholders Section */}
        <div className="space-y-3">
          <div>
            <h3 className={applicationFlowSectionTitleClassName}>Directors & Shareholders</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            {resolvedCtosEmptyWarning ? (
              <div className="col-span-2">
                <DirectorShareholderCtosEmptyAlert message={resolvedCtosEmptyWarning} />
              </div>
            ) : null}
            {visiblePeopleRows.filter((p) => !isMissingGovernmentIdPerson(p)).length === 0 &&
            !visiblePeopleRows.some((p) => isMissingGovernmentIdPerson(p)) ? (
              <p className="text-body leading-7 text-muted-foreground col-span-2">
                {resolvedCtosEmptyWarning
                  ? "No directors or shareholders are available from CTOS."
                  : "No directors or shareholders found"}
              </p>
            ) : (
              <>
                {visiblePeopleRows
                  .filter((p) => !isMissingGovernmentIdPerson(p))
                  .map((p) => {
                    const displayRow = buildDirectorShareholderDisplayRowForEmailEligibility(p, null);
                    const finalStatus = getFinalStatusLabel({
                      screening: p.screening,
                      onboarding: p.onboarding,
                    });
                    const own = formatShareOwnershipCell(p);
                    const idLabel =
                      (displayRow.idNumber || displayRow.registrationNumber || p.matchKey || "").trim();
                    return (
                      <React.Fragment key={p.matchKey}>
                        <div className={labelClassName}>{formatPeopleRolesLineTitleCaseWithoutShare(p)}</div>
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                            <div className="flex min-w-0 flex-col">
                              <span className="text-ui leading-7 font-medium truncate">{p.name ?? "—"}</span>
                              <span className="text-xs text-muted-foreground truncate">{idLabel || "—"}</span>
                            </div>
                            <div className="h-4 w-px bg-border" />
                            <div className="text-ui leading-7 text-muted-foreground whitespace-nowrap">
                              {own || "—"}
                            </div>
                            <div className="h-4 w-px bg-border" />
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-meta text-muted-foreground">Status</span>
                              <StatusBadge
                                label={finalStatus.label}
                                status={getFinalStatusToken(finalStatus.tone)}
                                size="sm"
                                className="w-fit"
                              />
                            </div>
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })}
                {visiblePeopleRows.some((p) => isMissingGovernmentIdPerson(p)) ? (
                  <div className="col-span-2">
                    <DirectorShareholderUnresolvedIdentitySection
                      noticeTitle={UNRESOLVED_IDENTITY_RECOVERY_TITLE}
                      noticeDescription={UNRESOLVED_IDENTITY_RECOVERY_COPY}
                      showTechnicalIds={false}
                      noticeAction={
                        <Link
                          href="/profile?focus=directors"
                          className="text-ui font-medium text-primary underline-offset-4 hover:underline"
                        >
                          Open Organisation
                        </Link>
                      }
                      canRecover={effectiveCanEdit}
                      recoverPendingKey={recoverPendingKey}
                      onRecoverGovernmentId={recoverUnresolvedIdentity}
                      people={visiblePeopleRows
                        .filter((p) => isMissingGovernmentIdPerson(p))
                        .map((p) => ({
                          name: p.name,
                          role: formatPeopleRolesLine(p),
                          sharePercentage: p.sharePercentage,
                          eodRequestId: p.requestId,
                          email: p.email ?? null,
                          recoverRole: p.roles.includes("DIRECTOR")
                            ? "DIRECTOR"
                            : p.roles.includes("SHAREHOLDER")
                              ? "SHAREHOLDER"
                              : undefined,
                          onboardingStatus: p.onboarding?.status ?? null,
                          amlStatus: p.screening?.status ?? null,
                          kycId: p.onboarding?.id ?? null,
                        }))}
                    />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Banking Details Section */}
        <div className="space-y-3">
          <div>
            <h3 className={applicationFlowSectionTitleClassName}>Banking Details</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            <div className={labelClassNameEditable}>Bank name</div>
            <div className="flex flex-col gap-1">
              {effectiveCanEdit ? (
                <Select
                  value={formState.bankName}
                  onValueChange={(value) =>
                    setFormState((prev) => ({ ...prev, bankName: value }))
                  }
                >
                  <SelectTrigger
                    className={withFieldError(
                      formSelectTriggerClassName,
                      Boolean(fieldErrors.bankName)
                    )}
                  >
                    <SelectValue placeholder="Select bank" />
                  </SelectTrigger>
                  <SelectContent>
                    {MALAYSIAN_BANKS.map((bank) => (
                      <SelectItem key={bank.value} value={bank.value}>
                        {bank.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={formState.bankName || "—"} disabled className={inputClassName} />
              )}

              {fieldErrors.bankName && (
                <p className="text-xs text-destructive">{fieldErrors.bankName}</p>
              )}
            </div>

            <div className={labelClassNameEditable}>Bank account number</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.bankAccountNumber}
                onChange={(e) => {
                  const digitsOnly = restrictDigitsOnly(e.target.value);
                  if (digitsOnly.length > BANK_ACCOUNT_MAX_LENGTH) return;
                  setFormState((prev) => ({
                    ...prev,
                    bankAccountNumber: digitsOnly,
                  }));
                }}
                placeholder="eg. 1234123412341234"
                disabled={!effectiveCanEdit}
                className={withFieldError(
                  effectiveCanEdit ? inputClassNameEditable : inputClassName,
                  Boolean(fieldErrors.bankAccountNumber)
                )}
              />

              <div className="min-h-[20px]">
                {fieldErrors.bankAccountNumber ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.bankAccountNumber}
                  </p>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    {BANK_ACCOUNT_MIN_LENGTH}–{BANK_ACCOUNT_MAX_LENGTH} digits
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Person Section */}
        <div className="space-y-3">
          <div>
            <h3 className={applicationFlowSectionTitleClassName}>Contact Person</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            <div className={labelClassNameEditable}>Applicant name</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.contactPersonName}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    contactPersonName: e.target.value,
                  }))
                }
                disabled={!effectiveCanEdit}
                placeholder="eg. John Doe"
                className={cn(
                  withFieldError(
                    inputClassNameEditable,
                    Boolean(fieldErrors.contactPersonName)
                  ),
                  !effectiveCanEdit && formInputDisabledClassName
                )}
              />
              {fieldErrors.contactPersonName && (
                <p className="text-xs text-destructive">
                  {fieldErrors.contactPersonName}
                </p>
              )}
            </div>

            <div className={labelClassNameEditable}>Applicant email</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.contactPersonEmail}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    contactPersonEmail: e.target.value,
                  }))
                }
                disabled={!effectiveCanEdit}
                placeholder="eg. john.doe@example.com"
                className={cn(
                  withFieldError(
                    inputClassNameEditable,
                    Boolean(fieldErrors.contactPersonEmail)
                  ),
                  !effectiveCanEdit && formInputDisabledClassName
                )}
              />
              {fieldErrors.contactPersonEmail && (
                <p className="text-xs text-destructive">
                  {fieldErrors.contactPersonEmail}
                </p>
              )}
            </div>

            <div className={labelClassNameEditable}>Applicant position</div>
            <div className="flex flex-col gap-1">
              <Input
                value={formState.contactPersonPosition}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    contactPersonPosition: e.target.value,
                  }))
                }
                disabled={!effectiveCanEdit}
                placeholder="eg. CEO"
                className={cn(
                  withFieldError(
                    inputClassNameEditable,
                    Boolean(fieldErrors.contactPersonPosition)
                  ),
                  !effectiveCanEdit && formInputDisabledClassName
                )}
              />
              {fieldErrors.contactPersonPosition && (
                <p className="text-xs text-destructive">
                  {fieldErrors.contactPersonPosition}
                </p>
              )}
            </div>

            <div className={labelClassNameEditable}>Applicant contact</div>
            <div className="flex flex-col gap-1">
              <PhoneInput
                international
                defaultCountry="MY"
                value={formState.contactPersonContact || undefined}
                onChange={(v) =>
                  setFormState((prev) => ({
                    ...prev,
                    contactPersonContact: v ?? "",
                  }))
                }
                disabled={!effectiveCanEdit}
                className={cn(
                  withFieldError(formInputClassName, Boolean(fieldErrors.contactPersonContact)),
                  "px-4 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm",
                  !effectiveCanEdit && formInputDisabledClassName
                )}
              />
              {fieldErrors.contactPersonContact && (
                <p className="text-xs text-destructive">
                  {fieldErrors.contactPersonContact}
                </p>
              )}
            </div>
          </div>
        </div>

        <EditAddressDialog
          open={isEditAddressOpen}
          onOpenChange={setIsEditAddressOpen}
          businessAddress={{
            line1: (formState.businessAddress?.line1 as string) || "",
            line2: (formState.businessAddress?.line2 as string) || "",
            city: (formState.businessAddress?.city as string) || "",
            postalCode: (formState.businessAddress?.postalCode as string) || "",
            state: (formState.businessAddress?.state as string) || "",
            country: (formState.businessAddress?.country as string) || "Malaysia",
          }}
          registeredAddress={{
            line1: (formState.registeredAddress?.line1 as string) || "",
            line2: (formState.registeredAddress?.line2 as string) || "",
            city: (formState.registeredAddress?.city as string) || "",
            postalCode: (formState.registeredAddress?.postalCode as string) || "",
            state: (formState.registeredAddress?.state as string) || "",
            country: (formState.registeredAddress?.country as string) || "Malaysia",
          }}
          onSave={handleSaveAddress}
          canEdit={effectiveCanEdit}
        />
      </div>
    </>
  );
}

function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  onSave,
  canEdit = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessAddress: Record<string, string>;
  registeredAddress: Record<string, string>;
  onSave: (businessAddress: Record<string, string>, registeredAddress: Record<string, string>) => void;
  canEdit?: boolean;
}) {
  const [businessAddress, setBusinessAddress] = React.useState<Record<string, string>>(initialBusinessAddress);
  const [registeredAddress, setRegisteredAddress] = React.useState<Record<string, string>>(initialRegisteredAddress);
  const [registeredAddressSameAsBusiness, setRegisteredAddressSameAsBusiness] = React.useState(
    JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
  );

  React.useEffect(() => {
    if (open) {
      setBusinessAddress({ ...initialBusinessAddress, country: initialBusinessAddress.country || "Malaysia" });
      setRegisteredAddress({ ...initialRegisteredAddress, country: initialRegisteredAddress.country || "Malaysia" });
      setRegisteredAddressSameAsBusiness(
        JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
      );
    }
  }, [open, initialBusinessAddress, initialRegisteredAddress]);

  React.useEffect(() => {
    if (registeredAddressSameAsBusiness) {
      setRegisteredAddress(businessAddress);
    }
  }, [registeredAddressSameAsBusiness, businessAddress]);

  const businessAddressValid = isValidAddress(businessAddress as Record<string, unknown>);
  const registeredAddressValid = registeredAddressSameAsBusiness
    ? businessAddressValid
    : isValidAddress(registeredAddress as Record<string, unknown>);

  const handleSave = () => {
    const finalRegisteredAddress = registeredAddressSameAsBusiness ? businessAddress : registeredAddress;
    if (!canEdit) return;
    if (!businessAddressValid || !registeredAddressValid) return;
    onSave(businessAddress, finalRegisteredAddress);
  };

  const handleCancel = () => {
    setBusinessAddress(initialBusinessAddress);
    setRegisteredAddress(initialRegisteredAddress);
    setRegisteredAddressSameAsBusiness(
      JSON.stringify(initialBusinessAddress) === JSON.stringify(initialRegisteredAddress)
    );
    onOpenChange(false);
  };

  const updateBusinessAddress = (field: string, value: string) => {
    setBusinessAddress((prev) => ({ ...prev, [field]: value }));
  };

  const updateRegisteredAddress = (field: string, value: string) => {
    setRegisteredAddress((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader>
          <DialogTitle>Edit Address</DialogTitle>
          <DialogDescription className="text-ui">
            Update your business address and registered address.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-8 py-4">
          <div className="space-y-3">
            <h4 className={applicationFlowSectionTitleClassName}>Business address</h4>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="business-line1" className={formLabelClassName}>Address line 1</Label>
                <Input
                  id="business-line1"
                  value={businessAddress.line1}
                  onChange={(e) => updateBusinessAddress("line1", e.target.value)}
                  placeholder="Street Address"
                  className={formInputClassName}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-line2" className={formLabelClassName}>Address line 2</Label>
                <Input
                  id="business-line2"
                  value={businessAddress.line2}
                  onChange={(e) => updateBusinessAddress("line2", e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                  className={formInputClassName}
                  disabled={!canEdit}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-city" className={formLabelClassName}>City</Label>
                  <Input
                    id="business-city"
                    value={businessAddress.city}
                    onChange={(e) => updateBusinessAddress("city", e.target.value)}
                    placeholder="Enter city"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-postal-code" className={formLabelClassName}>Postal code</Label>
                  <Input
                    id="business-postal-code"
                    value={businessAddress.postalCode}
                    onChange={(e) => updateBusinessAddress("postalCode", restrictDigitsOnly(e.target.value))}
                    placeholder="Enter postal code (numbers only)"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-state" className={formLabelClassName}>State</Label>
                  <Input
                    id="business-state"
                    value={businessAddress.state}
                    onChange={(e) => updateBusinessAddress("state", e.target.value)}
                    placeholder="Enter state"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-country" className={formLabelClassName}>Country</Label>
                  <Input
                    id="business-country"
                    value={businessAddress.country}
                    onChange={(e) => updateBusinessAddress("country", e.target.value)}
                    placeholder="Enter country"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className={applicationFlowSectionTitleClassName}>Registered address</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="registered-same-as-business"
                  checked={registeredAddressSameAsBusiness}
                  onCheckedChange={(checked) => setRegisteredAddressSameAsBusiness(checked === true)}
                  disabled={!canEdit}
                />
                <Label htmlFor="registered-same-as-business" className={formLabelClassName}>
                  Same as business address
                </Label>
              </div>
            </div>
            {!registeredAddressSameAsBusiness && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="registered-line1" className={formLabelClassName}>Address line 1</Label>
                  <Input
                    id="registered-line1"
                    value={registeredAddress.line1}
                    onChange={(e) => updateRegisteredAddress("line1", e.target.value)}
                    placeholder="Street Address"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registered-line2" className={formLabelClassName}>Address line 2</Label>
                  <Input
                    id="registered-line2"
                    value={registeredAddress.line2}
                    onChange={(e) => updateRegisteredAddress("line2", e.target.value)}
                    placeholder="Apartment, suite, etc. (optional)"
                    className={formInputClassName}
                    disabled={!canEdit}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-city" className={formLabelClassName}>City</Label>
                    <Input
                      id="registered-city"
                      value={registeredAddress.city}
                      onChange={(e) => updateRegisteredAddress("city", e.target.value)}
                      placeholder="Enter city"
                      className={formInputClassName}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-postal-code" className={formLabelClassName}>Postal code</Label>
                    <Input
                      id="registered-postal-code"
                      value={registeredAddress.postalCode}
                      onChange={(e) => updateRegisteredAddress("postalCode", restrictDigitsOnly(e.target.value))}
                      placeholder="Enter postal code (numbers only)"
                      className={formInputClassName}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-state" className={formLabelClassName}>State</Label>
                    <Input
                      id="registered-state"
                      value={registeredAddress.state}
                      onChange={(e) => updateRegisteredAddress("state", e.target.value)}
                      placeholder="Enter state"
                      className={formInputClassName}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-country" className={formLabelClassName}>Country</Label>
                    <Input
                      id="registered-country"
                      value={registeredAddress.country}
                      onChange={(e) => updateRegisteredAddress("country", e.target.value)}
                      placeholder="Enter country"
                      className={formInputClassName}
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canEdit || !businessAddressValid || !registeredAddressValid}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

