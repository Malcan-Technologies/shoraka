"use client";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/**
 * CONTRACT DETAILS STEP
 *
 * This step collects information about the contract and the customer.
 * 1. Contract details: title, description, number, value, dates, document
 * 2. Customer details: name, entity type, SSM number, country, related party status, consent
 *
 * Props:
 * - applicationId: ID of the current application
 * - onDataChange: callback to pass form data to parent
 */

interface ContractDetailsStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

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

/** Render blocks
 *
 * What: Canonical yes/no radio group for boolean fields.
 * Why: Match the same yes/no UI used in `business-details-step.tsx`.
 * Data: `value` is `"yes" | "no" | ""` so we can avoid pre-selecting.
 */
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

function YesNoRadioGroup({
  value,
  onValueChange,
  name,
}: {
  value: YesNo | "";
  onValueChange: (v: YesNo) => void;
  name: string;
}) {
  return (
    <div className="flex gap-6 items-center">
      <CustomRadio
        name={name}
        value="yes"
        checked={value === "yes"}
        onChange={() => onValueChange("yes")}
        label="Yes"
        selectedLabelClass={radioSelectedLabel}
        unselectedLabelClass={radioUnselectedLabel}
      />
      <CustomRadio
        name={name}
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

export function ContractDetailsStep({ applicationId, onDataChange }: ContractDetailsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const contractId = (application as any)?.contract?.id;

  const { data: contract, isLoading: isLoadingContract } = useContract(contractId || "");
  const createContractMutation = useCreateContract();
  const updateContractMutation = useUpdateContract();
  const { getAccessToken } = useAuthToken();

  // Local state for form fields
  const [formData, setFormData] = React.useState({
    contract: {
      title: "",
      description: "",
      number: "",
      value: 0 as number | string,
      start_date: "",
      end_date: "",
      approved_facility: 0 as number | string,
      utilized_facility: 0 as number | string,
      available_facility: 0 as number | string,
      document: null as any,
    },
    customer: {
      name: "",
      entity_type: "",
      ssm_number: "",
      country: "MY",
      is_related_party: "" as YesNo | "",
      document: null as any,
    },
  });

  // Track if we've initialized the data
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [initialData, setInitialData] = React.useState<any>(null);
  const [isUploading] = React.useState<Record<string, boolean>>({});

  // Track pending files (not uploaded to S3 yet)
  const [pendingFiles, setPendingFiles] = React.useState<{
    contract?: File;
    consent?: File;
  }>({});

  // Track existing S3 keys for versioning
  const [lastS3Keys, setLastS3Keys] = React.useState<{
    contract?: string;
    consent?: string;
  }>({});

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * CREATE CONTRACT IF IT DOESN'T EXIST
   *
   * FIX: Use ref guard to prevent duplicate contract creation due to React re-renders
   * before contractId is populated from query invalidation.
   */
  // Contract creation will be performed by saveFunction when required.
  // We avoid auto-creating here to keep control in the step save flow.

  /**
   * LOAD SAVED DATA
   */
  React.useEffect(() => {
    if (!contract || isInitialized) return;

    const contractDetails = (contract.contract_details as any) || {};
    const customerDetails = (contract.customer_details as any) || {};

    // Check if contract has any actual data
    const hasContractData = contractDetails.title || contractDetails.number ||
      contractDetails.value || contractDetails.start_date;
    const hasCustomerData = customerDetails.name || customerDetails.ssm_number;

    const financingStructure = (application as any)?.financing_structure;
    const structureType = financingStructure?.structure_type;

    // Only show empty form if structure is "new_contract" AND contract has no data yet
    // This ensures navigating back doesn't clear a filled form
    if (structureType === "new_contract" && !hasContractData && !hasCustomerData) {
      const emptyForm = {
        contract: {
          title: "",
          description: "",
          number: "",
          value: 0,
          start_date: "",
          end_date: "",
          approved_facility: 0,
          utilized_facility: 0,
          available_facility: 0,
          document: null,
        },
        customer: {
          name: "",
          entity_type: "",
          ssm_number: "",
          country: "MY",
          is_related_party: "" as YesNo | "",
          document: null,
        },
      };
      setFormData(emptyForm);
      setInitialData(JSON.parse(JSON.stringify(emptyForm)));
      setIsInitialized(true);
      return;
    }

    const initial = {
      contract: {
        title: contractDetails.title || "",
        description: contractDetails.description || "",
        number: contractDetails.number || "",
        value: contractDetails.value || 0,
        start_date: contractDetails.start_date || "",
        end_date: contractDetails.end_date || "",
        approved_facility: contractDetails.approved_facility || 0,
        utilized_facility: contractDetails.utilized_facility || 0,
        available_facility: contractDetails.available_facility || 0,
        document: contractDetails.document || null,
      },
      customer: {
        name: customerDetails.name || "",
        entity_type: customerDetails.entity_type || "",
        ssm_number: customerDetails.ssm_number || "",
        country: customerDetails.country || "MY",
        is_related_party: (customerDetails.is_related_party === undefined || customerDetails.is_related_party === null
          ? ""
          : customerDetails.is_related_party
            ? "yes"
            : "no") as YesNo | "",
        document: customerDetails.document || null,
      },
    };

    // Track existing S3 keys for versioning
    const s3Keys: { contract?: string; consent?: string } = {};
    if (contractDetails.document?.s3_key) {
      s3Keys.contract = contractDetails.document.s3_key;
    }
    if (customerDetails.document?.s3_key) {
      s3Keys.consent = customerDetails.document.s3_key;
    }
    setLastS3Keys(s3Keys);

    setFormData(initial);
    setInitialData(JSON.parse(JSON.stringify(initial)));
    setIsInitialized(true);
  }, [contract, isInitialized, application]);

  /**
   * SAVE FUNCTION
   */
  const handleSave = React.useCallback(async () => {
    // Ensure a contract exists before proceeding. If missing, create it now.
    let effectiveContractId = contractId;
    if (!effectiveContractId) {
      try {
        const created = await createContractMutation.mutateAsync(applicationId);
        effectiveContractId = created?.id as string;
        if (!effectiveContractId) {
          toast.error("Failed to create contract. Please try again.");
          throw new Error("Contract creation did not return an id");
        }
      } catch (err) {
        toast.error("Contract creation failed. Please try again.");
        throw err;
      }
    }

    // Upload pending files first
    const token = await getAccessToken();
    const apiClient = createApiClient(API_URL, () => Promise.resolve(token));

    const updatedFormData = { ...formData };

    // Upload contract document if pending
    if (pendingFiles.contract) {
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
        headers: {
          "Content-Type": pendingFiles.contract.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload contract document to S3");
      }

      // Delete old file if S3 key changed
      if (existingS3Key && existingS3Key !== s3Key) {
        try {
          await apiClient.deleteContractDocument(effectiveContractId, existingS3Key);
        } catch (error) {
          console.warn("Failed to delete old contract document:", error);
        }
      }

      updatedFormData.contract.document = {
        s3_key: s3Key,
        file_name: pendingFiles.contract.name,
        file_size: pendingFiles.contract.size,
      };

      setLastS3Keys((prev) => ({ ...prev, contract: s3Key }));
    }

    // Upload consent document if pending
    if (pendingFiles.consent) {
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
        headers: {
          "Content-Type": pendingFiles.consent.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload consent document to S3");
      }

      // Delete old file if S3 key changed
      if (existingS3Key && existingS3Key !== s3Key) {
        try {
          await apiClient.deleteContractDocument(effectiveContractId, existingS3Key);
        } catch (error) {
          console.warn("Failed to delete old consent document:", error);
        }
      }

      updatedFormData.customer.document = {
        s3_key: s3Key,
        file_name: pendingFiles.consent.name,
        file_size: pendingFiles.consent.size,
      };

      setLastS3Keys((prev) => ({ ...prev, consent: s3Key }));
    }

    // Convert values to numbers
    const valueNum =
      typeof updatedFormData.contract.value === "string"
        ? parseFloat((updatedFormData.contract.value as string).replace(/[^0-9.]/g, "")) || 0
        : (updatedFormData.contract.value as number);

    const utilizedFacilityNum =
      typeof updatedFormData.contract.utilized_facility === "string"
        ? parseFloat((updatedFormData.contract.utilized_facility as string).replace(/[^0-9.]/g, "")) || 0
        : (updatedFormData.contract.utilized_facility as number);

    // For now, approved_facility is 0 until admin approves
    // available_facility should be initialized to contract value (this is the single source of truth)
    const approvedFacilityNum = 0;
    const availableFacilityNum = valueNum;

    const updatedContractDetails = {
      ...updatedFormData.contract,
      value: valueNum,
      approved_facility: approvedFacilityNum,
      utilized_facility: utilizedFacilityNum,
      available_facility: availableFacilityNum,
    };

    const updatedCustomerDetails = {
      ...updatedFormData.customer,
      is_related_party: updatedFormData.customer.is_related_party === "yes",
    };

    await updateContractMutation.mutateAsync({
      id: effectiveContractId,
      data: {
        contract_details: updatedContractDetails,
        customer_details: updatedCustomerDetails,
      },
    });

    // Clear pending files and update initial data
    setPendingFiles({});
    // Reflect saved values in local form state so hasPendingChanges becomes false immediately
    const newFormState = {
      contract: updatedContractDetails,
      customer: updatedFormData.customer,
    };
    setFormData(newFormState);
    setInitialData(JSON.parse(JSON.stringify(newFormState)));

    return {
      contract_details: updatedContractDetails,
      customer_details: updatedCustomerDetails,
    };
  }, [contractId, formData, pendingFiles, updateContractMutation, getAccessToken]);

  // Notify parent on data change
  // FIX: Remove isInitialized gate to ensure saveFunction is always available
  React.useEffect(() => {
    if (!onDataChangeRef.current) return;

    const hasFormChanges = JSON.stringify(formData) !== JSON.stringify(initialData);
    const hasPendingFileUploads = Object.keys(pendingFiles).length > 0;
    const hasPendingChanges = hasFormChanges || hasPendingFileUploads;

    // Check if all fields are filled (including pending files)
    const hasContractDocument = !!formData.contract.document || !!pendingFiles.contract;
    const hasConsentDocument = !!formData.customer.document || !!pendingFiles.consent;

    const isCurrentStepValid =
      !!contractId &&
      !!formData.contract.title &&
      !!formData.contract.description &&
      !!formData.contract.number &&
      (formData.contract.value !== "" && formData.contract.value !== 0) &&
      !!formData.contract.start_date &&
      !!formData.contract.end_date &&
      hasContractDocument &&
      !!formData.customer.name &&
      !!formData.customer.entity_type &&
      !!formData.customer.ssm_number &&
      !!formData.customer.country &&
      hasConsentDocument;

    onDataChangeRef.current({
      ...formData,
      isValid: isCurrentStepValid,
      isCurrentStepValid,
      saveFunction: handleSave,
      hasPendingChanges,
      isCreatingContract: createContractMutation.isPending,
    });
  }, [formData, initialData, handleSave, pendingFiles, contractId, createContractMutation.isPending]);

  const handleInputChange = (section: "contract" | "customer", field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleFileUpload = async (type: "contract" | "consent", file: File) => {
    // if (!contractId) return;

    // Validate file
    if (file.type !== "application/pdf") {
      toast.error("Invalid file type", {
        description: "Only PDF files are allowed",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "File size must be less than 5MB",
      });
      return;
    }

    // Store file locally (will be uploaded when Save and Continue is clicked)
    setPendingFiles((prev) => ({ ...prev, [type]: file }));
    toast.success("File added. Click 'Save and Continue' to upload.");
  };

  /** Helpers
   *
   * What: Canonical form control styles shared across steps.
   * Why: Ensure inputs/textareas/selects match the same border, radius, and focus behavior everywhere.
   * Data: Imported from local shared module under `apps/issuer`.
   */
  const inputClassName = formInputClassName;
  const labelClassName = cn(formLabelClassName, "font-normal");
  const sectionHeaderClassName = "text-base sm:text-lg md:text-xl font-semibold";
  const sectionGridClassName = "grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mt-4 px-3";

  if (isLoadingApp || (contractId && isLoadingContract)) {
    return (
      <CompanyDetailsSkeleton />
    );
  }

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
            onChange={(e) => handleInputChange("contract", "description", e.target.value)}
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
            <div className="relative w-full h-full flex items-center">
              <div className="absolute left-4 inset-y-0 flex items-center text-muted-foreground font-medium text-sm pointer-events-none">
                RM
              </div>
              <Input
                type="text"
                inputMode="decimal"
                value={formData.contract.value === 0 ? "" : formData.contract.value}
                placeholder="eg. 5000000.00"
                className={inputClassName + " pl-12"}
                onChange={(e) => {
                  const raw = e.target.value;

                  // allow empty
                  if (raw === "") {
                    handleInputChange("contract", "value", "");
                    return;
                  }

                  // digits + optional decimal (max 2 dp)
                  if (!/^\d+(\.\d{0,2})?$/.test(raw)) return;

                  // HARD LIMIT: max 12 digits before decimal
                  const [intPart] = raw.split(".");
                  if (intPart.length > 12) return;

                  handleInputChange("contract", "value", raw);
                }}
                onBlur={() => {
                  if (formData.contract.value !== "") {
                    handleInputChange(
                      "contract",
                      "value",
                      Number(formData.contract.value).toFixed(2)
                    );
                  }
                }}
              />
            </div>
          </div>

          <Label className={labelClassName}>Contract start date</Label>
          <DateInput
            value={formData.contract.start_date?.slice(0, 10) || ""}
            onChange={(v) => handleInputChange("contract", "start_date", v)}
            className={inputClassName}
            placeholder="eg. 2025-04-12"
          />


          <Label className={labelClassName}>Contract end date</Label>
          <DateInput
            value={formData.contract.end_date?.slice(0, 10) || ""}
            onChange={(v) => handleInputChange("contract", "end_date", v)}
            className={inputClassName}
            placeholder="eg. 2025-06-12"
          />


          <Label className={labelClassName}>Upload contract</Label>
          <FileUploadArea
            onFileSelect={(file) => handleFileUpload("contract", file)}
            isUploading={isUploading.contract}
            uploadedFile={formData.contract.document}
            pendingFile={pendingFiles.contract}
            onRemove={() => {
              handleInputChange("contract", "document", null as any);
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
          <Input
            value={formData.customer.ssm_number}
            onChange={(e) => handleInputChange("customer", "ssm_number", e.target.value)}
            placeholder="eg. 20212345678"
            className={inputClassName}
          />

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
            name="related"
            value={formData.customer.is_related_party}
            onValueChange={(v) => handleInputChange("customer", "is_related_party", v)}
          /></div>

          <Label className={labelClassName}>Upload customer consent</Label>
          <FileUploadArea
            onFileSelect={(file) => handleFileUpload("consent", file)}
            isUploading={isUploading.consent}
            uploadedFile={formData.customer.document}
            pendingFile={pendingFiles.consent}
            onRemove={() => {
              handleInputChange("customer", "document", null as any);
              setPendingFiles((prev) => ({ ...prev, consent: undefined }));
            }}
          />
        </div>
      </section>
    </div>
  );
}

/* FormField helper removed (unused) */

/**
 * FILE UPLOAD AREA HELPER
 */
interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFile?: { s3_key: string; file_name: string; file_size: number } | null;
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
        toast.error("Invalid file type", { description: "Please upload a PDF file" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File too large", { description: "Maximum file size is 5MB" });
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
      <div className="border border-border rounded-xl px-4 py-3 flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-1 rounded-full",
            isPending ? "bg-yellow-500/10" : "bg-primary/10"
          )}>
            <CheckCircle2 className={cn(
              "h-4 w-4",
              isPending ? "text-yellow-500" : "text-primary"
            )} />
          </div>
          <div>
            <div className="text-sm font-medium">{fileName}</div>
            <div className="text-xs text-muted-foreground">
              {(fileSize / 1024 / 1024).toFixed(2)} MB
              {isPending}
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
        {!isUploading && <span className="text-base text-muted-foreground"> or drag and drop</span>}
      </div>
      <div className="text-sm text-muted-foreground">PDF (max. 5MB)</div>
    </div>
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
