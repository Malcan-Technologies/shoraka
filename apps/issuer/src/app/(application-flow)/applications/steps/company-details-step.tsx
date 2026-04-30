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
import { useOrganization, createApiClient, useAuthToken } from "@cashsouk/config";
import {
  buildDirectorShareholderDisplayRowForEmailEligibility,
  canEnterEmailForDirectorShareholder,
  filterVisiblePeopleRows,
  formatPeopleRolesLine,
  formatSharePercentageCell,
  normalizeRawStatus,
} from "@cashsouk/types";
import {
  areDirectorShareholdersReadyForApplicationSubmit,
} from "@/lib/director-shareholder-onboarding-ui";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircleIcon, PencilIcon } from "@heroicons/react/24/outline";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
  withFieldError,
} from "@/app/(application-flow)/applications/components/form-control";
import { CompanyDetailsSkeleton } from "@/app/(application-flow)/applications/components/company-details-skeleton";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

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
  businessAddress: Record<string, unknown> | null;
  registeredAddress: Record<string, unknown> | null;
  bankName: string;
  bankAccountNumber: string;
  contactPersonName: string;
  contactPersonEmail: string;
  contactPersonPosition: string;
  contactPersonContact: string;
}

function getBankField(bankDetails: Record<string, unknown> | null, fieldName: string): string {
  const content = bankDetails?.content;
  if (!Array.isArray(content)) return "";
  const field = content.find((f: { fieldName?: string; fieldValue?: string }) => f?.fieldName === fieldName);
  return field?.fieldValue ?? "";
}

const MALAYSIAN_BANKS = [
  { value: "Affin Bank Berhad", label: "Affin Bank" },
  { value: "Alliance Bank Malaysia Berhad", label: "Alliance Bank" },
  { value: "AmBank / AmFinance Berhad", label: "AmBank" },
  { value: "Bangkok Bank Berhad", label: "Bangkok Bank" },
  { value: "Bank Islam Malaysia Berhad", label: "Bank Islam" },
  { value: "Bank Kerjasama Rakyat Malaysia Berhad (Bank Rakyat)", label: "Bank Rakyat" },
  { value: "Bank Muamalat Malaysia Berhad", label: "Bank Muamalat" },
  { value: "Bank Pertanian Malaysia Berhad (Agrobank)", label: "Agrobank" },
  { value: "Bank Simpanan Nasional Berhad (BSN)", label: "BSN" },
  { value: "Bank of America", label: "Bank of America" },
  { value: "Bank of China (Malaysia) Berhad", label: "Bank of China" },
  { value: "CIMB Bank Berhad", label: "CIMB Bank" },
  { value: "Co-operative Bank of Malaysia Berhad (Co-opbank Pertama)", label: "Co-opbank Pertama" },
  { value: "Deutsche Bank (Malaysia) Berhad", label: "Deutsche Bank" },
  { value: "Hong Leong Bank Berhad", label: "Hong Leong Bank" },
  { value: "JP Morgan Chase Bank Berhad", label: "JP Morgan Chase" },
  { value: "Maybank / Malayan Banking Berhad", label: "Maybank" },
  { value: "Public Bank Berhad", label: "Public Bank" },
  { value: "RHB Bank Berhad", label: "RHB Bank" },
  { value: "Standard Chartered Bank Malaysia Berhad", label: "Standard Chartered" },
  { value: "Sumitomo Mitsui Banking Corporation Malaysia Berhad", label: "Sumitomo Mitsui" },
  { value: "United Overseas Bank (Malaysia) Berhad", label: "UOB Malaysia" },
  { value: "UOB Bank Berhad", label: "UOB Bank" },
];

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

type UnifiedStatusTone = "muted" | "danger" | "warning" | "success";

function getUnifiedDirectorShareholderStatus(person: {
  onboarding?: { status?: unknown } | null;
  screening?: { status?: unknown } | null;
}) {
  const screening = normalizeRawStatus(person.screening?.status);
  const onboarding = normalizeRawStatus(person.onboarding?.status);
  if (screening === "APPROVED" || onboarding === "APPROVED") {
    return { label: "Completed", tone: "success" as UnifiedStatusTone };
  }
  if (onboarding === "WAIT_FOR_APPROVAL") {
    return { label: "In Progress", tone: "warning" as UnifiedStatusTone };
  }
  if (onboarding === "REJECTED") {
    return { label: "Action Required", tone: "danger" as UnifiedStatusTone };
  }
  return { label: "Not Started", tone: "muted" as UnifiedStatusTone };
}

