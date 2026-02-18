"use client";

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
import { DateInput } from "@/app/applications/components/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CloudUpload, X, CheckCircle2 } from "lucide-react";
import { useApplication } from "@/hooks/use-applications";
import { useContract, useCreateContract, useUpdateContract } from "@/hooks/use-contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthToken, createApiClient } from "@cashsouk/config";
import { cn } from "@/lib/utils";
import {
  formInputClassName,
  formLabelClassName,
  formSelectTriggerClassName,
  formTextareaClassName,
} from "@/app/applications/components/form-control";
import { formatMoney, parseMoney } from "../components/money";
import { MoneyInput } from "@/app/applications/components/money-input";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type YesNo = "yes" | "no";

const ENTITY_TYPES = [
  "Sole Proprietor",
  "Partnership",
  "Private Limited Company (Sdn Bhd)",
  "Public Limited Company (Bhd)",
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
  return new Date(start).getTime() < new Date(end).getTime();
}

const MIN_CONTRACT_MONTHS = 6;

function isEndDateTooSoon(endDate?: string, minMonths = MIN_CONTRACT_MONTHS) {
  if (!endDate) return false;
  const today = new Date();
  const minAllowedEndDate = new Date(today);
  minAllowedEndDate.setMonth(minAllowedEndDate.getMonth() + minMonths);
  return new Date(endDate) < minAllowedEndDate;
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
          className={`pointer-events-none relative block h-5 w-5 shrink-0 rounded-full ${checked ? "bg-primary" : "border-2 border-muted-foreground/50 bg-muted/30"
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
      <span className={checked ? selectedLabelClass : unselectedLabelClass}>
        {label}
      </span>
    </label>
  );
}

function YesNoRadioGroup({
  value,
  onValueChange,
}: {
  value: YesNo | "";
  onValueChange: (value: YesNo) => void;
}) {
  return (
    <div className="flex gap-6 items-center">
      <CustomRadio
        name="related"
        value="yes"
        checked={value === "yes"}
        onChange={() => onValueChange("yes")}
        label="Yes"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
      />
      <CustomRadio
        name="related"
        value="no"
        checked={value === "no"}
        onChange={() => onValueChange("no")}
        label="No"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
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
  file_size: number;
}

interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFile?: FileMetadata | null;
  pendingFile?: File;
  onRemove?: () => void;
}

function FileUploadArea({
  onFileSelect,
  isUploading,
  uploadedFile,
  pendingFile,
  onRemove,
}: FileUploadAreaProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!uploadedFile && !pendingFile && !isUploading) {
      fileInputRef.current?.click();
    }
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
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-muted-foreground">
              {(fileSize / 1024 / 1024).toFixed(2)} MB
              {isPending && " (uploading)"}
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <X className="h-3 w-3 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors bg-card/50"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
      />
      <div className="p-2 rounded-full bg-background border shadow-sm">
        <CloudUpload className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-center">
        <span className="text-base font-semibold text-primary">
          {isUploading ? "Uploading..." : "Click to upload"}
        </span>
        {!isUploading && (
          <span className="text-base text-muted-foreground"> or drag and drop</span>
        )}
      </div>
      <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>
    </div>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */

function ContractDetailsSkeleton() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <div>
          <Skeleton className="h-6 w-56" />
          <div className="mt-2 h-px bg-border" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 pl-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i}>
              <Skeleton className="h-[22px] w-40 mb-2" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

interface ContractDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
}

export function ContractDetailsStep({
  applicationId,
  onDataChange,
}: ContractDetailsStepProps) {
  const { getAccessToken } = useAuthToken();
  const { data: application } = useApplication(applicationId);
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

  /* ================================================================
     INITIALIZATION (run only once per applicationId)
     ================================================================ */

  const isInitializedRef = React.useRef(false);

  React.useEffect(() => {
    // Only initialize once per applicationId
    if (isInitializedRef.current) return;
    if (!application) return;
    if (isLoadingContract) return;
    // Note: contract can be undefined/null if it doesn't exist yet - we'll create it on save
    // So we don't wait for contract loading here

    const contractDetails = contract
      ? ((contract as unknown) as { contract_details?: Record<string, unknown> })?.contract_details as Record<string, unknown>
      : {};
    const customerDetails = contract
      ? ((contract as unknown) as { customer_details?: Record<string, unknown> })?.customer_details as Record<string, unknown>
      : {};

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

    setFormData(initialData);

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
    console.warn("[CONTRACT] Hydrated");
  }, [application, contract, isLoadingContract]);

  /* ================================================================
     SAVE FUNCTION
     ================================================================ */

  const saveFunction = React.useCallback(async () => {
    console.warn("[CONTRACT] Save triggered");
    setHasSubmitted(true);

    // ❌ Validation
    if (!/^\d{12}$/.test(formData.customer.ssm_number)) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_CONTRACT_SSM_FORMAT");
    }

    if (!isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date)) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_CONTRACT_DATE_ORDER");
    }

    if (isEndDateTooSoon(formData.contract.end_date)) {
      toast.error("Please fix the highlighted fields");
      throw new Error("VALIDATION_CONTRACT_DURATION_TOO_SHORT");
    }

    // Create contract if needed
    let effectiveContractId = contractId;
    if (!effectiveContractId) {
      try {
        const created = await createContractMutation.mutateAsync(applicationId);
        effectiveContractId = created?.id as string;
        if (!effectiveContractId) {
          console.warn("[CONTRACT] Contract creation did not return an id");
          toast.error("Something went wrong. Please try again.");
          throw new Error("CONTRACT_CREATION_NO_ID");
        }
      } catch (err) {
        console.warn("[CONTRACT] Contract creation error:", err);
        toast.error("Something went wrong. Please try again.");
        throw err;
      }
    }

    const token = await getAccessToken();
    const apiClient = createApiClient(API_URL, () => Promise.resolve(token));
    const updatedFormData = { ...formData };

    // Upload contract file if pending
    if (pendingFiles.contract) {
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
          } catch (error) {
            console.warn("Failed to delete old contract:", error);
          }
        }

        updatedFormData.contract.document = {
          s3_key: s3Key,
          file_name: pendingFiles.contract.name,
          file_size: pendingFiles.contract.size,
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
          } catch (error) {
            console.warn("Failed to delete old consent:", error);
          }
        }

        updatedFormData.customer.document = {
          s3_key: s3Key,
          file_name: pendingFiles.consent.name,
          file_size: pendingFiles.consent.size,
        };
        setLastS3Keys((prev) => ({ ...prev, consent: s3Key }));
      } finally {
        setIsUploading((prev) => ({ ...prev, consent: false }));
      }
    }

    // Convert values to numbers
    const valueNum = parseMoney(updatedFormData.contract.value);
    const approvedFacilityNum = (contract as unknown as { contract_details?: { approved_facility?: number } })?.contract_details?.approved_facility || 0;
    const utilizedFacilityNum = (contract as unknown as { contract_details?: { utilized_facility?: number } })?.contract_details?.utilized_facility || 0;
    const availableFacilityNum = valueNum;

    const updatedContractDetails = {
      ...updatedFormData.contract,
      value: valueNum,
      approved_facility: approvedFacilityNum,
      utilized_facility: utilizedFacilityNum,
      available_facility: availableFacilityNum,
      document: updatedFormData.contract.document || undefined,
    };

    const updatedCustomerDetails = {
      ...updatedFormData.customer,
      is_related_party: updatedFormData.customer.is_related_party === "yes",
      document: updatedFormData.customer.document || undefined,
    };

    // Save to DB
    await updateContractMutation.mutateAsync({
      id: effectiveContractId,
      data: {
        contract_details: updatedContractDetails,
        customer_details: updatedCustomerDetails,
      },
    });

    // Clear pending files
    setPendingFiles({});

    // Return persisted data
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
  ]);

  /* ================================================================
     NOTIFY PARENT
     ================================================================ */

  React.useEffect(() => {
    if (!onDataChange) return;

    const hasFormChanges = Object.keys(pendingFiles).length > 0;
    const hasContractDocument = !!formData.contract.document || !!pendingFiles.contract;
    const hasConsentDocument = !!formData.customer.document || !!pendingFiles.consent;

    const isValid =
      !!formData.contract.title &&
      !!formData.contract.description &&
      !!formData.contract.number &&
      !!formData.contract.value &&
      !!formData.contract.start_date &&
      !!formData.contract.end_date &&
      hasContractDocument &&
      !!formData.customer.name &&
      !!formData.customer.entity_type &&
      !!formData.customer.ssm_number &&
      !!formData.customer.country &&
      hasConsentDocument;

    onDataChange({
      contract_details: formData.contract,
      customer_details: formData.customer,
      isValid,
      hasPendingChanges: hasFormChanges,
      saveFunction,
    });
  }, [formData, pendingFiles, saveFunction, onDataChange]);

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

  /* ================================================================
     RENDER
     ================================================================ */

  if (!isInitializedRef.current) {
    return <ContractDetailsSkeleton />;
  }

  const labelClassName = cn(formLabelClassName, "font-normal");
  const inputClassName = formInputClassName;
  const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
  const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3";

  return (
    <div className="space-y-10 px-3">
      {/* Contract Details Section */}
      <section className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Contract details</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={sectionGridClassName}>
          <Label className={labelClassName}>Contract title</Label>
          <Input
            value={formData.contract.title}
            onChange={(e) => handleInputChange("contract", "title", e.target.value)}
            placeholder="eg. Mining Rig Repair 12654"
            className={inputClassName}
          />

          <Label className={labelClassName}>Contract description</Label>
          <Textarea
            value={formData.contract.description}
            onChange={(e) =>
              handleInputChange("contract", "description", e.target.value)
            }
            placeholder="eg. Repair and maintenance for 12 mining rigs"
            className={cn(formTextareaClassName, "min-h-[100px]")}
          />

          <Label className={labelClassName}>Contract number</Label>
          <Input
            value={formData.contract.number}
            onChange={(e) => handleInputChange("contract", "number", e.target.value)}
            placeholder="eg. 20212345678"
            className={inputClassName}
          />

          <Label className={labelClassName}>Contract value</Label>
          <div className="h-11 flex items-center">
            <MoneyInput
              value={formData.contract.value}
              onValueChange={(value) => handleInputChange("contract", "value", value)}
              placeholder={`eg. ${formatMoney(5000000)}`}
              prefix="RM"
              inputClassName={inputClassName}
            />
          </div>

          <Label className={labelClassName}>Contract start date</Label>
          <DateInput
            value={formData.contract.start_date?.slice(0, 10) || ""}
            onChange={(v) => handleInputChange("contract", "start_date", v)}
            className={inputClassName}
          />

          <Label className={labelClassName}>Contract end date</Label>
          <div className="space-y-1">
            <DateInput
              value={formData.contract.end_date?.slice(0, 10) || ""}
              onChange={(v) => handleInputChange("contract", "end_date", v)}
              className={cn(
                inputClassName,
                (hasSubmitted && !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date)) ||
                  (hasSubmitted && isEndDateTooSoon(formData.contract.end_date))
                  ? "border-destructive focus-visible:ring-destructive"
                  : ""
              )}
            />

            {hasSubmitted && !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) && (
              <p className="text-xs text-destructive">
                End date must be after start date
              </p>
            )}

            {hasSubmitted && isEndDateTooSoon(formData.contract.end_date) && !isStartBeforeEnd(formData.contract.start_date, formData.contract.end_date) === false && (
              <p className="text-xs text-destructive">
                Use Invoice-only financing. Please return to the financing structure selection and choose invoice-only financing.
              </p>
            )}
          </div>

          <Label className={labelClassName}>Upload contract</Label>
          <FileUploadArea
            onFileSelect={(file) => handleFileUpload("contract", file)}
            isUploading={isUploading.contract}
            uploadedFile={formData.contract.document}
            pendingFile={pendingFiles.contract}
            onRemove={() => {
              handleInputChange("contract", "document", null);
              setPendingFiles((prev) => ({ ...prev, contract: undefined }));
            }}
          />
        </div>
      </section>

      {/* Customer Details Section */}
      <section className="space-y-4">
        <div>
          <h3 className={sectionHeaderClassName}>Customer details</h3>
          <div className="mt-2 h-px bg-border" />
        </div>

        <div className={sectionGridClassName}>
          <Label className={labelClassName}>Customer name</Label>
          <Input
            value={formData.customer.name}
            onChange={(e) => handleInputChange("customer", "name", e.target.value)}
            placeholder="eg. Petronas Chemical Bhd"
            className={inputClassName}
          />

          <Label className={labelClassName}>Customer entity type</Label>
          <Select
            value={formData.customer.entity_type}
            onValueChange={(value) => handleInputChange("customer", "entity_type", value)}
          >
            <SelectTrigger className={formSelectTriggerClassName}>
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

          <Label className={labelClassName}>Customer SSM number</Label>
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
              placeholder="eg. 202123456789"
              className={inputClassName}
            />
            {hasSubmitted && !/^\d{12}$/.test(formData.customer.ssm_number) && (
              <p className="text-xs text-destructive">
                SSM number must be 12 digits
              </p>
            )}
          </div>

          <Label className={labelClassName}>Customer country</Label>
          <Select
            value={formData.customer.country}
            onValueChange={(value) => handleInputChange("customer", "country", value)}
          >
            <SelectTrigger className={formSelectTriggerClassName}>
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

          <Label className={labelClassName}>is customer related to issuer?</Label>
          <div className="h-11 flex items-center">
            <YesNoRadioGroup
              value={formData.customer.is_related_party}
              onValueChange={(v) => handleInputChange("customer", "is_related_party", v)}
            />
          </div>

          <Label className={labelClassName}>Upload customer consent</Label>
          <FileUploadArea
            onFileSelect={(file) => handleFileUpload("consent", file)}
            isUploading={isUploading.consent}
            uploadedFile={formData.customer.document}
            pendingFile={pendingFiles.consent}
            onRemove={() => {
              handleInputChange("customer", "document", null);
              setPendingFiles((prev) => ({ ...prev, consent: undefined }));
            }}
          />
        </div>
      </section>
    </div>
  );
}
