"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Tab locking for contract step (flaggedSections / flaggedItems)
 */

/**
 * CONTRACT DETAILS STEP
 *
 * Architecture:
 * - Owns all state locally (form, files, validation)
 * - Initializes ONCE when applicationId changes
 * - Never reinitializes on parent rerender
 * - Hydrates data from application hook on first load
 * - Saves via saveFunction returned to parent
 *
 * Pattern matches SupportingDocumentsStep and InvoiceDetailsStep.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/app/(application-flow)/applications/components/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useApplication } from "@/hooks/use-applications";
import { useContract, useCreateContract, useUpdateContract, useIssuerPaymasters, useIssuerPaymasterLookup } from "@/hooks/use-contracts";
import { ContractDetailsSkeleton } from "@/app/(application-flow)/applications/components/contract-details-skeleton";
import { toast } from "sonner";
import { useAuthToken, createApiClient } from "@cashsouk/config";
import { cn } from "@/lib/utils";
import {
  issuerFieldChromeClassName,
  issuerFieldFocusWithinOpenClassName,
} from "@/lib/issuer-input-chrome";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  applicationFlowLabelCellAlignInputClassName,
  applicationFlowLabelCellAlignTopClassName,
  applicationFlowRadioRowControlClassName,
  applicationFlowSectionDividerClassName,
  applicationFlowSectionStackClassName,
  applicationFlowSectionTitleClassName,
  applicationFlowStepOuterClassName,
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  formTextareaClassName,
  fieldLabelWithTooltipRowClassName,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { formatMoney, parseMoney } from "@cashsouk/ui";
import {
  isRequestedFacilityAtOrAboveContractValue,
  REQUESTED_FACILITY_BELOW_CONTRACT_COPY,
} from "@cashsouk/types";
import { MoneyInput } from "@cashsouk/ui";
import {
  applicationFlowDateToIso,
  isoToApplicationFlowDateDisplay,
  isApplicationFlowDateValid,
  parseApplicationFlowDate,
} from "@/app/(application-flow)/applications/utils/application-flow-dates";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import {
  FileUploadArea,
  type FileMetadata,
} from "@/app/(application-flow)/applications/components/file-upload-area";
import { getCountries, type Country } from "react-phone-number-input";
import phoneLabelsEn from "react-phone-number-input/locale/en.json";
import phoneFlags from "react-phone-number-input/flags";
import type { PaymasterLookupMatch, PaymasterLookupStatus } from "@cashsouk/types";
import {
  customerIdentityLocked,
  customerStepValid,
  isRelatedPartyAnswered,
  relatedPartyFieldsVisible,
  registrationLockedAfterLookup,
  showCustomerMasterFields,
  showRegistrationGate,
} from "@/app/(application-flow)/applications/steps/customer-paymaster-flow";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * Same ISO country set as default `PhoneInput` / libphonenumber-js `min` metadata.
 */
const PHONE_SUPPORTED_COUNTRIES = getCountries()
  .map((code) => {
    const name = phoneLabelsEn[code as keyof typeof phoneLabelsEn];
    if (typeof name !== "string") return null;
    return { code, name };
  })
  .filter((c): c is NonNullable<typeof c> => c !== null)
  .sort((a, b) => a.name.localeCompare(b.name));

/** Mock data for dev Auto Fill. financing <= value; dates d/M/yyyy; SSM 12 digits. */
export function generateMockData(): Record<string, unknown> {
  const value = 5000000.5;
  const financing = 1000000.25;
  return {
    contract: {
      title: "Mining Rig Repair 12654",
      description: "Repair and maintenance for 12 mining rigs",
      number: "20212345678",
      value: formatMoney(value),
      start_date: "01/01/2025",
      end_date: "31/12/2025",
      financing: formatMoney(Math.min(financing, value)),
      document: null,
    },
    customer: {
      name: "Petronas Chemical Bhd",
      entity_type: "Private Limited Company (Sdn Bhd)",
      ssm_number: "202201234567",
      country: "MY",
      is_related_party: "no",
    },
  };
}

type YesNo = "yes" | "no";

const ENTITY_TYPES = [
  "Sole Proprietor",
  "Partnership",
  "Private Limited Company (Sdn Bhd)",
  "Public Limited Company (Bhd)",
  "Federal Government",
  "State Government",
  "Federal Government Agency",
  "State Government Agency",
  "Unlisted Public Company",
];

/* ================================================================
   VALIDATION HELPERS
   ================================================================ */

function isStartBeforeEnd(start?: string, end?: string) {
  if (!start || !end) return true;

  const parsedStart = parseApplicationFlowDate(start);
  const parsedEnd = parseApplicationFlowDate(end);

  if (!parsedStart || !parsedEnd) {
    return true; // format validation handled elsewhere
  }

  return parsedStart.getTime() < parsedEnd.getTime();
}

function isEndDateTooSoon(startDate?: string, endDate?: string, minMonths?: number) {
  if (!endDate) return false;
  if (!minMonths || minMonths <= 0) return false;

  const parsedEnd = parseApplicationFlowDate(endDate);
  if (!parsedEnd) return false;

  const today = new Date();
  let baseDate = today;

  if (startDate) {
    const parsedStart = parseApplicationFlowDate(startDate);
    if (parsedStart && parsedStart > today) {
      baseDate = parsedStart;
    }
  }

  const minAllowedEndDate = new Date(baseDate);
  minAllowedEndDate.setMonth(minAllowedEndDate.getMonth() + minMonths);

  return parsedEnd < minAllowedEndDate;
}