function getStatusToneClass(tone: UnifiedStatusTone): string {
  if (tone === "success") return "text-green-600";
  if (tone === "warning") return "text-amber-600";
  if (tone === "danger") return "text-red-600";
  return "text-muted-foreground";
}

export function CompanyDetailsStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: CompanyDetailsStepProps) {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const devTools = useDevTools();

  const apiClient = React.useMemo(
    () => createApiClient(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", getAccessToken),
    [getAccessToken]
  );

  // Fetch current user to derive organization edit permission
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const result = await apiClient.get<{ userId: string }>("/v1/auth/me");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
  });

  const canEditOrganization = React.useMemo(() => {
    if (!activeOrganization || !currentUser) return false;
    if (activeOrganization.isOwner) return true;
    const currentUserMember = activeOrganization.members?.find((m: any) => m.id === currentUser.userId);
    return currentUserMember?.role === "ORGANIZATION_ADMIN";
  }, [activeOrganization, currentUser]);

  const effectiveCanEdit = readOnly ? false : canEditOrganization;

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

  const directorsPartySubmitReady = React.useMemo(
    () =>
      areDirectorShareholdersReadyForApplicationSubmit({
        people: entitiesData?.people ?? [],
      }),
    [entitiesData?.people]
  );

  /* ================================================================
     LOCAL FORM STATE - Single source of truth
     ================================================================ */

  const [formState, setFormState] = React.useState<FormState>({
    industry: "",
    numberOfEmployees: "",
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

  /* ================================================================
     INITIAL STATE TRACKING - For change detection
     ================================================================ */

  const initialStateRef = React.useRef<FormState | null>(null);

  /* ================================================================
     DETERMINISTIC HYDRATION - Run once after all data loads
     ================================================================ */

  const hasHydratedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasHydratedRef.current) return;
    if (!application || !organizationId) return;
    if (isLoadingData) return;

    // Hydrate from all sources
    const savedContactPerson = (application?.company_details as Record<string, unknown> | undefined)?.contact_person as Record<string, unknown> | undefined;
    const basicInfo = corporateInfo?.basicInfo;
    const businessAddress = corporateInfo?.addresses?.business;
    const registeredAddress = corporateInfo?.addresses?.registered;
    const bankDetails = (bankAccountDetails as Record<string, unknown> | null) || null;

    const hydratedState: FormState = {
      industry: basicInfo?.industry || "",
      numberOfEmployees: (basicInfo?.numberOfEmployees?.toString() || ""),
      businessAddress: (businessAddress as Record<string, unknown>) || null,
      registeredAddress: (registeredAddress as Record<string, unknown>) || null,
      bankName: getBankField(bankDetails, "Bank"),
      bankAccountNumber: getBankField(bankDetails, "Bank account number"),
      contactPersonName: (savedContactPerson?.name as string) || "",
      contactPersonEmail: (savedContactPerson?.email as string) || "",
      contactPersonPosition: (savedContactPerson?.position as string) || "",
      contactPersonContact: (savedContactPerson?.contact as string) || "",
    };

    setFormState(hydratedState);
    initialStateRef.current = hydratedState;

    hasHydratedRef.current = true;
  }, [application, organizationId, isLoadingData, corporateInfo, bankAccountDetails]);

  /* ================================================================
     VALIDATION - Pure function, no side effects
     ================================================================ */

  const validateAll = React.useCallback((): { errors: string[]; fieldErrors: Record<string, string> } => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // Contact person validation
    if (!formState.contactPersonName?.trim()) {
      errors.push("Applicant name is required");
      fieldErrors.contactPersonName = "Required";
    }
    if (!formState.contactPersonEmail?.trim()) {
      errors.push("Applicant email is required");
      fieldErrors.contactPersonEmail = "Required";
    }
    if (!formState.contactPersonPosition?.trim()) {
      errors.push("Applicant position is required");
      fieldErrors.contactPersonPosition = "Required";
    }
    if (!formState.contactPersonContact?.trim()) {
      errors.push("Applicant contact is required");
      fieldErrors.contactPersonContact = "Required";
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
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_COMPANY_REQUIRED_FIELDS");
    }

    if (!organizationId) throw new Error("Organization ID required");

    try {
      const updates: Record<string, unknown> = {};

      if (formState.industry) updates.industry = formState.industry;
      if (formState.numberOfEmployees) {
        updates.numberOfEmployees = Number.parseInt(
          formState.numberOfEmployees,
          10
        );
      }

      updates.businessAddress = formState.businessAddress;
      updates.registeredAddress = formState.registeredAddress;

      // ONLY PATCH IF ADMIN / OWNER
      if (effectiveCanEdit) {
        // PATCH corporate info
        if (Object.keys(updates).length > 0) {
          const result = await apiClient.patch(
            `/v1/organizations/issuer/${organizationId}/corporate-info`,
            updates
          );
          if (!result.success) throw new Error(result.error.message);
        }

        // PATCH banking
        const bankAccountDetailsPayload = {
          content: [
            {
              cn: false,
              fieldName: "Bank",
              fieldType: "picklist",
              fieldValue: formState.bankName ?? "",
            },
            {
              cn: false,
              fieldName: "Bank account number",
              fieldType: "number",
              fieldValue: formState.bankAccountNumber ?? "",
            },
          ],
          displayArea: "Operational Information",
        };

        const result = await apiClient.patch(
          `/v1/organizations/issuer/${organizationId}`,
          {
            bankAccountDetails: bankAccountDetailsPayload,
          }
        );

        if (!result.success) throw new Error(result.error.message);

        // Invalidate ONLY if patch happened
        queryClient.invalidateQueries({
          queryKey: ["corporate-info", organizationId],
        });
        queryClient.invalidateQueries({
          queryKey: ["organization-detail", organizationId],
        });
      }

      setFieldErrors({});

      // Always return contact person (application-level)
      return {
        contact_person: {
          name: formState.contactPersonName.trim(),
          email: formState.contactPersonEmail.trim(),
          position: formState.contactPersonPosition.trim(),
          contact: formState.contactPersonContact.trim(),
        },
      };
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      throw error;
    }
  }, [
    formState,
    organizationId,
    apiClient,
    queryClient,
    validateAll,
    effectiveCanEdit,
  ]);

  /* ================================================================
     VALIDITY CHECK - Compute from current state
     ================================================================ */

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
      formState.bankName?.trim() &&
      formState.bankAccountNumber?.trim() &&
      directorsPartySubmitReady
    );
  }, [formState, directorsPartySubmitReady]);

  /* ================================================================
     CHANGE DETECTION - Real pending changes logic
     ================================================================ */

  const hasPendingChanges = React.useMemo(() => {
    if (!initialStateRef.current) return false;
    return JSON.stringify(formState) !== JSON.stringify(initialStateRef.current);
  }, [formState]);

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

  if (isLoadingData || !hasHydratedRef.current || devTools?.showSkeletonDebug) {
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
            <h3 className={applicationFlowSectionTitleClassName}>{"Director & Shareholders"}</h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center">
            {visiblePeopleRows.length === 0 ? (
              <p className="text-[17px] leading-7 text-muted-foreground col-span-2">
                No directors or shareholders found
              </p>
            ) : (
              visiblePeopleRows.map((p) => {
                const displayRow = buildDirectorShareholderDisplayRowForEmailEligibility(p, null);
                const statusView = getUnifiedDirectorShareholderStatus(p);
                const own = formatSharePercentageCell(p);
                const showCompleteOnProfile = canEnterEmailForDirectorShareholder(p);
                const idLabel =
                  (displayRow.idNumber || displayRow.registrationNumber || p.matchKey || "").trim();
                return (
                  <React.Fragment key={p.matchKey}>
                    <div className={labelClassName}>{formatPeopleRolesLine(p)}</div>
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-[17px] leading-7 font-medium truncate">{p.name ?? "—"}</span>
                          <span className="text-xs text-muted-foreground truncate">{idLabel || "—"}</span>
                        </div>
                        <div className="h-4 w-px bg-border" />
                        <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">{own}</div>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs text-muted-foreground">Status</span>
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {statusView.tone === "success" ? (
                              <CheckCircleIcon className="h-4 w-4 text-green-600 shrink-0" />
                            ) : null}
                            <span className={cn("text-[17px] leading-7 truncate", getStatusToneClass(statusView.tone))}>
                              {statusView.label}
                            </span>
                          </div>
                        </div>
                      </div>
                      {showCompleteOnProfile ? (
                        <p className="text-sm text-muted-foreground">
                          Submit onboarding on Profile → Directors and shareholders.
                        </p>
                      ) : null}
                    </div>
                  </React.Fragment>
                );
              })
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
          <DialogDescription className="text-[15px]">
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

