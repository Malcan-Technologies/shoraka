"use client";

import * as React from "react";
import { useOrganization, createApiClient, useAuthToken } from "@cashsouk/config";
import { useCorporateInfo } from "@/hooks/use-corporate-info";
import { useCorporateEntities } from "@/hooks/use-corporate-entities";
import { useApplication } from "@/hooks/use-applications";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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

/**
 * COMPANY DETAILS STEP
 *
 * Read-only display of organization information.
 * User reviews their company details before submitting application.
 *
 * Data Flow:
 * 1. Load organization data from database using hooks
 * 2. Display in read-only format
 * 3. Pass organization ID to parent for saving
 *
 * Database format: { issuer_organization_id: "clx123" }
 */

interface CompanyDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

/**
 * Helper function to get bank field value from bank details object
 */
function getBankField(bankDetails: any, fieldName: string): string {
  if (!bankDetails?.content) return "";
  const field = bankDetails.content.find((f: any) => f.fieldName === fieldName);
  return field?.fieldValue || "";
}

/** Malaysian banks list (values match RegTank format); same as profile page */
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

/**
 * Helper function to format address object into a single string.
 * When empty, returns a placeholder instead of "—".
 */
function formatAddress(addr: any): string {
  if (!addr) return ADDRESS_PLACEHOLDER;
  const parts = [
    addr.line1,
    addr.line2,
    addr.city,
    addr.postalCode,
    addr.state,
    addr.country,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : ADDRESS_PLACEHOLDER;
}

/**
 * Helper function to normalize name for deduplication
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Bank account number: digits only, length in range when provided */
const BANK_ACCOUNT_REGEX = /^\d*$/;
const BANK_ACCOUNT_MIN_LENGTH = 10;
const BANK_ACCOUNT_MAX_LENGTH = 18;
/** IC number: digits only (no dashes or letters) */
const IC_NUMBER_REGEX = /^\d*$/;
/** Number of employees: positive integer (digits only, non-zero) */
function isValidNumberOfEmployees(value: string): boolean {
  if (!value.trim()) return true;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isInteger(n) && n > 0 && value.trim().replace(/^0+/, "") !== "";
}

/** Restrict input to digits only (e.g. bank account, number of employees) */
function restrictDigitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Restrict input to digits only (IC number) */
function restrictIcNumber(value: string): string {
  return value.replace(/\D/g, "");
}

const inputClassName = "bg-muted rounded-xl border border-border h-11";
const inputClassNameEditable = "rounded-xl border border-border bg-background text-foreground h-11";
const labelClassName = "text-sm md:text-base leading-6 text-foreground";
const labelClassNameEditable = "text-sm md:text-base leading-6 text-foreground";
const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
const gridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mt-4 px-3";
const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 mt-4 sm:mt-6 px-3";

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

  const [isEditAddressOpen, setIsEditAddressOpen] = React.useState(false);

  /**
   * PENDING CHANGES STATES
   * 
   * Store edits locally until user clicks "Save and Continue".
   * These are NOT saved to database yet.
   */
  const [pendingCompanyInfo, setPendingCompanyInfo] = React.useState<{ industry?: string; numberOfEmployees?: string } | null>(null);
  const [pendingAddress, setPendingAddress] = React.useState<{ businessAddress?: any; registeredAddress?: any } | null>(null);
  const [pendingBanking, setPendingBanking] = React.useState<{ bankName?: string; bankAccountNumber?: string } | null>(null);

  /**
   * CONTACT PERSON STATE
   *
   * Contact person data is stored in application.company_details.contact_person
   * This is user input, not fetched from organization.
   */
  const { data: application } = useApplication(applicationId);
  const savedContactPerson = (application?.company_details as any)?.contact_person;
  
  const [contactPerson, setContactPerson] = React.useState<{
    name: string;
    position: string;
    ic: string;
    contact: string;
  }>({
    name: savedContactPerson?.name || "",
    position: savedContactPerson?.position || "",
    ic: savedContactPerson?.ic || "",
    contact: savedContactPerson?.contact || "",
  });

  // Load saved contact person data when application loads
  React.useEffect(() => {
    if (savedContactPerson) {
      setContactPerson({
        name: savedContactPerson.name || "",
        position: savedContactPerson.position || "",
        ic: savedContactPerson.ic || "",
        contact: savedContactPerson.contact || "",
      });
    }
  }, [savedContactPerson]);

  /**
   * LOAD CORPORATE INFO
   * 
   * useCorporateInfo loads:
   * - basicInfo (company name, entity type, SSM, industry, employees)
   * - addresses (business and registered)
   * - bankAccountDetails
   */
  const {
    corporateInfo,
    bankAccountDetails,
    isLoading: isLoadingInfo,
  } = useCorporateInfo(organizationId);

  /**
   * LOAD CORPORATE ENTITIES
   * 
   * useCorporateEntities loads:
   * - directorsDisplay (directors with KYC status and ownership)
   * - shareholdersDisplay (shareholders with KYC status and ownership)
   * - corporateShareholders (corporate entities with KYB status and ownership)
   */
  const { data: entitiesData, isLoading: isLoadingEntities } = useCorporateEntities(organizationId);
  const isLoading = isLoadingInfo || isLoadingEntities;

  /**
   * SAVE ALL PENDING CHANGES TO DATABASE
   * 
   * This function is called by the parent when user clicks "Save and Continue".
   * It updates the issuer organization table with all pending changes.
   */
  const saveAllPendingChanges = React.useCallback(async () => {
    if (!organizationId) {
      return;
    }

    try {
      const updates: any = {};

      // Save company info only for fields that have pending changes
      if (pendingCompanyInfo) {
        if (pendingCompanyInfo.industry !== undefined) {
          updates.industry = pendingCompanyInfo.industry || null;
        }
        if (pendingCompanyInfo.numberOfEmployees !== undefined) {
          updates.numberOfEmployees = pendingCompanyInfo.numberOfEmployees
            ? Number.parseInt(pendingCompanyInfo.numberOfEmployees, 10)
            : null;
        }
      }

      // Save address if there are pending changes
      if (pendingAddress) {
        updates.businessAddress = pendingAddress.businessAddress;
        updates.registeredAddress = pendingAddress.registeredAddress;
      }

      // Only make API call if there are updates
      if (Object.keys(updates).length > 0) {
        const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}/corporate-info`, updates);
        if (!result.success) {
          throw new Error(result.error.message);
        }
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
      }

      // Save banking if there are pending changes — use current display values so we never overwrite one field with empty
      if (pendingBanking) {
        const currentBankName =
          pendingBanking.bankName !== undefined
            ? pendingBanking.bankName
            : getBankField(bankAccountDetails || null, "Bank");
        const currentAccountNumber =
          pendingBanking.bankAccountNumber !== undefined
            ? pendingBanking.bankAccountNumber
            : getBankField(bankAccountDetails || null, "Bank account number");
        const bankAccountDetailsPayload = {
          content: [
            { cn: false, fieldName: "Bank", fieldType: "picklist", fieldValue: currentBankName ?? "" },
            { cn: false, fieldName: "Bank account number", fieldType: "number", fieldValue: currentAccountNumber ?? "" },
          ],
          displayArea: "Operational Information",
        };
        const result = await apiClient.patch(`/v1/organizations/issuer/${organizationId}`, {
          bankAccountDetails: bankAccountDetailsPayload,
        });
        if (!result.success) {
          throw new Error(result.error.message);
        }
        queryClient.invalidateQueries({ queryKey: ["corporate-info", organizationId] });
        queryClient.invalidateQueries({ queryKey: ["organization-detail", organizationId] });
      }

      // Clear all pending changes after successful save
      setPendingCompanyInfo(null);
      setPendingAddress(null);
      setPendingBanking(null);
    } catch (error) {
      toast.error("Failed to save changes", {
        description: error instanceof Error ? error.message : "An unexpected error occurred",
      });
      throw error;
    }
  }, [organizationId, apiClient, queryClient, pendingCompanyInfo, pendingAddress, pendingBanking, bankAccountDetails]);

  /**
   * Validation errors per field (for inline display)
   */
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  /**
   * VALIDATE CONTACT PERSON
   * Required fields and format: IC digits only, contact from PhoneInput
   */
  const validateContactPerson = React.useCallback(() => {
    const errors: string[] = [];
    if (!contactPerson.name?.trim()) errors.push("Applicant name is required");
    if (!contactPerson.position?.trim()) errors.push("Applicant position is required");
    if (!contactPerson.ic?.trim()) {
      errors.push("Applicant IC number is required");
    } else if (!IC_NUMBER_REGEX.test(contactPerson.ic)) {
      errors.push("Applicant IC number must contain only digits");
    }
    if (!contactPerson.contact?.trim()) {
      errors.push("Applicant contact is required");
    }
    return errors;
  }, [contactPerson]);

  /**
   * Validate all editable fields before save: contact person, number of employees, bank account
   */
  const validateAll = React.useCallback((): { errors: string[]; fieldErrors: Record<string, string> } => {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    const contactErrors = validateContactPerson();
    if (contactErrors.length > 0) {
      errors.push(...contactErrors);
      if (contactErrors.some((e) => e.includes("IC"))) fieldErrors.ic = "Digits only";
      if (contactErrors.some((e) => e.includes("contact"))) fieldErrors.contact = "Required";
      if (contactErrors.some((e) => e.includes("name"))) fieldErrors.name = "Required";
      if (contactErrors.some((e) => e.includes("position"))) fieldErrors.position = "Required";
    }

    const numEmp = pendingCompanyInfo?.numberOfEmployees;
    if (numEmp !== undefined && numEmp !== "" && !isValidNumberOfEmployees(numEmp)) {
      errors.push("Number of employees must be a positive whole number");
      fieldErrors.numberOfEmployees = "Enter a positive whole number";
    }

    const bankNameDisplay =
      pendingBanking?.bankName !== undefined ? pendingBanking.bankName : getBankField(bankAccountDetails || null, "Bank");
    const bankNameStr = (bankNameDisplay ?? "").trim();
    if (!bankNameStr) {
      errors.push("Bank name is required");
      fieldErrors.bankName = "Select a bank";
    }

    const bankNum =
      pendingBanking?.bankAccountNumber ??
      getBankField(bankAccountDetails || null, "Bank account number");
    const bankNumStr = bankNum !== undefined && bankNum !== "" ? String(bankNum).trim() : "";
    if (!bankNumStr) {
      errors.push("Bank account number is required");
      fieldErrors.bankAccountNumber = "Required";
    } else {
      if (!BANK_ACCOUNT_REGEX.test(bankNumStr)) {
        errors.push("Bank account number must contain only numbers");
        fieldErrors.bankAccountNumber = "Only numbers allowed";
      } else if (
        bankNumStr.length < BANK_ACCOUNT_MIN_LENGTH ||
        bankNumStr.length > BANK_ACCOUNT_MAX_LENGTH
      ) {
        errors.push(
          `Bank account number must be between ${BANK_ACCOUNT_MIN_LENGTH} and ${BANK_ACCOUNT_MAX_LENGTH} digits`
        );
        fieldErrors.bankAccountNumber = `Enter ${BANK_ACCOUNT_MIN_LENGTH}-${BANK_ACCOUNT_MAX_LENGTH} digits`;
      }
    }

    return { errors, fieldErrors };
  }, [validateContactPerson, pendingCompanyInfo, pendingBanking, bankAccountDetails]);

  /**
   * CHECK IF CONTACT PERSON HAS CHANGED FROM SAVED STATE
   * 
   * Compare current contactPerson with savedContactPerson to detect changes.
   * Uses trimmed values for comparison.
   */
  const hasContactPersonChanged = React.useMemo(() => {
    if (!savedContactPerson) {
      // If no saved data, check if all fields are filled (user has entered data)
      return !!(
        contactPerson.name?.trim() ||
        contactPerson.position?.trim() ||
        contactPerson.ic?.trim() ||
        contactPerson.contact?.trim()
      );
    }
    
    // Compare trimmed values
    return (
      (contactPerson.name?.trim() || "") !== (savedContactPerson.name?.trim() || "") ||
      (contactPerson.position?.trim() || "") !== (savedContactPerson.position?.trim() || "") ||
      (contactPerson.ic?.trim() || "") !== (savedContactPerson.ic?.trim() || "") ||
      (contactPerson.contact?.trim() || "") !== (savedContactPerson.contact?.trim() || "")
    );
  }, [contactPerson, savedContactPerson]);

  /**
   * CHECK IF THERE ARE ANY PENDING CHANGES
   * 
   * Returns true if:
   * - There are pending company info changes
   * - There are pending address changes
   * - There are pending banking changes
   * - Contact person has changed from saved state
   */
  const hasPendingChanges = React.useMemo(() => {
    return !!(
      pendingCompanyInfo ||
      pendingAddress ||
      pendingBanking ||
      hasContactPersonChanged
    );
  }, [pendingCompanyInfo, pendingAddress, pendingBanking, hasContactPersonChanged]);

  /**
   * PASS DATA TO PARENT
   * 
   * Parent will call saveFunction when user clicks "Save and Continue".
   * Contact person data is included in the data structure.
   * Validation is done in the save function.
   * 
   * We pass hasPendingChanges flag so parent knows if there are actual unsaved changes.
   */
  React.useEffect(() => {
    if (!onDataChange || !organizationId) return;

    const saveFunctionWithValidation = async () => {
      const { errors, fieldErrors: nextFieldErrors } = validateAll();
      setFieldErrors(nextFieldErrors);
      if (errors.length > 0) {
        toast.error("Please fix the errors below", {
          description: errors.slice(0, 3).join("; "),
        });
        const err = new Error(errors.join(", ")) as Error & { isValidationError?: boolean };
        err.isValidationError = true;
        throw err;
      }

      setFieldErrors({});
      await saveAllPendingChanges();
      
      // Return contact person data to be saved to application
      // The data will be saved to company_details field
      return {
        contact_person: {
          name: contactPerson.name.trim(),
          position: contactPerson.position.trim(),
          ic: contactPerson.ic.trim(),
          contact: contactPerson.contact.trim(),
        },
      };
    };

    // Structure data to be saved to company_details field
    // Include both issuer_organization_id and contact_person
    // Pass hasPendingChanges flag so parent knows if there are actual unsaved changes
    onDataChange({
      issuer_organization_id: organizationId,
      contact_person: {
        name: contactPerson.name,
        position: contactPerson.position,
        ic: contactPerson.ic,
        contact: contactPerson.contact,
      },
      saveFunction: saveFunctionWithValidation,
      hasPendingChanges: hasPendingChanges,
    });
  }, [organizationId, onDataChange, saveAllPendingChanges, contactPerson, validateAll, hasPendingChanges]);

  /**
   * BUILD COMBINED LIST OF DIRECTORS AND SHAREHOLDERS
   * 
   * Logic:
   * 1. Show directors first
   * 2. If a director has ownership (not "—"), label them as "Director, Shareholder"
   * 3. Show shareholders who are NOT already shown as directors
   * 4. Show corporate shareholders with KYB status instead of KYC
   * 5. Deduplicate by normalized name
   */
  const directorsDisplay = entitiesData?.directorsDisplay ?? [];
  const shareholdersDisplay = entitiesData?.shareholdersDisplay ?? [];
  const corporateShareholders = entitiesData?.corporateShareholders ?? [];
  
  const combinedList = React.useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];

    // Process directors first
    directorsDisplay.forEach((d) => {
      const normalized = normalizeName(d.name);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        
        // If director has ownership (not "—"), they're also a shareholder
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

    // Process shareholders who are NOT directors
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

    // Process corporate shareholders
    corporateShareholders.forEach((corp: any) => {
      // Extract ownership percentage from formContent
      const shareField = corp.formContent?.displayAreas?.[0]?.content?.find(
        (f: any) => f.fieldName === "% of Shares"
      );
      const sharePercentage = shareField?.fieldValue ? Number(shareField.fieldValue) : null;
      const ownershipLabel = sharePercentage != null ? `${sharePercentage}% ownership` : "—";
      
      // Check KYB approval status
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

  /**
   * LOADING STATE
   * 
   * Show skeleton loaders while data is being fetched
   */
  if (isLoading) {
    return (
      <CompanyDetailsSkeleton />
    );
  }

  /**
   * NO ORGANIZATION SELECTED STATE
   */
  if (!organizationId) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Please select an organization to continue.
      </div>
    );
  }

  /**
   * EXTRACT DATA FROM HOOKS
   * 
   * Get all the data we need to display from the hooks
   */
  const basicInfo = corporateInfo?.basicInfo;
  const businessAddress = corporateInfo?.addresses?.business;
  const registeredAddress = corporateInfo?.addresses?.registered;
  const bankDetails: any = bankAccountDetails || null;
  const bankName = getBankField(bankDetails, "Bank");
  const accountNumber = getBankField(bankDetails, "Bank account number");

  /**
   * DISPLAY VALUES - show pending changes if they exist, otherwise show original data
   */
  const displayIndustry = pendingCompanyInfo?.industry !== undefined ? pendingCompanyInfo.industry : basicInfo?.industry;
  const displayNumberOfEmployees = pendingCompanyInfo?.numberOfEmployees !== undefined ? pendingCompanyInfo.numberOfEmployees : basicInfo?.numberOfEmployees;
  const displayBusinessAddress = pendingAddress?.businessAddress || businessAddress;
  const displayRegisteredAddress = pendingAddress?.registeredAddress || registeredAddress;
  const displayBankName = pendingBanking?.bankName !== undefined ? pendingBanking.bankName : bankName;
  const displayAccountNumber = pendingBanking?.bankAccountNumber !== undefined ? pendingBanking.bankAccountNumber : accountNumber;

  const handleSaveAddress = (businessAddress: any, registeredAddress: any) => {
    setPendingAddress({ businessAddress, registeredAddress });
    setIsEditAddressOpen(false);
  };

  /**
   * MAIN UI
   * 
   * Display all company information in read-only format
   */
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
          value={basicInfo?.businessName || "eg. Company Name"}
          disabled
          className={inputClassName}
        />

        <div className={labelClassName}>Type of entity</div>
        <Input
          value={basicInfo?.entityType || "eg. Private Limited Company"}
          disabled
          className={inputClassName}
        />

        <div className={labelClassName}>SSM no</div>
        <Input
          value={basicInfo?.ssmRegisterNumber || "eg. 1234567890"}
          disabled
          className={inputClassName}
        />

        <div className={labelClassNameEditable}>Industry</div>
        <Input
          value={displayIndustry ?? ""}
          onChange={(e) =>
            setPendingCompanyInfo((prev) => ({ ...prev, industry: e.target.value }))
          }
          placeholder="eg. Technology"
          className={inputClassNameEditable}
        />

        <div className={labelClassNameEditable}>Number of employees</div>
        <div>
          <Input
            value={displayNumberOfEmployees?.toString() ?? ""}
            onChange={(e) => {
              const v = restrictDigitsOnly(e.target.value);
              setPendingCompanyInfo((prev) => ({ ...prev, numberOfEmployees: v }));
            }}
            placeholder="eg. 10"
            className={inputClassNameEditable}
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
          value={formatAddress(displayBusinessAddress)}
          disabled
          className={inputClassName}
        />

        <div className={labelClassName}>Registered address</div>
        <Input
          value={formatAddress(displayRegisteredAddress)}
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
            <React.Fragment key={item.key}>
              <div className={labelClassName}>{item.roleLabel}</div>
              <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-3">
                <div className="text-[17px] leading-7 font-medium whitespace-nowrap">
                  {item.name}
                </div>
                <div className="h-4 w-px bg-border" />
                <div className="text-[17px] leading-7 text-muted-foreground whitespace-nowrap">
                  {item.ownership}
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
            value={displayBankName ?? ""}
            onValueChange={(value) =>
              setPendingBanking((prev) => ({ ...prev, bankName: value }))
            }
          >
            <SelectTrigger className={inputClassNameEditable}>
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
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.bankName}
            </p>
          )}
        </div>

        <div className={labelClassNameEditable}>Bank account number</div>
        <div>
          <Input
            value={displayAccountNumber ?? ""}
            onChange={(e) =>
              setPendingBanking((prev) => ({
                ...prev,
                bankAccountNumber: restrictDigitsOnly(e.target.value),
              }))
            }
            placeholder="Enter account number"
            className={inputClassNameEditable}
          />

          {fieldErrors.bankAccountNumber ? (
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.bankAccountNumber}
            </p>
          ) : (
            <p className="text-muted-foreground text-sm mt-1">
              {BANK_ACCOUNT_MIN_LENGTH}–{BANK_ACCOUNT_MAX_LENGTH} digits
            </p>
          )}
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
            value={contactPerson.name ?? ""}
            onChange={(e) =>
              setContactPerson((prev) => ({ ...prev, name: e.target.value }))
            }
            placeholder="eg. John Doe"
            className={inputClassNameEditable}
          />
          {fieldErrors.name && (
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div className={labelClassNameEditable}>Applicant position</div>
        <div>
          <Input
            value={contactPerson.position ?? ""}
            onChange={(e) =>
              setContactPerson((prev) => ({ ...prev, position: e.target.value }))
            }
            placeholder="eg. CEO"
            className={inputClassNameEditable}
          />
          {fieldErrors.position && (
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.position}
            </p>
          )}
        </div>

        <div className={labelClassNameEditable}>Applicant IC no</div>
        <div>
          <Input
            value={contactPerson.ic ?? ""}
            onChange={(e) =>
              setContactPerson((prev) => ({
                ...prev,
                ic: restrictIcNumber(e.target.value),
              }))
            }
            placeholder="eg. 1234567890"
            className={inputClassNameEditable}
          />
          {fieldErrors.ic && (
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.ic}
            </p>
          )}
        </div>

        <div className={labelClassNameEditable}>Applicant contact</div>
        <div>
          <PhoneInput
            international
            defaultCountry="MY"
            value={contactPerson.contact ?? undefined}
            onChange={(v) =>
              setContactPerson((prev) => ({ ...prev, contact: v ?? "" }))
            }
            className="h-11 rounded-xl border border-input px-4 [&>input]:border-0 [&>input]:bg-transparent [&>input]:outline-none [&>input]:text-[17px]"
          />
          {fieldErrors.contact && (
            <p className="text-destructive text-sm mt-1">
              {fieldErrors.contact}
            </p>
          )}
        </div>
      </div>
    </div>

    <EditAddressDialog
      open={isEditAddressOpen}
      onOpenChange={setIsEditAddressOpen}
      businessAddress={{
        line1: displayBusinessAddress?.line1 || "",
        line2: displayBusinessAddress?.line2 || "",
        city: displayBusinessAddress?.city || "",
        postalCode: displayBusinessAddress?.postalCode || "",
        state: displayBusinessAddress?.state || "",
        country: displayBusinessAddress?.country || "Malaysia",
      }}
      registeredAddress={{
        line1: displayRegisteredAddress?.line1 || "",
        line2: displayRegisteredAddress?.line2 || "",
        city: displayRegisteredAddress?.city || "",
        postalCode: displayRegisteredAddress?.postalCode || "",
        state: displayRegisteredAddress?.state || "",
        country: displayRegisteredAddress?.country || "Malaysia",
      }}
      onSave={handleSaveAddress}
    />
  </div>
);



}

/**
 * EDIT ADDRESS DIALOG
 * 
 * Modal to edit business and registered addresses.
 * Shows pending values if they exist, otherwise original values.
 */
function EditAddressDialog({
  open,
  onOpenChange,
  businessAddress: initialBusinessAddress,
  registeredAddress: initialRegisteredAddress,
  onSave,
}: any) {
  const [businessAddress, setBusinessAddress] = React.useState(initialBusinessAddress);
  const [registeredAddress, setRegisteredAddress] = React.useState(initialRegisteredAddress);
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
    setBusinessAddress((prev: any) => ({ ...prev, [field]: value }));
  };

  const updateRegisteredAddress = (field: string, value: string) => {
    setRegisteredAddress((prev: any) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-[700px] max-h-[90vh] overflow-y-auto px-3">
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
                <Label htmlFor="business-line1" className="text-sm font-medium">Address line 1</Label>
                <Input
                  id="business-line1"
                  value={businessAddress.line1}
                  onChange={(e) => updateBusinessAddress("line1", e.target.value)}
                  placeholder="Street Address"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-line2" className="text-sm font-medium">Address line 2</Label>
                <Input
                  id="business-line2"
                  value={businessAddress.line2}
                  onChange={(e) => updateBusinessAddress("line2", e.target.value)}
                  placeholder="Apartment, suite, etc. (optional)"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-city" className="text-sm font-medium">City</Label>
                  <Input
                    id="business-city"
                    value={businessAddress.city}
                    onChange={(e) => updateBusinessAddress("city", e.target.value)}
                    placeholder="Enter city"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-postal-code" className="text-sm font-medium">Postal code</Label>
                  <Input
                    id="business-postal-code"
                    value={businessAddress.postalCode}
                    onChange={(e) => updateBusinessAddress("postalCode", restrictDigitsOnly(e.target.value))}
                    placeholder="Enter postal code (numbers only)"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="business-state" className="text-sm font-medium">State</Label>
                  <Input
                    id="business-state"
                    value={businessAddress.state}
                    onChange={(e) => updateBusinessAddress("state", e.target.value)}
                    placeholder="Enter state"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="business-country" className="text-sm font-medium">Country</Label>
                  <Input
                    id="business-country"
                    value={businessAddress.country}
                    onChange={(e) => updateBusinessAddress("country", e.target.value)}
                    placeholder="Enter country"
                    className="h-11 rounded-xl"
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
                <Label htmlFor="registered-same-as-business" className="text-sm font-medium cursor-pointer">
                  Same as business address
                </Label>
              </div>
            </div>
            {!registeredAddressSameAsBusiness && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registered-line1" className="text-sm font-medium">Address line 1</Label>
                  <Input
                    id="registered-line1"
                    value={registeredAddress.line1}
                    onChange={(e) => updateRegisteredAddress("line1", e.target.value)}
                    placeholder="Street Address"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registered-line2" className="text-sm font-medium">Address line 2</Label>
                  <Input
                    id="registered-line2"
                    value={registeredAddress.line2}
                    onChange={(e) => updateRegisteredAddress("line2", e.target.value)}
                    placeholder="Apartment, suite, etc. (optional)"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-city" className="text-sm font-medium">City</Label>
                    <Input
                      id="registered-city"
                      value={registeredAddress.city}
                      onChange={(e) => updateRegisteredAddress("city", e.target.value)}
                      placeholder="Enter city"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-postal-code" className="text-sm font-medium">Postal code</Label>
                    <Input
                      id="registered-postal-code"
                      value={registeredAddress.postalCode}
                      onChange={(e) => updateRegisteredAddress("postalCode", restrictDigitsOnly(e.target.value))}
                      placeholder="Enter postal code (numbers only)"
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="registered-state" className="text-sm font-medium">State</Label>
                    <Input
                      id="registered-state"
                      value={registeredAddress.state}
                      onChange={(e) => updateRegisteredAddress("state", e.target.value)}
                      placeholder="Enter state"
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registered-country" className="text-sm font-medium">Country</Label>
                    <Input
                      id="registered-country"
                      value={registeredAddress.country}
                      onChange={(e) => updateRegisteredAddress("country", e.target.value)}
                      placeholder="Enter country"
                      className="h-11 rounded-xl"
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


function CompanyDetailsSkeleton() {
  return (
    <div className="mt-1 space-y-10">
      {/* ================= Company Info ================= */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 pl-3">
          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>

      {/* ================= Address ================= */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 pl-3">
          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>

      {/* ================= Directors & Shareholders ================= */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 pl-3">
          {[1, 2].map((i) => (
            <React.Fragment key={i}>
              <Skeleton className="h-[22px] w-40" />
              <Skeleton className="h-[22px] w-full" />
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ================= Banking ================= */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 pl-3">
          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>

      {/* ================= Contact Person ================= */}
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-6 pl-3">
          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />

          <Skeleton className="h-[22px] w-40" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </section>
    </div>
  );
}
