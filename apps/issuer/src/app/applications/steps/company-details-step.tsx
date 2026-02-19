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
import { useQueryClient } from "@tanstack/react-query";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
import { cn } from "@/lib/utils";
import {
  formInputClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  withFieldError,
} from "@/app/applications/components/form-control";
import { StepSkeleton } from "@/app/applications/components/step-skeleton";

interface CompanyDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
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
  contactPersonPosition: string;
  contactPersonIc: string;
  contactPersonContact: string;
}

function getBankField(bankDetails: Record<string, unknown> | null, fieldName: string): string {
  if (!bankDetails?.content) return "";
  const content = bankDetails.content as Array<{ fieldName: string; fieldValue: string }>;
  const field = content.find((f) => f.fieldName === fieldName);
  return field?.fieldValue || "";
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

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

const BANK_ACCOUNT_REGEX = /^\d*$/;
const BANK_ACCOUNT_MIN_LENGTH = 10;
const BANK_ACCOUNT_MAX_LENGTH = 18;
const IC_NUMBER_REGEX = /^\d*$/;

function isValidNumberOfEmployees(value: string): boolean {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isInteger(n) && n > 0 && value.trim().replace(/^0+/, "") !== "";
}

function restrictDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function restrictIcNumber(value: string): string {
  return value.replace(/\D/g, "");
}

const inputClassName = cn(formInputClassName, "bg-muted");
const inputClassNameEditable = formInputClassName;
const labelClassName = formLabelClassName;
const labelClassNameEditable = formLabelClassName;
const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";

export function CompanyDetailsStep({
  applicationId,
  onDataChange,
}: CompanyDetailsStepProps) {
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id;
  const { getAccessToken } = useAuthToken();
  const queryClient = useQueryClient();

  const apiClient = React.useMemo(
    () => createApiClient(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", getAccessToken),
    [getAccessToken]
  );

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
    contactPersonPosition: "",
    contactPersonIc: "",
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
      contactPersonPosition: (savedContactPerson?.position as string) || "",
      contactPersonIc: (savedContactPerson?.ic as string) || "",
      contactPersonContact: (savedContactPerson?.contact as string) || "",
    };

    setFormState(hydratedState);
    initialStateRef.current = hydratedState;

    hasHydratedRef.current = true;
    console.warn("[COMPANY] Hydrated");
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
    if (!formState.contactPersonPosition?.trim()) {
      errors.push("Applicant position is required");
      fieldErrors.contactPersonPosition = "Required";
    }
    if (!formState.contactPersonIc?.trim()) {
      errors.push("Applicant IC number is required");
      fieldErrors.contactPersonIc = "Required";
    } else if (!IC_NUMBER_REGEX.test(formState.contactPersonIc)) {
      errors.push("Applicant IC number must contain only digits");
      fieldErrors.contactPersonIc = "Digits only";
    }
    if (!formState.contactPersonContact?.trim()) {
      errors.push("Applicant contact is required");
      fieldErrors.contactPersonContact = "Required";
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
    console.warn("[COMPANY] Save triggered");

    // Validate immediately
    const { errors, fieldErrors: nextFieldErrors } = validateAll();
    setFieldErrors(nextFieldErrors);

    if (errors.length > 0) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_COMPANY_REQUIRED_FIELDS");
    }

    // Persist to DB
    if (!organizationId) throw new Error("Organization ID required");

    try {
      const updates: Record<string, unknown> = {};

      if (formState.industry) updates.industry = formState.industry;
      if (formState.numberOfEmployees) {
        updates.numberOfEmployees = Number.parseInt(formState.numberOfEmployees, 10);
      }
      updates.businessAddress = formState.businessAddress;
      updates.registeredAddress = formState.registeredAddress;

      if (Object.keys(updates).length > 0) {
        const result = await apiClient.patch(
          `/v1/organizations/issuer/${organizationId}/corporate-info`,
          updates
        );
        if (!result.success) throw new Error(result.error.message);
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      }

      // Save banking
      const bankAccountDetailsPayload = {
        content: [
          { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: formState.bankName ?? "" },
          { cn: false, fieldName: "Bank account number", fieldType: "number", fieldValue: formState.bankAccountNumber ?? "" },
        ],
        displayArea: "Operational Information",
      };
      const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}`, {
        bankAccountDetails: bankAccountDetailsPayload,
      });
      if (!result.success) throw new Error(result.error.message);
      queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });

      setFieldErrors({});

      // Return contact person for application save
      return {
        contact_person: {
          name: formState.contactPersonName.trim(),
          position: formState.contactPersonPosition.trim(),
          ic: formState.contactPersonIc.trim(),
          contact: formState.contactPersonContact.trim(),
        },
      };
    } catch (error) {
      console.warn("[COMPANY] Save error:", error instanceof Error ? error.message : error);
      toast.error("Something went wrong. Please try again.");
      throw error;
    }
  }, [formState, organizationId, apiClient, queryClient, validateAll]);

  /* ================================================================
     VALIDITY CHECK - Compute from current state
     ================================================================ */

  const isValid = React.useMemo(() => {
    return !!(
      formState.contactPersonName?.trim() &&
      formState.contactPersonPosition?.trim() &&
      formState.contactPersonIc?.trim() &&
      formState.contactPersonContact?.trim() &&
      formState.industry?.trim() &&
      formState.numberOfEmployees?.trim() &&
      formState.bankName?.trim() &&
      formState.bankAccountNumber?.trim()
    );
  }, [formState]);

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
        ic: formState.contactPersonIc,
        contact: formState.contactPersonContact,
      },
      saveFunction,
      hasPendingChanges,
      isValid,
    });
  }, [organizationId, onDataChange, saveFunction, isValid, formState, hasPendingChanges]);

  /* ================================================================
     DIRECTORS & SHAREHOLDERS LIST
     ================================================================ */

  const directorsDisplay = entitiesData?.directorsDisplay ?? [];
  const shareholdersDisplay = entitiesData?.shareholdersDisplay ?? [];
  const corporateShareholders = entitiesData?.corporateShareholders ?? [];

  const combinedList = React.useMemo(() => {
    const seen = new Set<string>();
    const result: Array<Record<string, unknown>> = [];

    directorsDisplay.forEach((d) => {
      const normalized = normalizeName(d.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        const isAlsoShareholder = d.ownershipLabel !== "—";
        result.push({
          type: "director",
          name: d.name,
          roleLabel: isAlsoShareholder ? "Director, Shareholder" : "Director",
          ownership: d.ownershipLabel,
          statusType: "kyc",
          statusVerified: d.kycVerified,
          key: `dir-${normalized}`,
        });
      }
    });

    shareholdersDisplay.forEach((s) => {
      const normalized = normalizeName(s.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push({
          type: "shareholder",
          name: s.name,
          roleLabel: "Shareholder",
          ownership: s.ownershipLabel,
          statusType: "kyc",
          statusVerified: s.kycVerified,
          key: `sh-${normalized}`,
        });
      }
    });

    corporateShareholders.forEach((corp: Record<string, unknown>) => {
      const displayAreas = (corp.formContent as Record<string, unknown>)?.displayAreas as Array<Record<string, unknown>> | undefined;
      const firstArea = displayAreas?.[0] as Record<string, unknown> | undefined;
      const content = firstArea?.content as Array<Record<string, unknown>> | undefined;
      const shareField = content?.find(
        (f) => f.fieldName === "% of Shares"
      );
      const sharePercentage = shareField?.fieldValue ? Number(shareField.fieldValue) : null;
      const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
      const kybApproved = corp.approveStatus === "APPROVED";

      result.push({
        type: "corporate_shareholder",
        name: corp.businessName || corp.companyName || "—",
        roleLabel: "Corporate Shareholder",
        ownership: ownershipLabel,
        statusType: "kyb",
        statusVerified: kybApproved,
        key: `corp-${corp.requestId}`,
      });
    });

    return result;
  }, [directorsDisplay, shareholdersDisplay, corporateShareholders]);

  const hasDirectorsOrShareholders = combinedList.length > 0;

  /* ================================================================
     RENDER
     ================================================================ */

  if (isLoadingData || !hasHydratedRef.current) {
    return (
      <CompanyDetailsSkeleton 
        showButton
        onSaveClick={() => console.log('Save clicked from company skeleton')}
      />
    );
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
    <div className="space-y-10 px-3">
      {/* Company Info Section */}
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Company info</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
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
          <div>
            <Input
              value={formState.industry}
              onChange={(e) => setFormState((prev) => ({ ...prev, industry: e.target.value }))}
              placeholder="eg. Technology"
              className={withFieldError(inputClassNameEditable, Boolean(fieldErrors.industry))}
            />
            {fieldErrors.industry && (
              <p className="text-destructive text-sm mt-1">{fieldErrors.industry}</p>
            )}
          </div>

          <div className={labelClassNameEditable}>Number of employees</div>
          <div>
            <Input
              value={formState.numberOfEmployees}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  numberOfEmployees: restrictDigitsOnly(e.target.value),
                }))
              }
              placeholder="eg. 10"
              className={withFieldError(
                inputClassNameEditable,
                Boolean(fieldErrors.numberOfEmployees)
              )}
            />
            {fieldErrors.numberOfEmployees && (
              <p className="text-destructive text-sm mt-1">
                {fieldErrors.numberOfEmployees}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Address Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className={sectionHeaderClassName}>Address</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditAddressOpen(true)}
            className="h-6 gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 text-sm"
          >
            Edit
            <PencilIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 h-px bg-border" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <div className={labelClassName}>Business address</div>
          <Input
            value={formatAddress(formState.businessAddress)}
            disabled
            className={inputClassName}
          />

          <div className={labelClassName}>Registered address</div>
          <Input
            value={formatAddress(formState.registeredAddress)}
            disabled
            className={inputClassName}
          />
        </div>
      </div>

      {/* Directors & Shareholders Section */}
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Director & Shareholders</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          {!hasDirectorsOrShareholders ? (
            <p className="text-[17px] leading-7 text-muted-foreground col-span-2">
              No directors or shareholders found
            </p>
          ) : (
            combinedList.map((item) => (
              <React.Fragment key={item.key as string}>
                <div className={labelClassName}>{item.roleLabel as string}</div>
                <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                  <div className="text-[17px] leading-7 font-medium whitespace-nowrap">
                    {item.name as string}
                  </div>
                  <div className="h-4 w-px bg-border" />
                  <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">
                    {item.ownership as string}
                  </div>
                  <div className="h-4 w-px bg-border" />
                  {item.statusVerified ? (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <CheckCircleIcon className="h-4 w-4 text-green-600" />
                      <span className="text-[17px] leading-7 text-green-600">
                        {item.statusType === "kyb" ? "KYB" : "KYC"}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Banking Details Section */}
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Banking details</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <div className={labelClassNameEditable}>Bank name</div>
          <div>
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

            {fieldErrors.bankName && (
              <p className="text-destructive text-sm mt-1">{fieldErrors.bankName}</p>
            )}
          </div>

          <div className={labelClassNameEditable}>Bank account number</div>
          <div>
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
              className={withFieldError(
                inputClassNameEditable,
                Boolean(fieldErrors.bankAccountNumber)
              )}
            />

            <div className="min-h-[20px] mt-1">
              {fieldErrors.bankAccountNumber ? (
                <p className="text-destructive text-sm">
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
      <div className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Contact Person</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3">
          <div className={labelClassNameEditable}>Applicant name</div>
          <div>
            <Input
              value={formState.contactPersonName}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  contactPersonName: e.target.value,
                }))
              }
              placeholder="eg. John Doe"
              className={withFieldError(
                inputClassNameEditable,
                Boolean(fieldErrors.contactPersonName)
              )}
            />
            {fieldErrors.contactPersonName && (
              <p className="text-destructive text-sm mt-1">
                {fieldErrors.contactPersonName}
              </p>
            )}
          </div>

          <div className={labelClassNameEditable}>Applicant position</div>
          <div>
            <Input
              value={formState.contactPersonPosition}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  contactPersonPosition: e.target.value,
                }))
              }
              placeholder="eg. CEO"
              className={withFieldError(
                inputClassNameEditable,
                Boolean(fieldErrors.contactPersonPosition)
              )}
            />
            {fieldErrors.contactPersonPosition && (
              <p className="text-destructive text-sm mt-1">
                {fieldErrors.contactPersonPosition}
              </p>
            )}
          </div>

          <div className={labelClassNameEditable}>Applicant IC no</div>
          <div>
            <Input
              value={formState.contactPersonIc}
              onChange={(e) =>
                setFormState((prev) => ({
                  ...prev,
                  contactPersonIc: restrictIcNumber(e.target.value),
                }))
              }
              placeholder="eg. 1234567890"
              className={withFieldError(
                inputClassNameEditable,
                Boolean(fieldErrors.contactPersonIc)
              )}
            />
            {fieldErrors.contactPersonIc && (
              <p className="text-destructive text-sm mt-1">
                {fieldErrors.contactPersonIc}
              </p>
            )}
          </div>

          <div className={labelClassNameEditable}>Applicant contact</div>
          <div>
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
              className={cn(
                withFieldError(formInputClassName, Boolean(fieldErrors.contactPersonContact)),
                "px-4 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-sm"
              )}
            />
            {fieldErrors.contactPersonContact && (
              <p className="text-destructive text-sm mt-1">
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
      />
    </div>
  );
}

function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  businessAddress: Record<string, string>;
  registeredAddress: Record<string, string>;
  onSave: (businessAddress: Record<string, string>, registeredAddress: Record<string, string>) => void;
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

  const handleSave = () => {
    const finalRegisteredAddress = registeredAddressSameAsBusiness ? businessAddress : registeredAddress;
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
          <div className="space-y-4">
            <h4 className="text-base font-semibold">Business address</h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-line1" className={formLabelClassName}>Address line 1</Label>
                <Input
                  id="business-line1"
                  value={businessAddress.line1}
                  onChange={(e) => updateBusinessAddress("line1", e.target.value)}
                  placeholder="Street Address"
                  className={formInputClassName}
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
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-semibold">Registered address</h4>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="registered-same-as-business"
                  checked={registeredAddressSameAsBusiness}
                  onCheckedChange={(checked) => setRegisteredAddressSameAsBusiness(checked === true)}
                />
                <Label htmlFor="registered-same-as-business" className={formLabelClassName}>
                  Same as business address
                </Label>
              </div>
            </div>
            {!registeredAddressSameAsBusiness && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registered-line1" className={formLabelClassName}>Address line 1</Label>
                  <Input
                    id="registered-line1"
                    value={registeredAddress.line1}
                    onChange={(e) => updateRegisteredAddress("line1", e.target.value)}
                    placeholder="Street Address"
                    className={formInputClassName}
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
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompanyDetailsSkeleton({ showButton, onSaveClick }: { showButton?: boolean; onSaveClick?: () => void }) {
  return <StepSkeleton rows={6} showButton={showButton} onSaveClick={onSaveClick} />;
}

