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
import { DateInput } from "@/app/(application-flow)/applications/components/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudUpload, X, CheckCircle2 } from "lucide-react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { useApplication } from "@/hooks/use-applications";
import { useContract, useCreateContract, useUpdateContract } from "@/hooks/use-contracts";
import { ContractDetailsSkeleton } from "@/app/(application-flow)/applications/components/contract-details-skeleton";
import { toast } from "sonner";
import { useAuthToken, createApiClient } from "@cashsouk/config";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  formInputClassName,
  formInputDisabledClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  formTextareaClassName,
  fieldTooltipContentClassName,
  fieldTooltipTriggerClassName,
  fieldTooltipLabelGap,
} from "@/app/(application-flow)/applications/components/form-control";
import { formatMoney, parseMoney } from "../components/money";
import { MoneyInput } from "@/app/(application-flow)/applications/components/money-input";
import { format, parse, isValid, parseISO } from "date-fns";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
      document: null,
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

const COUNTRIES = [
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
];


/* ================================================================
   VALIDATION HELPERS
   ================================================================ */

function isStartBeforeEnd(start?: string, end?: string) {
  if (!start || !end) return true;

  const parsedStart = parse(start, "d/M/yyyy", new Date());
  const parsedEnd = parse(end, "d/M/yyyy", new Date());

  if (!isValid(parsedStart) || !isValid(parsedEnd)) {
    return true; // format validation handled elsewhere
  }

  return parsedStart.getTime() < parsedEnd.getTime();
}

function isEndDateTooSoon(
  startDate?: string,
  endDate?: string,
  minMonths?: number
) {
  if (!endDate) return false;
  if (!minMonths || minMonths <= 0) return false;

  const parsedEnd = parse(endDate, "d/M/yyyy", new Date());
  if (!isValid(parsedEnd)) return false;

  const today = new Date();
  let baseDate = today;

  if (startDate) {
    const parsedStart = parse(startDate, "d/M/yyyy", new Date());
    if (isValid(parsedStart) && parsedStart > today) {
      baseDate = parsedStart;
    }
  }

  const minAllowedEndDate = new Date(baseDate);
  minAllowedEndDate.setMonth(minAllowedEndDate.getMonth() + minMonths);

  return parsedEnd < minAllowedEndDate;
}