function formatApplicationFlowDateDisplay(d: Date): string {
  // DateInput expects `d/M/yyyy` format. Keep it simple and stable for dev auto-fill.
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Read product-level min_contract_months from product workflow (if present). */
function getProductMinContractMonths(workflow: unknown[] | null | undefined): number | null {
  if (!workflow?.length) return null;
  try {
    const contractStep = workflow.find((step) => {
      if (typeof step !== "object" || step === null) return false;
      const s = step as { id?: string; name?: string; config?: Record<string, unknown> };
      return (
        s.id?.includes?.("contract_details") === true ||
        s.name?.toLowerCase?.()?.includes?.("contract") === true
      );
    }) as { config?: Record<string, unknown> } | undefined;

    const config = contractStep?.config || {};
    const val = config.min_contract_months ?? config.minContractMonths;

    if (typeof val === "number") return val;
    if (typeof val === "string" && /^\d+$/.test(val)) return parseInt(val, 10);

    return null;
  } catch {
    return null;
  }
}

/* ================================================================
   CUSTOM RADIO BUTTON
   ================================================================ */

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
    <label
      className={cn("flex items-center gap-2", disabled ? "cursor-not-allowed" : "cursor-pointer")}
    >
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
            <span className="absolute inset-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
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
  disabled,
}: {
  value: YesNo | "";
  onValueChange: (value: YesNo) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-6 items-center">
      <CustomRadio
        name="related"
        value="yes"
        checked={value === "yes"}
        onChange={() => !disabled && onValueChange("yes")}
        label="Yes"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
        disabled={disabled}
      />
      <CustomRadio
        name="related"
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

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

interface ContractDetailsStepProps {
  applicationId: string;
  workflow: Record<string, unknown>[];
  onDataChange?: (data: Record<string, unknown>) => void;
  isAmendmentMode?: boolean;
  flaggedSections?: Set<string>;
  flaggedItems?: Map<string, Set<string>>;
  remarks?: { scope?: string; scope_key?: string; remark?: string }[];
  readOnly?: boolean;
  /** When true, show only Customer Details; hide Contract Details. Save customer_details only. */
  isInvoiceOnly?: boolean;
}

export function ContractDetailsStep({
  applicationId,
  workflow,
  onDataChange,
  isAmendmentMode,
  flaggedSections,
  flaggedItems,
  readOnly = false,
  isInvoiceOnly = false,
}: ContractDetailsStepProps) {
  const { getAccessToken } = useAuthToken();
  const { data: application } = useApplication(applicationId);
  const issuerOrganizationId =
    (application as { issuer_organization_id?: string } | undefined)?.issuer_organization_id || "";
  const { data: existingPaymasters = [] } = useIssuerPaymasters(issuerOrganizationId);
  const lookupPaymaster = useIssuerPaymasterLookup();
  const devTools = useDevTools();

  // DEBUG: Toggle skeleton mode

  const contractId = (application as unknown as { contract?: { id?: string } })?.contract?.id;
  const { data: contract, isLoading: isLoadingContract } = useContract(contractId || "");
  const createContractMutation = useCreateContract();
  const updateContractMutation = useUpdateContract();

  /* ================================================================
     LOCAL STATE (owned entirely by this component)
     ================================================================ */

  const [formData, setFormData] = React.useState({
    contract: {
      title: "",
      description: "",
      number: "",
      value: "",
      start_date: "",
      end_date: "",
      financing: "",
      document: null as FileMetadata | null,
    },
    customer: {
      name: "",
      entity_type: "",
      ssm_number: "",
      country: "MY",
      is_related_party: "" as YesNo | "",
    },
  });
  const [customerMode, setCustomerMode] = React.useState<"existing" | "new">("new");
  const [selectedPaymasterId, setSelectedPaymasterId] = React.useState<string>("");
  const [lookupStatus, setLookupStatus] = React.useState<PaymasterLookupStatus | "idle">("idle");
  const [lookupMatch, setLookupMatch] = React.useState<PaymasterLookupMatch | null>(null);
  const [lookupError, setLookupError] = React.useState<string | null>(null);

  /** Note: Date inputs are free-text. Parents handle validation on save. */

  const [pendingFiles, setPendingFiles] = React.useState<{
    contract?: File;
  }>({});

  const [isUploading, setIsUploading] = React.useState<Record<string, boolean>>({});

  const [lastS3Keys, setLastS3Keys] = React.useState<{
    contract?: string;
  }>({});

  const [hasSubmitted, setHasSubmitted] = React.useState(false);
  const [financingError, setFinancingError] = React.useState<string | null>(null);
  // --------------------------------------------------
  // Product-level contract rule (computed once)
  // --------------------------------------------------
  const productMinMonths = React.useMemo(
    () => getProductMinContractMonths(workflow || []),
    [workflow]
  );

  /* Clear financing error when user changes the value */
  React.useEffect(() => {
    setFinancingError(null);
  }, [formData.contract.financing]);

  /** Apply dev-tools Auto Fill when requested (single step or Fill Entire Application). */
  React.useEffect(() => {
    const data =
      devTools?.autoFillData?.stepKey === "contract_details"
        ? (devTools.autoFillData.data as {
            contract?: Record<string, unknown>;
            customer?: Record<string, unknown>;
          })
        : (devTools?.autoFillDataMap?.["contract_details"] as
            | { contract?: Record<string, unknown>; customer?: Record<string, unknown> }
            | undefined);
    if (!data || (!data.contract && !data.customer)) return;

    // If dev auto-fill provided contract dates, enforce product min months rule.
    // This prevents “end date too soon” validation errors after filling.
    let adjustedContract: Record<string, unknown> | undefined = data.contract;
    if (
      adjustedContract &&
      productMinMonths != null &&
      typeof adjustedContract.start_date === "string" &&
      typeof adjustedContract.end_date === "string"
    ) {
      const parsedStart = parseApplicationFlowDate(adjustedContract.start_date);
      const parsedEnd = parseApplicationFlowDate(adjustedContract.end_date);
      if (parsedStart && parsedEnd) {
        const today = new Date();
        const baseDate = parsedStart > today ? parsedStart : today;
        const minAllowed = new Date(baseDate);
        minAllowed.setMonth(minAllowed.getMonth() + productMinMonths);
        if (parsedEnd < minAllowed) {
          adjustedContract = {
            ...adjustedContract,
            end_date: formatApplicationFlowDateDisplay(minAllowed),
          };
        }
      }
    }

    setFormData((prev) => ({
      contract: adjustedContract ? { ...prev.contract, ...adjustedContract } : prev.contract,
      customer: data.customer ? { ...prev.customer, ...data.customer } : prev.customer,
    }));
    setCustomerMode("new");
    setSelectedPaymasterId("");
    setLookupStatus("NOT_FOUND");
    setLookupMatch(null);
    setLookupError(null);
    if (devTools) {
      if (devTools.autoFillData?.stepKey === "contract_details") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("contract_details");
    }
  }, [devTools, productMinMonths]);

  /* ================================================================
     INITIALIZATION (run only once per applicationId)
     ================================================================ */

  const isInitializedRef = React.useRef(false);
  const initialSnapshotRef = React.useRef<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    // Only initialize once per applicationId
    if (isInitializedRef.current) return;
    if (!application) return;
    if (isLoadingContract) return;
    // Note: contract can be undefined/null if it doesn't exist yet - we'll create it on save
    // So we don't wait for contract loading here

    const rawContract = contract as unknown as {
      contract_details?: Record<string, unknown> | null;
      customer_details?: Record<string, unknown> | null;
    } | null;
    const contractDetails = (rawContract?.contract_details ?? {}) as Record<string, unknown>;
    const customerDetails = (rawContract?.customer_details ?? {}) as Record<string, unknown>;

    const relatedPartyValue: YesNo | "" =
      customerDetails.is_related_party === true || customerDetails.is_related_party === "yes"
        ? "yes"
        : customerDetails.is_related_party === false || customerDetails.is_related_party === "no"
          ? "no"
          : "";

    const initialData = {
      contract: {
        title: (contractDetails.title as string) || "",
        description: (contractDetails.description as string) || "",
        number: (contractDetails.number as string) || "",
        value:
          contractDetails.value != null
            ? formatMoney(contractDetails.value as string | number)
            : "",
        start_date: (contractDetails.start_date as string) || "",
        end_date: (contractDetails.end_date as string) || "",
        financing:
          (contractDetails.financing != null
            ? formatMoney(contractDetails.financing as string | number)
            : "") ||
          (contractDetails.contract_financing != null
            ? formatMoney(contractDetails.contract_financing as string | number)
            : "") ||
          "",
        document: (contractDetails.document as FileMetadata | null) || null,
      },
      customer: {
        name: (customerDetails.name as string) || "",
        entity_type: (customerDetails.entity_type as string) || "",
        ssm_number: (customerDetails.ssm_number as string) || "",
        country: (customerDetails.country as string) || "MY",
        is_related_party: relatedPartyValue,
      },
    };

    const linkedPaymasterId =
      typeof customerDetails.paymaster_id === "string" ? customerDetails.paymaster_id : "";
    if (linkedPaymasterId) {
      setSelectedPaymasterId(linkedPaymasterId);
      const linkedVerified = existingPaymasters.some((row) => row.id === linkedPaymasterId);
      setCustomerMode(linkedVerified ? "existing" : "new");
      setLookupStatus("idle");
      setLookupMatch(null);
    } else if (
      /^\d{12}$/.test(String(customerDetails.ssm_number ?? "")) &&
      customerDetails.name
    ) {
      setCustomerMode("new");
      setLookupStatus("NOT_FOUND");
    }

    const displayedInitialData = {
      ...initialData,
      contract: {
        ...initialData.contract,
        start_date: isoToApplicationFlowDateDisplay(initialData.contract.start_date),
        end_date: isoToApplicationFlowDateDisplay(initialData.contract.end_date),
      },
    };

    setFormData(displayedInitialData);

    // Track an immutable snapshot of the initially hydrated/displayed values for change detection
    initialSnapshotRef.current = displayedInitialData;

    // Track S3 keys for versioning
    const contractDoc = contractDetails.document as FileMetadata | undefined;
    if (contractDoc?.s3_key) {
      setLastS3Keys((prev) => ({ ...prev, contract: contractDoc.s3_key }));
    }

    isInitializedRef.current = true;
  }, [application, contract, isLoadingContract]);

  /* ================================================================
     SAVE FUNCTION
     ================================================================ */

  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    const validationErrors: string[] = [];
    setFinancingError(null);

    if (!isInvoiceOnly) {
      if (productMinMonths == null) {
        toast.error("System configuration error. Please contact CashSouk support.");
        throw new Error("VALIDATION_PRODUCT_CONFIG_MISSING_MIN_CONTRACT_MONTHS");
      }
      if (!formData.contract.start_date)
        validationErrors.push("VALIDATION_CONTRACT_START_DATE_REQUIRED");
      if (!formData.contract.end_date)
        validationErrors.push("VALIDATION_CONTRACT_END_DATE_REQUIRED");
      if (formData.contract.start_date && !isApplicationFlowDateValid(formData.contract.start_date))
        validationErrors.push("VALIDATION_CONTRACT_INVALID_START_DATE");
      if (formData.contract.end_date && !isApplicationFlowDateValid(formData.contract.end_date))
        validationErrors.push("VALIDATION_CONTRACT_INVALID_END_DATE");
      if (!isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date))
        validationErrors.push("VALIDATION_CONTRACT_DATE_ORDER");
      if (
        isEndDateTooSoon(formData.contract.start_date, formData.contract.end_date, productMinMonths)
      ) {
        validationErrors.push("VALIDATION_CONTRACT_DURATION_TOO_SHORT");
      }
      const contractValueNum = parseMoney(formData.contract.value);
      const financingAmountNum = parseMoney(formData.contract.financing);
      if (financingAmountNum <= 0) {
        setFinancingError("Financing amount must be greater than 0");
        validationErrors.push("VALIDATION_CONTRACT_FINANCING_REQUIRED");
      } else if (isRequestedFacilityAtOrAboveContractValue(financingAmountNum, contractValueNum)) {
        setFinancingError(REQUESTED_FACILITY_BELOW_CONTRACT_COPY);
        validationErrors.push("VALIDATION_CONTRACT_FINANCING_EXCEEDS_VALUE");
      }
    }

    if (!/^\d{12}$/.test(formData.customer.ssm_number))
      validationErrors.push("VALIDATION_CONTRACT_SSM_FORMAT");
    if (!isRelatedPartyAnswered(formData.customer.is_related_party))
      validationErrors.push("VALIDATION_CONTRACT_RELATED_PARTY_REQUIRED");
    if (
      !customerStepValid({
        customerMode,
        selectedPaymasterId,
        lookupStatus,
        facilityPaymasterLocked: Boolean(
          typeof (contract as { customer_details?: { paymaster_id?: string | null } } | undefined)
            ?.customer_details?.paymaster_id === "string" &&
            (contract as { customer_details?: { paymaster_id?: string } }).customer_details?.paymaster_id
        ),
        name: formData.customer.name,
        entityType: formData.customer.entity_type,
        ssmNumber: formData.customer.ssm_number,
        country: formData.customer.country,
        relatedParty: formData.customer.is_related_party,
      })
    ) {
      validationErrors.push("VALIDATION_CONTRACT_CUSTOMER_INCOMPLETE");
    }

    if (validationErrors.length > 0) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_CONTRACT_FAILED");
    }
    let effectiveContractId = contractId;
    if (!effectiveContractId) {
      try {
        const created = await createContractMutation.mutateAsync(applicationId);
        effectiveContractId = created?.id as string;
        if (!effectiveContractId) {
          toast.error("Something went wrong. Please try again.");
          throw new Error("CONTRACT_CREATION_NO_ID");
        }
      } catch (err) {
        toast.error("Something went wrong. Please try again.");
        throw err;
      }
    }

    const token = await getAccessToken();
    const apiClient = createApiClient(API_URL, () => Promise.resolve(token));
    const updatedFormData = { ...formData };

    /** Upload contract file only when not invoice_only. */
    if (!isInvoiceOnly && pendingFiles.contract) {
      try {
        setIsUploading((prev) => ({ ...prev, contract: true }));

        const existingS3Key = formData.contract.document?.s3_key || lastS3Keys.contract;
        const response = await apiClient.requestContractUploadUrl(effectiveContractId, {
          fileName: pendingFiles.contract.name,
          contentType: pendingFiles.contract.type,
          fileSize: pendingFiles.contract.size,
          type: "contract",
          existingS3Key: existingS3Key,
        });

        if (!response.success) {
          throw new Error(response.error.message);
        }

        const { uploadUrl, s3Key } = response.data;
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: pendingFiles.contract,
          headers: { "Content-Type": pendingFiles.contract.type },
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload contract document");
        }

        if (existingS3Key && existingS3Key !== s3Key) {
          try {
            await apiClient.deleteContractDocument(effectiveContractId, existingS3Key);
          } catch {
            // Non-fatal: continue with new contract
          }
        }

        updatedFormData.contract.document = {
          s3_key: s3Key,
          file_name: pendingFiles.contract.name,
          file_size: pendingFiles.contract.size,
          uploaded_at: new Date().toISOString(),
        };
        setLastS3Keys((prev) => ({ ...prev, contract: s3Key }));
      } finally {
        setIsUploading((prev) => ({ ...prev, contract: false }));
      }
    }

    const updatedCustomerDetails = {
      name: updatedFormData.customer.name,
      entity_type: updatedFormData.customer.entity_type,
      ssm_number: updatedFormData.customer.ssm_number,
      country: updatedFormData.customer.country,
      is_related_party: updatedFormData.customer.is_related_party === "yes",
    };
    const paymasterSelection =
      selectedPaymasterId &&
      (customerMode === "existing" || lookupStatus === "FOUND_VERIFIED")
        ? selectedPaymasterId
        : null;

    if (isInvoiceOnly) {
      const existingContractDetails = (
        contract as unknown as { contract_details?: Record<string, unknown> }
      )?.contract_details;
      const updatePayload: {
        customer_details: typeof updatedCustomerDetails;
        selectedPaymasterId?: string | null;
        contract_details?: null;
      } = {
        customer_details: updatedCustomerDetails,
        selectedPaymasterId: paymasterSelection,
      };
      if (existingContractDetails != null && Object.keys(existingContractDetails).length > 0) {
        updatePayload.contract_details = null;
      }
      await updateContractMutation.mutateAsync({
        id: effectiveContractId,
        data: updatePayload,
      });
      setPendingFiles({});
      return { contract_details: undefined, customer_details: updatedCustomerDetails };
    }

    const valueNum = parseMoney(updatedFormData.contract.value);
    const contractFinancingNum = parseMoney(updatedFormData.contract.financing);
    const structureType = (application as { financing_structure?: { structure_type?: string } })
      ?.financing_structure?.structure_type;
    const existingCd = (contract as unknown as { contract_details?: Record<string, unknown> })
      ?.contract_details;
    /** New contract: approved, utilized, available = null. Existing contract: use stored values from backend. */
    const approvedFacilityValue =
      structureType === "existing_contract" && typeof existingCd?.approved_facility === "number"
        ? existingCd.approved_facility
        : null;
    const utilizedFacilityValue =
      structureType === "existing_contract" && typeof existingCd?.utilized_facility === "number"
        ? existingCd.utilized_facility
        : null;
    const availableFacilityValue =
      structureType === "existing_contract" && typeof existingCd?.available_facility === "number"
        ? existingCd.available_facility
        : null;

    const updatedContractDetails = {
      ...updatedFormData.contract,
      value: valueNum,
      financing: contractFinancingNum,
      start_date:
        applicationFlowDateToIso(updatedFormData.contract.start_date) ??
        updatedFormData.contract.start_date,
      end_date:
        applicationFlowDateToIso(updatedFormData.contract.end_date) ??
        updatedFormData.contract.end_date,
      approved_facility: approvedFacilityValue,
      utilized_facility: utilizedFacilityValue,
      available_facility: availableFacilityValue,
      document: updatedFormData.contract.document || undefined,
    };

    await updateContractMutation.mutateAsync({
      id: effectiveContractId,
      data: {
        contract_details: updatedContractDetails,
        customer_details: updatedCustomerDetails,
        selectedPaymasterId: paymasterSelection,
      },
    });

    setPendingFiles({});
    return {
      contract_details: updatedContractDetails,
      customer_details: updatedCustomerDetails,
    };
  }, [
    formData,
    pendingFiles,
    contractId,
    applicationId,
    lastS3Keys,
    getAccessToken,
    createContractMutation,
    updateContractMutation,
    isInvoiceOnly,
    contract,
    application,
    productMinMonths,
    customerMode,
    selectedPaymasterId,
    lookupStatus,
  ]);

  /* ================================================================
     NOTIFY PARENT
     ================================================================ */

  /** Stable refs to avoid unnecessary effect re-runs in parent components.
   *
   * What: Keeps a stable reference to parent's onDataChange callback.
   * Why: Prevents parent effects from retriggering when function identity changes.
   * Data: onDataChange?: (data: Record<string, unknown>) => void
   */
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /** Keep a stable ref to the save function so parent can call it without
   *  being affected by changing function identity on every render.
   *
   * What: Ref to the internal save function that performs validation and uploads.
   * Why: Parent extracts `saveFunction` and invokes it prior to persisting step data.
   * Data: () => Promise<{ contract_details: ..., customer_details: ... }>
   */
  const saveFunctionRef = React.useRef<typeof saveFunction | null>(null);
  React.useEffect(() => {
    saveFunctionRef.current = saveFunction;
  }, [saveFunction]);

  React.useEffect(() => {
    if (!onDataChangeRef.current) return;

    // Determine whether form values differ from the initially hydrated snapshot.
    const hasFormChanged = () => {
      const initial = initialSnapshotRef.current;
      if (!initial) return false;

      const ic = initial.contract || {};
      const cc = formData.contract || {};
      const iu = initial.customer || {};
      const cu = formData.customer || {};

      type NestedDoc = { document?: { s3_key?: string; file_name?: string } };

      const simpleContractFields: (keyof typeof cc)[] = [
        "title",
        "description",
        "number",
        "value",
        "financing",
        "start_date",
        "end_date",
      ];
      for (const f of simpleContractFields) {
        const a = (ic as Record<string, unknown>)[f as string] ?? "";
        const b = (cc as Record<string, unknown>)[f as string] ?? "";
        if (String(a) !== String(b)) return true;
      }

      const icDoc = (ic as NestedDoc).document;
      const ccDoc = (cc as NestedDoc).document;
      const initialContractDocKey = icDoc?.s3_key || icDoc?.file_name || "";
      const currentContractDocKey = ccDoc?.s3_key || ccDoc?.file_name || "";
      if (initialContractDocKey !== currentContractDocKey) return true;
      if (pendingFiles.contract) return true;

      const simpleCustomerFields: (keyof typeof cu)[] = [
        "name",
        "entity_type",
        "ssm_number",
        "country",
        "is_related_party",
      ];
      for (const f of simpleCustomerFields) {
        const a = (iu as Record<string, unknown>)[f as string] ?? "";
        const b = (cu as Record<string, unknown>)[f as string] ?? "";
        if (String(a) !== String(b)) return true;
      }

      return false;
    };

    const hasFormChanges = hasFormChanged();
    const hasContractDocument = !!formData.contract.document || !!pendingFiles.contract;
    const hasValidStartDate =
      !!formData.contract.start_date && isApplicationFlowDateValid(formData.contract.start_date);
    const hasValidEndDate =
      !!formData.contract.end_date && isApplicationFlowDateValid(formData.contract.end_date);

    const requestedFacility = parseMoney(formData.contract.financing);
    const contractFace = parseMoney(formData.contract.value);
    const financingWithinLimit =
      requestedFacility > 0 &&
      !isRequestedFacilityAtOrAboveContractValue(requestedFacility, contractFace);

    const isValidCustomer = customerStepValid({
      customerMode,
      selectedPaymasterId,
      lookupStatus,
      facilityPaymasterLocked: Boolean(
        typeof (contract as { customer_details?: { paymaster_id?: string | null } } | undefined)
          ?.customer_details?.paymaster_id === "string" &&
          (contract as { customer_details?: { paymaster_id?: string } }).customer_details?.paymaster_id
      ),
      name: formData.customer.name,
      entityType: formData.customer.entity_type,
      ssmNumber: formData.customer.ssm_number,
      country: formData.customer.country,
      relatedParty: formData.customer.is_related_party,
    });

    const isValid = isInvoiceOnly
      ? isValidCustomer
      : !!formData.contract.title &&
        !!formData.contract.description &&
        !!formData.contract.number &&
        !!formData.contract.value &&
        !!formData.contract.financing &&
        financingWithinLimit &&
        hasValidStartDate &&
        hasValidEndDate &&
        hasContractDocument &&
        isValidCustomer;

    /** Send a stable payload to parent.
     *
     * What: Emit current form state, validity, pending-change flag and a stable saveFunction.
     * Why: Parent relies on these fields to enable Save/Continue and to call the save function.
     * Data: { contract_details, customer_details, isValid, hasPendingChanges, saveFunction }
     */
    onDataChangeRef.current({
      contract_details: formData.contract,
      customer_details: formData.customer,
      isValid,
      hasPendingChanges: hasFormChanges,
      saveFunction: saveFunctionRef.current || undefined,
      _saveFunctionRef: saveFunctionRef, // internal fallback for debugging/tests
    });
  }, [formData, pendingFiles, isInvoiceOnly, customerMode, selectedPaymasterId, lookupStatus, contract]);
  // Determine whether the step is editable (amendment mode + flagged, or explicit readOnly override)
  const stepIsEditable = React.useMemo(() => {
    if (readOnly) return false;
    if (!isAmendmentMode) return true;
    return (
      flaggedSections?.has("contract_details") ||
      (flaggedItems?.get("contract_details")?.size ?? 0) > 0
    );
  }, [readOnly, isAmendmentMode, flaggedSections, flaggedItems]);

  const linkedFacilityPaymasterId = React.useMemo(() => {
    const details = (contract as { customer_details?: { paymaster_id?: string | null } } | undefined)
      ?.customer_details;
    return typeof details?.paymaster_id === "string" && details.paymaster_id
      ? details.paymaster_id
      : "";
  }, [contract]);
  const paymasterIdentityLocked = Boolean(linkedFacilityPaymasterId);
  const masterFieldsDisabled = customerIdentityLocked({
    stepEditable: stepIsEditable,
    facilityPaymasterLocked: paymasterIdentityLocked,
    customerMode,
    selectedPaymasterId,
    lookupStatus,
  });
  const ssmLocked = !stepIsEditable || registrationLockedAfterLookup({
    facilityPaymasterLocked: paymasterIdentityLocked,
    customerMode,
    lookupStatus,
    selectedPaymasterId,
  });
  const showMasterFields = showCustomerMasterFields({
    facilityPaymasterLocked: paymasterIdentityLocked,
    customerMode,
    selectedPaymasterId,
    lookupStatus,
  });
  const showSsmGate = showRegistrationGate({
    facilityPaymasterLocked: paymasterIdentityLocked,
    customerMode,
  });
  const showRelatedParty = relatedPartyFieldsVisible({
    facilityPaymasterLocked: paymasterIdentityLocked,
    customerMode,
    selectedPaymasterId,
    lookupStatus,
  });
  const showVerifiedMatchCard =
    customerMode === "new" &&
    lookupStatus === "FOUND_VERIFIED" &&
    !selectedPaymasterId &&
    Boolean(lookupMatch);
  const countryLabel = (code: string) =>
    PHONE_SUPPORTED_COUNTRIES.find((c) => c.code === code)?.name ?? code;

  const applyPaymasterIdentity = (option: {
    id: string;
    legalName: string;
    entityType: string;
    registrationNumber: string;
    registrationCountry: string;
    isRelatedParty?: boolean | null;
  }) => {
    setSelectedPaymasterId(option.id);
    setFormData((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        name: option.legalName,
        entity_type: option.entityType,
        ssm_number: option.registrationNumber,
        country: option.registrationCountry || prev.customer.country,
        is_related_party:
          option.isRelatedParty == null
            ? prev.customer.is_related_party
            : option.isRelatedParty
              ? "yes"
              : "no",
      },
    }));
  };

  const applyExistingPaymaster = (paymasterId: string) => {
    const option = existingPaymasters.find((entry) => entry.id === paymasterId);
    if (!option) return;
    setLookupStatus("idle");
    setLookupMatch(null);
    applyPaymasterIdentity(option);
  };

  const resetRegistrationLookup = () => {
    if (!stepIsEditable || paymasterIdentityLocked) return;
    setLookupStatus("idle");
    setLookupMatch(null);
    setLookupError(null);
    setSelectedPaymasterId("");
    setFormData((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        name: "",
        entity_type: "",
      },
    }));
  };

  const runRegistrationLookup = async () => {
    if (!stepIsEditable || paymasterIdentityLocked) return;
    const ssm = formData.customer.ssm_number;
    if (!/^\d{12}$/.test(ssm)) {
      setHasSubmitted(true);
      setLookupError("SSM number must be 12 digits");
      return;
    }
    if (!issuerOrganizationId) {
      setLookupError("Organisation is required to check this registration number.");
      return;
    }
    setLookupError(null);
    try {
      const result = await lookupPaymaster.mutateAsync({
        organizationId: issuerOrganizationId,
        registrationNumber: ssm,
      });
      setLookupStatus(result.status);
      setLookupMatch(result.paymaster);
      setSelectedPaymasterId("");
      if (result.status === "FOUND_UNVERIFIED" && result.paymaster) {
        setFormData((prev) => ({
          ...prev,
          customer: {
            ...prev.customer,
            name: result.paymaster!.legalName,
            entity_type: result.paymaster!.entityType,
            ssm_number: result.paymaster!.registrationNumber,
            country: result.paymaster!.registrationCountry || prev.customer.country,
          },
        }));
      }
      if (result.status === "FOUND_VERIFIED") {
        setFormData((prev) => ({
          ...prev,
          customer: {
            ...prev.customer,
            name: "",
            entity_type: "",
          },
        }));
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Could not check this registration number.");
    }
  };

  /* ================================================================
     HANDLERS
     ================================================================ */

  const handleInputChange = (section: "contract" | "customer", field: string, value: unknown) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = (type: "contract", file: File) => {
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
  };

  const isStartInvalid =
    hasSubmitted &&
    (!formData.contract.start_date || !isApplicationFlowDateValid(formData.contract.start_date));

  const isEndInvalid =
    hasSubmitted &&
    (!formData.contract.end_date ||
      !isApplicationFlowDateValid(formData.contract.end_date) ||
      !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) ||
      (productMinMonths != null &&
        isEndDateTooSoon(
          formData.contract.start_date,
          formData.contract.end_date,
          productMinMonths
        )));

  /* ================================================================
     RENDER
     ================================================================ */

  if (!isInitializedRef.current || devTools?.showSkeletonDebug) {
    return <ContractDetailsSkeleton />;
  }

  const liveRequestedFacility = parseMoney(formData.contract.financing);
  const liveContractFace = parseMoney(formData.contract.value);
  const liveFinancingError =
    !isInvoiceOnly &&
    liveRequestedFacility > 0 &&
    liveContractFace > 0 &&
    isRequestedFacilityAtOrAboveContractValue(liveRequestedFacility, liveContractFace)
      ? REQUESTED_FACILITY_BELOW_CONTRACT_COPY
      : financingError;

  const labelClassName = cn(formLabelClassName, "font-normal");
  const labelInputClassName = cn(labelClassName, applicationFlowLabelCellAlignInputClassName);
  const labelTextareaClassName = cn(labelClassName, applicationFlowLabelCellAlignTopClassName);
  const inputClassName = cn(formInputClassName, !stepIsEditable && formInputDisabledClassName);
  const sectionGridClassName =
    "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-start";

  const customerCountryCode = formData.customer.country as Country;
  const customerCountryName =
    PHONE_SUPPORTED_COUNTRIES.find((c) => c.code === customerCountryCode)?.name ??
    (typeof phoneLabelsEn[customerCountryCode as keyof typeof phoneLabelsEn] === "string"
      ? (phoneLabelsEn[customerCountryCode as keyof typeof phoneLabelsEn] as string)
      : customerCountryCode);
  const CustomerCountryFlag = phoneFlags[customerCountryCode];

  return (
    <>
      <div className={applicationFlowStepOuterClassName}>
        {/* Contract Details Section — hidden when invoice_only */}
        {!isInvoiceOnly && (
          <section className={applicationFlowSectionStackClassName}>
            <div>
              <h3 className={applicationFlowSectionTitleClassName}>Contract Details</h3>
              <div className={applicationFlowSectionDividerClassName} />
            </div>

            <div className={sectionGridClassName}>
              <Label className={labelInputClassName}>Contract Title</Label>
              <Input
                value={formData.contract.title}
                onChange={(e) => handleInputChange("contract", "title", e.target.value)}
                disabled={!stepIsEditable}
                placeholder="eg. Mining Rig Repair 12654"
                className={inputClassName}
              />

              <Label className={labelTextareaClassName}>Contract Description</Label>
              <Textarea
                value={formData.contract.description}
                onChange={(e) => handleInputChange("contract", "description", e.target.value)}
                disabled={!stepIsEditable}
                placeholder="eg. Repair and maintenance for 12 mining rigs"
                className={cn(
                  formTextareaClassName,
                  "min-h-[100px]",
                  !stepIsEditable && formInputDisabledClassName
                )}
              />

              <Label className={labelInputClassName}>Contract Number</Label>
              <Input
                value={formData.contract.number}
                onChange={(e) => handleInputChange("contract", "number", e.target.value)}
                disabled={!stepIsEditable}
                placeholder="eg. 20212345678"
                className={inputClassName}
              />

              <Label className={labelInputClassName}>Contract Value</Label>
              <div className="h-11 flex items-center">
                <MoneyInput
                  value={formData.contract.value}
                  onValueChange={(value) => handleInputChange("contract", "value", value)}
                  disabled={!stepIsEditable}
                  placeholder={`eg. ${formatMoney(5000000)}`}
                  prefix="RM"
                  inputClassName={inputClassName}
                />
              </div>

              <div className={fieldLabelWithTooltipRowClassName}>
                <Label className={labelClassName}>Financing Amount</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={fieldTooltipTriggerClassName}>
                      <InformationCircleIcon className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={2}
                    className={fieldTooltipContentClassName}
                  >
                    This refers to how much financing you would like to apply. Requested financing
                    must be less than the contract value.
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="space-y-1">
                <div className="h-11 flex items-center">
                  <MoneyInput
                    value={formData.contract.financing}
                    onValueChange={(value) => handleInputChange("contract", "financing", value)}
                    disabled={!stepIsEditable}
                    placeholder={`eg. ${formatMoney(1000000)}`}
                    prefix="RM"
                    inputClassName={`${inputClassName} ${liveFinancingError ? "border-destructive focus-visible:border-destructive" : ""}`}
                  />
                </div>
                {liveFinancingError && <p className="text-xs text-destructive">{liveFinancingError}</p>}
              </div>

              <Label className={labelInputClassName}>Contract Start Date</Label>
              <div className="space-y-1">
                <DateInput
                  value={formData.contract.start_date || ""}
                  onChange={(v) => handleInputChange("contract", "start_date", v)}
                  disabled={!stepIsEditable}
                  isInvalid={isStartInvalid}
                  className={inputClassName}
                />
                {hasSubmitted && !formData.contract.start_date && (
                  <p className="text-xs text-destructive">Start date is required</p>
                )}
                {hasSubmitted &&
                  formData.contract.start_date &&
                  !isApplicationFlowDateValid(formData.contract.start_date) && (
                    <p className="text-xs text-destructive">Invalid date</p>
                  )}
              </div>

              <div className={fieldLabelWithTooltipRowClassName}>
                <Label className={labelClassName}>Contract End Date</Label>
                {formData.contract.start_date && productMinMonths && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={fieldTooltipTriggerClassName}>
                        <InformationCircleIcon className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      sideOffset={2}
                      className={fieldTooltipContentClassName}
                    >
                      {`The contract must run for at least ${productMinMonths} months from the later of today or the contract start date.`}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="space-y-1">
                <DateInput
                  value={formData.contract.end_date || ""}
                  onChange={(v) => handleInputChange("contract", "end_date", v)}
                  disabled={!stepIsEditable}
                  isInvalid={isEndInvalid}
                  className={inputClassName}
                />

                {hasSubmitted && !formData.contract.end_date && (
                  <p className="text-xs text-destructive">End date is required</p>
                )}

                {hasSubmitted &&
                  formData.contract.end_date &&
                  !isApplicationFlowDateValid(formData.contract.end_date) && (
                    <p className="text-xs text-destructive">Invalid date</p>
                  )}

                {hasSubmitted &&
                  isApplicationFlowDateValid(formData.contract.end_date) &&
                  !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) && (
                    <p className="text-xs text-destructive">End date must be after start date</p>
                  )}

                {hasSubmitted &&
                  isApplicationFlowDateValid(formData.contract.end_date) &&
                  isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) &&
                  isEndDateTooSoon(
                    formData.contract.start_date,
                    formData.contract.end_date,
                    productMinMonths ?? undefined
                  ) && (
                    <p className="text-xs text-destructive">
                      {productMinMonths != null
                        ? `Contract must run at least ${productMinMonths} months from the later of today or the start date. Extend the end date, or in Financing structure choose Invoice-only if you are financing without a long-term contract.`
                        : "Contract end date is before the minimum period allowed for this product. Extend the end date, or in Financing structure choose Invoice-only if you are financing without a long-term contract."}
                    </p>
                  )}
              </div>

              <Label className={labelTextareaClassName}>Upload Contract</Label>
              <div className="self-start">
                <FileUploadArea
                  onFileSelect={(file) => handleFileUpload("contract", file)}
                  isUploading={isUploading.contract}
                  uploadedFile={formData.contract.document}
                  pendingFile={pendingFiles.contract}
                  onRemove={
                    stepIsEditable
                      ? () => {
                          handleInputChange("contract", "document", null);
                          setPendingFiles((prev) => ({ ...prev, contract: undefined }));
                        }
                      : undefined
                  }
                  disabled={!stepIsEditable}
                />
              </div>
            </div>
          </section>
        )}

        {/* Customer Details Section */}
        <section className={applicationFlowSectionStackClassName}>
          <div>
            <h3 className={applicationFlowSectionTitleClassName}>
              Customer / Paymaster
            </h3>
            <div className={applicationFlowSectionDividerClassName} />
          </div>

          <div className={sectionGridClassName}>
            {!paymasterIdentityLocked ? (
              <>
                <Label className={labelInputClassName}>Customer / Paymaster</Label>
                <div className={applicationFlowRadioRowControlClassName}>
                  <div className="space-y-3">
                    <p className="text-ui text-muted-foreground">
                      How would you like to add the customer?
                    </p>
                    <div className="flex flex-wrap gap-6 items-center">
                      <CustomRadio
                        name="customer-mode"
                        value="existing"
                        checked={customerMode === "existing"}
                        onChange={() => {
                          if (!stepIsEditable) return;
                          setCustomerMode("existing");
                          setLookupStatus("idle");
                          setLookupMatch(null);
                          setLookupError(null);
                        }}
                        label="Select Existing Paymaster"
                        selectedLabelClass="text-ui font-medium"
                        unselectedLabelClass="text-ui"
                        disabled={!stepIsEditable || existingPaymasters.length === 0}
                      />
                      <CustomRadio
                        name="customer-mode"
                        value="new"
                        checked={customerMode === "new"}
                        onChange={() => {
                          if (!stepIsEditable) return;
                          setCustomerMode("new");
                          setSelectedPaymasterId("");
                          setLookupStatus("idle");
                          setLookupMatch(null);
                          setLookupError(null);
                        }}
                        label="Add New Paymaster"
                        selectedLabelClass="text-ui font-medium"
                        unselectedLabelClass="text-ui"
                        disabled={!stepIsEditable}
                      />
                    </div>
                  </div>
                </div>
                {customerMode === "existing" ? (
                  <>
                    <Label className={labelInputClassName}>Existing Paymaster</Label>
                    <Select
                      value={selectedPaymasterId}
                      onValueChange={(value) => applyExistingPaymaster(value)}
                      disabled={!stepIsEditable}
                    >
                      <SelectTrigger
                        className={cn(
                          formSelectTriggerClassName,
                          !stepIsEditable && formInputDisabledClassName
                        )}
                      >
                        <SelectValue placeholder="Select a verified Paymaster previously used by this issuer" />
                      </SelectTrigger>
                      <SelectContent>
                        {existingPaymasters.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.legalName} · {option.registrationNumber}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : null}
              </>
            ) : (
              <>
                <Label className={labelInputClassName}>Customer / Paymaster</Label>
                <p className="text-ui text-muted-foreground">
                  This facility already has a linked customer. Legal identity cannot be changed.
                </p>
              </>
            )}

            {showSsmGate ? (
              <>
                <Label className={labelInputClassName}>SSM / Registration Number</Label>
                <div className="space-y-2 min-h-[48px]">
                  <Input
                    value={formData.customer.ssm_number}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (raw === "") {
                        handleInputChange("customer", "ssm_number", "");
                        return;
                      }
                      if (!/^\d{0,12}$/.test(raw)) return;
                      handleInputChange("customer", "ssm_number", raw);
                    }}
                    disabled={ssmLocked}
                    placeholder="e.g. 202123456789"
                    className={inputClassName}
                  />
                  <p className="text-meta text-muted-foreground">12 digits</p>
                  {hasSubmitted && !/^\d{12}$/.test(formData.customer.ssm_number) && (
                    <p className="text-meta text-destructive">SSM number must be 12 digits</p>
                  )}
                  {lookupError ? <p className="text-meta text-destructive">{lookupError}</p> : null}
                  {lookupStatus === "idle" ? (
                    <Button
                      type="button"
                      className="h-10 rounded-xl text-ui"
                      disabled={!stepIsEditable || lookupPaymaster.isPending}
                      onClick={() => void runRegistrationLookup()}
                    >
                      {lookupPaymaster.isPending ? "Checking..." : "Check"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl text-ui"
                      disabled={!stepIsEditable}
                      onClick={resetRegistrationLookup}
                    >
                      Change Registration Number
                    </Button>
                  )}
                </div>
              </>
            ) : null}

            {showVerifiedMatchCard && lookupMatch ? (
              <>
                <Label className={labelInputClassName}>Existing Paymaster Found</Label>
                <div className="space-y-3 rounded-xl border border-border p-4">
                  <div className="space-y-1">
                    <p className="text-ui font-medium">{lookupMatch.legalName}</p>
                    <p className="text-meta text-muted-foreground">
                      Registration: {lookupMatch.registrationNumber}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      Country: {countryLabel(lookupMatch.registrationCountry)}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      Entity Type: {lookupMatch.entityType}
                    </p>
                  </div>
                  <Button
                    type="button"
                    className="h-10 rounded-xl text-ui"
                    disabled={!stepIsEditable}
                    onClick={() =>
                      applyPaymasterIdentity({
                        id: lookupMatch.id,
                        legalName: lookupMatch.legalName,
                        entityType: lookupMatch.entityType,
                        registrationNumber: lookupMatch.registrationNumber,
                        registrationCountry: lookupMatch.registrationCountry,
                        isRelatedParty: null,
                      })
                    }
                  >
                    Use This Paymaster
                  </Button>
                </div>
              </>
            ) : null}

            {customerMode === "new" && lookupStatus === "FOUND_UNVERIFIED" ? (
              <>
                <Label className={labelInputClassName}>Verification</Label>
                <p className="text-ui text-muted-foreground">
                  This customer is already registered and is pending verification.
                </p>
              </>
            ) : null}

            {customerMode === "new" && lookupStatus === "NOT_FOUND" ? (
              <>
                <Label className={labelInputClassName}>New customer</Label>
                <p className="text-ui text-muted-foreground">
                  No verified Paymaster found. Please enter the customer details below.
                </p>
              </>
            ) : null}

            {showMasterFields ? (
              <>
                <Label className={labelInputClassName}>Customer Name</Label>
                <Input
                  value={formData.customer.name}
                  onChange={(e) => handleInputChange("customer", "name", e.target.value)}
                  disabled={masterFieldsDisabled}
                  placeholder="eg. Petronas Chemical Bhd"
                  className={inputClassName}
                />

                <Label className={labelInputClassName}>Customer Entity Type</Label>
                <Select
                  value={formData.customer.entity_type}
                  onValueChange={(value) => handleInputChange("customer", "entity_type", value)}
                  disabled={masterFieldsDisabled}
                >
                  <SelectTrigger
                    className={cn(
                      formSelectTriggerClassName,
                      masterFieldsDisabled && formInputDisabledClassName
                    )}
                  >
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.customer.entity_type &&
                    !ENTITY_TYPES.includes(formData.customer.entity_type) ? (
                      <SelectItem value={formData.customer.entity_type}>
                        {formData.customer.entity_type}
                      </SelectItem>
                    ) : null}
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!showSsmGate ? (
                  <>
                    <Label className={labelInputClassName}>SSM / Registration Number</Label>
                    <div className="space-y-1 min-h-[48px]">
                      <Input
                        value={formData.customer.ssm_number}
                        disabled
                        className={inputClassName}
                      />
                      <p className="text-meta text-muted-foreground">12 digits</p>
                    </div>
                  </>
                ) : null}

                <Label htmlFor="contract-customer-country" className={labelInputClassName}>
                  Customer Country
                </Label>
                <div
                  className={cn(
                    "flex h-11 w-full items-center gap-2 px-3",
                    issuerFieldChromeClassName,
                    issuerFieldFocusWithinOpenClassName,
                    (!stepIsEditable || masterFieldsDisabled) && formInputDisabledClassName
                  )}
                >
                  <span
                    className="inline-flex h-5 w-7 shrink-0 items-center justify-center overflow-hidden bg-muted/30 [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
                    aria-hidden
                  >
                    {CustomerCountryFlag ? <CustomerCountryFlag title={customerCountryName} /> : null}
                  </span>
                  <select
                    id="contract-customer-country"
                    value={formData.customer.country}
                    onChange={(e) => handleInputChange("customer", "country", e.target.value)}
                    disabled={masterFieldsDisabled}
                    className={cn(
                      "min-h-0 min-w-0 flex-1 border-0 bg-transparent py-2 text-sm text-foreground outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0",
                      masterFieldsDisabled ? "cursor-not-allowed" : "cursor-pointer"
                    )}
                  >
                    {PHONE_SUPPORTED_COUNTRIES.map(({ code, name }) => (
                      <option key={code} value={code}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {showRelatedParty ? (
              <>
                <div className={fieldLabelWithTooltipRowClassName}>
                  <Label className={labelClassName}>Is the Customer Related to You?</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={fieldTooltipTriggerClassName}>
                        <InformationCircleIcon className="h-4 w-4" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={2} className={fieldTooltipContentClassName}>
                      {`A related party is a customer that has a direct or indirect relationship with your company that may affect independent, arm's length transactions.

This includes:
• Common ownership
• Common directors / management
• Control relationship
• Significant influence
• Family relationship
• Economic dependence`}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className={applicationFlowRadioRowControlClassName}>
                  <YesNoRadioGroup
                    value={formData.customer.is_related_party}
                    onValueChange={(v) => handleInputChange("customer", "is_related_party", v)}
                    disabled={!stepIsEditable}
                  />
                  {hasSubmitted && !isRelatedPartyAnswered(formData.customer.is_related_party) ? (
                    <p className="text-meta text-destructive">Please select Yes or No.</p>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