/** Read product-level min_contract_months from product workflow (if present). */
function getProductMinContractMonths(workflow: any[]): number | null {
  try {
    const contractStep = workflow.find(
      (step: any) =>
        step.id?.includes?.("contract_details") ||
        step.name?.toLowerCase?.()?.includes?.("contract")
    );

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
const radioUnselectedLabel = formLabelClassName.replace(
  "text-foreground",
  "text-muted-foreground"
);

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
      <span className={checked ? selectedLabelClass : unselectedLabelClass}>
        {label}
      </span>
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

/**
 * FILE UPLOAD AREA
 * ================================================================ */

interface FileMetadata {
  s3_key: string;
  file_name: string;
  file_size?: number;
  uploaded_at?: string;
}

interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFile?: FileMetadata | null;
  pendingFile?: File;
  onRemove?: () => void;
  disabled?: boolean;
}

function FileUploadArea({
  onFileSelect,
  isUploading,
  uploadedFile,
  pendingFile,
  onRemove,
  disabled,
}: FileUploadAreaProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled || uploadedFile || pendingFile || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast.error("Please select a PDF file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File is too large (max 5MB)");
        return;
      }
      onFileSelect(file);
    }
  };

  // Show uploaded or pending file
  if (uploadedFile || pendingFile) {
    const fileName = pendingFile?.name || uploadedFile?.file_name || "";
    const fileSize = pendingFile?.size || uploadedFile?.file_size || 0;
    const isPending = !!pendingFile;
    const statusText = isPending ? (isUploading ? " (Uploading…)" : " (Pending…)") : "";

    return (
      <div className="border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3 bg-card/50">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={cn(
              "p-1 rounded-full shrink-0",
              isPending ? "bg-yellow-500/10" : "bg-primary/10"
            )}
          >
            <CheckCircle2
              className={cn(
                "h-4 w-4",
                isPending ? "text-yellow-500" : "text-primary"
              )}
            />
          </div>
          <div className="min-w-0 flex-1" title={fileName}>
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-muted-foreground">
              {(fileSize / 1024 / 1024).toFixed(2)} MB
              {statusText}
            </div>
          </div>
        </div>
        {!disabled && onRemove ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      onClick={disabled ? undefined : handleClick}
      className={cn(
        "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-3 transition-colors",
        disabled
          ? "border-muted-foreground/20 bg-muted cursor-not-allowed"
          : "border-border bg-card/50 cursor-pointer hover:bg-muted/50"
      )}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={disabled}
      />
      <div className="p-2 rounded-full bg-background border shadow-sm">
        <CloudUpload className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        {disabled ? (
          <span className="text-sm text-muted-foreground">Locked</span>
        ) : (
          <>
            <span className="text-base font-semibold text-primary">
              {isUploading ? "Uploading..." : "Click to upload"}
            </span>
            {!isUploading && (
              <span className="text-base text-muted-foreground"> or drag and drop</span>
            )}
          </>
        )}
      </div>
      {!disabled && <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>}
    </div>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */

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
  remarks: _remarks,
  readOnly = false,
  isInvoiceOnly = false,
}: ContractDetailsStepProps) {
  const { getAccessToken } = useAuthToken();
  const { data: application } = useApplication(applicationId);
  const devTools = useDevTools();

  // DEBUG: Toggle skeleton mode

  const contractId = ((application as unknown) as { contract?: { id?: string } })?.contract?.id;
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
      document: null as FileMetadata | null,
    },
  });

  /** Note: Date inputs are free-text. Parents handle validation on save. */

  const [pendingFiles, setPendingFiles] = React.useState<{
    contract?: File;
    consent?: File;
  }>({});

  const [isUploading, setIsUploading] = React.useState<Record<string, boolean>>({});

  const [lastS3Keys, setLastS3Keys] = React.useState<{
    contract?: string;
    consent?: string;
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
        ? (devTools.autoFillData.data as { contract?: Record<string, unknown>; customer?: Record<string, unknown> })
        : devTools?.autoFillDataMap?.["contract_details"] as
            | { contract?: Record<string, unknown>; customer?: Record<string, unknown> }
            | undefined;
    if (!data || (!data.contract && !data.customer)) return;
    setFormData((prev) => ({
      contract: data.contract ? { ...prev.contract, ...data.contract } : prev.contract,
      customer: data.customer ? { ...prev.customer, ...data.customer } : prev.customer,
    }));
    if (devTools) {
      if (devTools.autoFillData?.stepKey === "contract_details") devTools.clearAutoFill();
      else devTools.clearAutoFillForStep("contract_details");
    }
  }, [devTools]);

  /* ================================================================
     INITIALIZATION (run only once per applicationId)
     ================================================================ */

  const isInitializedRef = React.useRef(false);
  const initialSnapshotRef = React.useRef<Record<string, any> | null>(null);

  React.useEffect(() => {
    // Only initialize once per applicationId
    if (isInitializedRef.current) return;
    if (!application) return;
    if (isLoadingContract) return;
    // Note: contract can be undefined/null if it doesn't exist yet - we'll create it on save
    // So we don't wait for contract loading here

    const rawContract = (contract as unknown) as { contract_details?: Record<string, unknown> | null; customer_details?: Record<string, unknown> | null } | null;
    const contractDetails = (rawContract?.contract_details ?? {}) as Record<string, unknown>;
    const customerDetails = (rawContract?.customer_details ?? {}) as Record<string, unknown>;

    const relatedPartyValue: YesNo | "" =
      customerDetails.is_related_party === undefined ||
        customerDetails.is_related_party === null
        ? ""
        : customerDetails.is_related_party
          ? ("yes" as const)
          : ("no" as const);

    const initialData = {
      contract: {
        title: (contractDetails.title as string) || "",
        description: (contractDetails.description as string) || "",
        number: (contractDetails.number as string) || "",
        value: contractDetails.value != null ? formatMoney(contractDetails.value as string | number) : "",
        start_date: (contractDetails.start_date as string) || "",
        end_date: (contractDetails.end_date as string) || "",
        financing:
          (contractDetails.financing != null ? formatMoney(contractDetails.financing as string | number) : "") ||
          (contractDetails.contract_financing != null ? formatMoney(contractDetails.contract_financing as string | number) : "") ||
          "",
        document: (contractDetails.document as FileMetadata | null) || null,
      },
      customer: {
        name: (customerDetails.name as string) || "",
        entity_type: (customerDetails.entity_type as string) || "",
        ssm_number: (customerDetails.ssm_number as string) || "",
        country: (customerDetails.country as string) || "MY",
        is_related_party: relatedPartyValue,
        document: (customerDetails.document as FileMetadata | null) || null,
      },
    };

  // Format display dates into d/M/yyyy if ISO present so displayed values match parent expectations.
  const formatDisplayDate = (raw?: string) => {
    if (!raw) return "";
    try {
      const p = parseISO(raw);
      if (isValid(p)) return format(p, "d/M/yyyy");
    } catch {
      // fallthrough
    }
    // Fallback: try parsing as d/M/yyyy and return as-is if valid; otherwise keep raw
    try {
      const p2 = parse(raw, "d/M/yyyy", new Date());
      if (isValid(p2)) return format(p2, "d/M/yyyy");
    } catch {
      // ignore
    }
    return raw;
  };

  const displayedInitialData = {
    ...initialData,
    contract: {
      ...initialData.contract,
      start_date: formatDisplayDate(initialData.contract.start_date),
      end_date: formatDisplayDate(initialData.contract.end_date),
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
    const customerDoc = customerDetails.document as FileMetadata | undefined;
    if (customerDoc?.s3_key) {
      setLastS3Keys((prev) => ({ ...prev, consent: customerDoc.s3_key }));
    }

    isInitializedRef.current = true;
  }, [application, contract, isLoadingContract]);

  /* ================================================================
     SAVE FUNCTION
     ================================================================ */

  /** Parse flexible date strings: ISO (yyyy-MM-dd) or d/M/yyyy */
  const parseFlexibleDate = (dateStr?: string): Date | null => {
    if (!dateStr) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const d = parseISO(dateStr);
      return isValid(d) ? d : null;
    }
    const d = parse(dateStr, "d/M/yyyy", new Date());
    return isValid(d) ? d : null;
  };

  const isValidCalendarDate = (dateStr?: string) => !!parseFlexibleDate(dateStr);

  const saveFunction = React.useCallback(async () => {
    setHasSubmitted(true);
    const validationErrors: string[] = [];
    setFinancingError(null);

    if (!isInvoiceOnly) {
      if (productMinMonths == null) {
        toast.error("System configuration error. Please contact administrator.");
        throw new Error("VALIDATION_PRODUCT_CONFIG_MISSING_MIN_CONTRACT_MONTHS");
      }
      if (!formData.contract.start_date)
        validationErrors.push("VALIDATION_CONTRACT_START_DATE_REQUIRED");
      if (!formData.contract.end_date)
        validationErrors.push("VALIDATION_CONTRACT_END_DATE_REQUIRED");
      if (formData.contract.start_date && !isValidCalendarDate(formData.contract.start_date))
        validationErrors.push("VALIDATION_CONTRACT_INVALID_START_DATE");
      if (formData.contract.end_date && !isValidCalendarDate(formData.contract.end_date))
        validationErrors.push("VALIDATION_CONTRACT_INVALID_END_DATE");
      if (!isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date))
        validationErrors.push("VALIDATION_CONTRACT_DATE_ORDER");
      if (
        isEndDateTooSoon(
          formData.contract.start_date,
          formData.contract.end_date,
          productMinMonths
        )
      ) {
        validationErrors.push("VALIDATION_CONTRACT_DURATION_TOO_SHORT");
      }
      const contractValueNum = parseMoney(formData.contract.value);
      const financingAmountNum = parseMoney(formData.contract.financing);
      if (financingAmountNum <= 0) {
        setFinancingError("Financing amount must be greater than 0");
        validationErrors.push("VALIDATION_CONTRACT_FINANCING_REQUIRED");
      } else if (financingAmountNum > contractValueNum) {
        setFinancingError(`Financing cannot exceed ${formatMoney(contractValueNum)}`);
        validationErrors.push("VALIDATION_CONTRACT_FINANCING_EXCEEDS_VALUE");
      }
    }

    if (!/^\d{12}$/.test(formData.customer.ssm_number)) validationErrors.push("VALIDATION_CONTRACT_SSM_FORMAT");

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

    // Upload consent file if pending
    if (pendingFiles.consent) {
      try {
        setIsUploading((prev) => ({ ...prev, consent: true }));

        const existingS3Key = formData.customer.document?.s3_key || lastS3Keys.consent;
        const response = await apiClient.requestContractUploadUrl(effectiveContractId, {
          fileName: pendingFiles.consent.name,
          contentType: pendingFiles.consent.type,
          fileSize: pendingFiles.consent.size,
          type: "consent",
          existingS3Key: existingS3Key,
        });

        if (!response.success) {
          throw new Error(response.error.message);
        }

        const { uploadUrl, s3Key } = response.data;
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: pendingFiles.consent,
          headers: { "Content-Type": pendingFiles.consent.type },
        });

        if (!uploadRes.ok) {
          throw new Error("Failed to upload consent document");
        }

        if (existingS3Key && existingS3Key !== s3Key) {
          try {
            await apiClient.deleteContractDocument(effectiveContractId, existingS3Key);
          } catch {
            // Non-fatal: continue with new contract
          }
        }

        updatedFormData.customer.document = {
          s3_key: s3Key,
          file_name: pendingFiles.consent.name,
          file_size: pendingFiles.consent.size,
          uploaded_at: new Date().toISOString(),
        };
        setLastS3Keys((prev) => ({ ...prev, consent: s3Key }));
      } finally {
        setIsUploading((prev) => ({ ...prev, consent: false }));
      }
    }

    const updatedCustomerDetails = {
      ...updatedFormData.customer,
      is_related_party: updatedFormData.customer.is_related_party === "yes",
      document: updatedFormData.customer.document || undefined,
    };

    if (isInvoiceOnly) {
      const existingContractDetails = (contract as unknown as { contract_details?: Record<string, unknown> })?.contract_details;
      const updatePayload: { customer_details: typeof updatedCustomerDetails; contract_details?: null } = {
        customer_details: updatedCustomerDetails,
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
    const existingCd = (contract as unknown as { contract_details?: Record<string, unknown> })?.contract_details;
    const approvedFacilityNum = typeof existingCd?.approved_facility === "number" ? existingCd.approved_facility : 0;
    const utilizedFacilityNum = typeof existingCd?.utilized_facility === "number" ? existingCd.utilized_facility : 0;
    const availableFacilityNum = typeof existingCd?.available_facility === "number" ? existingCd.available_facility : 0;

    const updatedContractDetails = {
      ...updatedFormData.contract,
      value: valueNum,
      financing: contractFinancingNum,
      start_date: (() => {
        const pd = parseFlexibleDate(updatedFormData.contract.start_date);
        return pd ? format(pd, "yyyy-MM-dd") : updatedFormData.contract.start_date;
      })(),
      end_date: (() => {
        const pd = parseFlexibleDate(updatedFormData.contract.end_date);
        return pd ? format(pd, "yyyy-MM-dd") : updatedFormData.contract.end_date;
      })(),
      approved_facility: approvedFacilityNum,
      utilized_facility: utilizedFacilityNum,
      available_facility: availableFacilityNum,
      document: updatedFormData.contract.document || undefined,
    };

    await updateContractMutation.mutateAsync({
      id: effectiveContractId,
      data: {
        contract_details: updatedContractDetails,
        customer_details: updatedCustomerDetails,
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
        const a = (ic as any)[f] ?? "";
        const b = (cc as any)[f] ?? "";
        if (String(a) !== String(b)) return true;
      }

      const initialContractDocKey = ic.document?.s3_key || ic.document?.file_name || "";
      const currentContractDocKey = cc.document?.s3_key || cc.document?.file_name || "";
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
        const a = (iu as any)[f] ?? "";
        const b = (cu as any)[f] ?? "";
        if (String(a) !== String(b)) return true;
      }

      const initialConsentDocKey = iu.document?.s3_key || iu.document?.file_name || "";
      const currentConsentDocKey = cu.document?.s3_key || cu.document?.file_name || "";
      if (initialConsentDocKey !== currentConsentDocKey) return true;
      if (pendingFiles.consent) return true;

      return false;
    };

    const hasFormChanges = hasFormChanged();
    const hasContractDocument = !!formData.contract.document || !!pendingFiles.contract;
    const hasConsentDocument = !!formData.customer.document || !!pendingFiles.consent;
    const hasValidStartDate = !!formData.contract.start_date && isValidCalendarDate(formData.contract.start_date);
    const hasValidEndDate = !!formData.contract.end_date && isValidCalendarDate(formData.contract.end_date);

    const isValid = isInvoiceOnly
      ? !!formData.customer.name &&
        !!formData.customer.entity_type &&
        !!formData.customer.ssm_number &&
        !!formData.customer.country &&
        hasConsentDocument
      : !!formData.contract.title &&
        !!formData.contract.description &&
        !!formData.contract.number &&
        !!formData.contract.value &&
        !!formData.contract.financing &&
        hasValidStartDate &&
        hasValidEndDate &&
        hasContractDocument &&
        !!formData.customer.name &&
        !!formData.customer.entity_type &&
        !!formData.customer.ssm_number &&
        !!formData.customer.country &&
        hasConsentDocument;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, pendingFiles, isInvoiceOnly]);
  // Determine whether the step is editable (amendment mode + flagged, or explicit readOnly override)
  const stepIsEditable = React.useMemo(() => {
    if (readOnly) return false;
    if (!isAmendmentMode) return true;
    return flaggedSections?.has("contract_details") || (flaggedItems?.get("contract_details")?.size ?? 0) > 0;
  }, [readOnly, isAmendmentMode, flaggedSections, flaggedItems]);

  /* ================================================================
     HANDLERS
     ================================================================ */

  const handleInputChange = (
    section: "contract" | "customer",
    field: string,
    value: unknown
  ) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = (type: "contract" | "consent", file: File) => {
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
  };

  const isStartInvalid =
    hasSubmitted &&
    (
      !formData.contract.start_date ||
      !isValidCalendarDate(formData.contract.start_date)
    );

  const isEndInvalid =
    hasSubmitted &&
    (
      !formData.contract.end_date ||
      !isValidCalendarDate(formData.contract.end_date) ||
      !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) ||
      (productMinMonths != null &&
        isEndDateTooSoon(formData.contract.start_date, formData.contract.end_date, productMinMonths))
    );


  /* ================================================================
     RENDER
     ================================================================ */

  if (!isInitializedRef.current || devTools?.showSkeletonDebug) {
    return <ContractDetailsSkeleton />;
  }

  const stepIsFlagged = isAmendmentMode && (flaggedSections?.has("contract_details") || (flaggedItems?.get("contract_details")?.size ?? 0) > 0);

  const labelClassName = cn(formLabelClassName, "font-normal");
  const inputClassName = cn(formInputClassName, !stepIsEditable && formInputDisabledClassName);
  const sectionHeaderClassName = "text-base font-semibold text-foreground";
  const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3 items-center";

  return (
    <>
      <div className="space-y-10 px-3">
        {/* Contract Details Section — hidden when invoice_only */}
        {!isInvoiceOnly && (
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClassName}>Contract Details</h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>

          <div className={sectionGridClassName}>
            <Label className={labelClassName}>Contract Title</Label>
            <Input
              value={formData.contract.title}
              onChange={(e) => handleInputChange("contract", "title", e.target.value)}
              disabled={!stepIsEditable}
              placeholder="eg. Mining Rig Repair 12654"
              className={cn(inputClassName, stepIsFlagged ? "border-destructive focus-visible:border-2 focus-visible:border-destructive" : "")}
            />

            <Label className={labelClassName}>Contract Description</Label>
            <Textarea
              value={formData.contract.description}
              onChange={(e) =>
                handleInputChange("contract", "description", e.target.value)
              }
              disabled={!stepIsEditable}
              placeholder="eg. Repair and maintenance for 12 mining rigs"
              className={cn(formTextareaClassName, "min-h-[100px]", !stepIsEditable && formInputDisabledClassName)}
            />

            <Label className={labelClassName}>Contract Number</Label>
            <Input
              value={formData.contract.number}
              onChange={(e) => handleInputChange("contract", "number", e.target.value)}
              disabled={!stepIsEditable}
              placeholder="eg. 20212345678"
              className={inputClassName}
            />

            <Label className={labelClassName}>Contract Value</Label>
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

            <Label className={labelClassName}>Contract Financing</Label>
            <div className="space-y-1">
              <div className="h-11 flex items-center">
                <MoneyInput
                  value={formData.contract.financing}
                onValueChange={(value) => handleInputChange("contract", "financing", value)}
                disabled={!stepIsEditable}
                  placeholder={`eg. ${formatMoney(1000000)}`}
                  prefix="RM"
                  inputClassName={`${inputClassName} ${financingError ? "border-destructive focus-visible:border-2 focus-visible:border-destructive" : ""}`}
                />
              </div>
              {financingError && (
                <p className="text-xs text-destructive">
                  {financingError}
                </p>
              )}
            </div>

            <Label className={labelClassName}>Contract Start Date</Label>
            <div className="space-y-1">
              <DateInput
                value={formData.contract.start_date || ""}
                onChange={(v) => handleInputChange("contract", "start_date", v)}
                disabled={!stepIsEditable}
                isInvalid={isStartInvalid}
                className={inputClassName}
              />
              {hasSubmitted && !formData.contract.start_date && (
                <p className="text-xs text-destructive">
                  Start date is required
                </p>
              )}
              {hasSubmitted && formData.contract.start_date && !isValidCalendarDate(formData.contract.start_date) && (
                <p className="text-xs text-destructive">
                  Invalid date
                </p>
              )}
            </div>



            <div className={cn("flex items-center", fieldTooltipLabelGap)}>
              <Label className={labelClassName}>Contract End Date</Label>
              {formData.contract.start_date && productMinMonths && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={fieldTooltipTriggerClassName}>
                      <InformationCircleIcon className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className={fieldTooltipContentClassName}>
                    {`The contract must run for at least ${productMinMonths} months from the later of today or the contract start date`}
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
                <p className="text-xs text-destructive">
                  End date is required
                </p>
              )}

              {hasSubmitted && formData.contract.end_date && !isValidCalendarDate(formData.contract.end_date) && (
                <p className="text-xs text-destructive">
                  Invalid date
                </p>
              )}

              {hasSubmitted && isValidCalendarDate(formData.contract.end_date) && !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) && (
                <p className="text-xs text-destructive">
                  End date must be after start date
                </p>
              )}

              {hasSubmitted && isValidCalendarDate(formData.contract.end_date) && isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) && isEndDateTooSoon(
                formData.contract.start_date,
                formData.contract.end_date,
                productMinMonths ?? undefined
              ) && (
                  <p className="text-xs text-destructive">
                    Use Invoice-only financing. Please return to the financing structure selection and choose invoice-only financing.
                  </p>
                )}
            </div>

            <Label className={cn(labelClassName, "self-start")}>Upload Contract</Label>
            <div className="self-start">
            <FileUploadArea
                onFileSelect={(file) => handleFileUpload("contract", file)}
                isUploading={isUploading.contract}
                uploadedFile={formData.contract.document}
                pendingFile={pendingFiles.contract}
                onRemove={stepIsEditable ? () => {
                  handleInputChange("contract", "document", null);
                  setPendingFiles((prev) => ({ ...prev, contract: undefined }));
                } : undefined}
                disabled={!stepIsEditable}
              />
            </div>
          </div>
        </section>
        )}

        {/* Customer Details Section */}
        <section className="space-y-3">
          <div>
            <h3 className={sectionHeaderClassName}>
              {/* {isInvoiceOnly ? "Customer Details (Required for Invoice Financing)" : "Customer details"} */}
              Customer Details
            </h3>
            <div className="border-b border-border mt-2 mb-4" />
          </div>

          <div className={sectionGridClassName}>
            <Label className={labelClassName}>Customer Name</Label>
            <Input
              value={formData.customer.name}
              onChange={(e) => handleInputChange("customer", "name", e.target.value)}
              disabled={!stepIsEditable}
              placeholder="eg. Petronas Chemical Bhd"
              className={inputClassName}
            />

            <Label className={labelClassName}>Customer Entity Type</Label>
            <Select
              value={formData.customer.entity_type}
              onValueChange={(value) => handleInputChange("customer", "entity_type", value)}
              disabled={!stepIsEditable}
            >
              <SelectTrigger className={cn(formSelectTriggerClassName, !stepIsEditable && formInputDisabledClassName)}>
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Label className={labelClassName}>Customer SSM Number</Label>
            <div className="space-y-1 min-h-[48px]">
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
                placeholder="e.g. 202123456789"
                className={inputClassName}
              />
              <p className="text-xs text-muted-foreground">12 digits</p>
              {hasSubmitted && !/^\d{12}$/.test(formData.customer.ssm_number) && (
                <p className="text-xs text-destructive">
                  SSM number must be 12 digits
                </p>
              )}
            </div>

            <Label className={labelClassName}>Customer Country</Label>
            <Select
              value={formData.customer.country}
              onValueChange={(value) => handleInputChange("customer", "country", value)}
              disabled={!stepIsEditable}
            >
              <SelectTrigger className={cn(formSelectTriggerClassName, !stepIsEditable && formInputDisabledClassName)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    <div className="flex items-center gap-2">
                      <span>{country.flag}</span>
                      <span>{country.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className={cn("flex items-center", fieldTooltipLabelGap)}>
              <Label className={labelClassName}>Is the Customer Related to You?</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={fieldTooltipTriggerClassName}>
                    <InformationCircleIcon className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className={fieldTooltipContentClassName}>
                  Related director/shareholder or having subsidiary/sister company or parent company relationship
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="h-11 flex items-center">
              <YesNoRadioGroup
                value={formData.customer.is_related_party}
                onValueChange={(v) => handleInputChange("customer", "is_related_party", v)}
                disabled={!stepIsEditable}
              />
            </div>

            <Label className={cn(labelClassName, "self-start")}>Upload Customer Consent</Label>
            <div className="self-start">
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload("consent", file)}
              isUploading={isUploading.consent}
              uploadedFile={formData.customer.document}
              pendingFile={pendingFiles.consent}
              onRemove={stepIsEditable ? () => {
                handleInputChange("customer", "document", null);
                setPendingFiles((prev) => ({ ...prev, consent: undefined }));
              } : undefined}
              disabled={!stepIsEditable}
            />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
