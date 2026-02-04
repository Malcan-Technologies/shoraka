"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CloudUpload, Calendar as CalendarIcon, X, CheckCircle2 } from "lucide-react";
import { useApplication } from "@/hooks/use-applications";
import { useContract, useCreateContract, useUpdateContract } from "@/hooks/use-contracts";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useAuthToken, createApiClient } from "@cashsouk/config";

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

export function ContractDetailsStep({ applicationId, onDataChange }: ContractDetailsStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const contractId = application?.contract?.id;

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
      status: "pending" as "pending" | "approved",
      document: null as any,
    },
    customer: {
      name: "",
      entity_type: "",
      ssm_number: "",
      country: "MY",
      is_related_party: false,
      document: null as any,
    },
  });

  // Track if we've initialized the data
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [initialData, setInitialData] = React.useState<any>(null);
  const [isUploading, setIsUploading] = React.useState<Record<string, boolean>>({});

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * CREATE CONTRACT IF IT DOESN'T EXIST
   */
  React.useEffect(() => {
    if (application && !contractId && !createContractMutation.isPending && !isInitialized) {
      createContractMutation.mutate(applicationId);
    }
  }, [application, contractId, createContractMutation, applicationId, isInitialized]);

  /**
   * LOAD SAVED DATA
   */
  React.useEffect(() => {
    if (!contract || isInitialized) return;

    const contractDetails = (contract.contract_details as any) || {};
    const customerDetails = (contract.customer_details as any) || {};

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
        status: contractDetails.status || "pending",
        document: contractDetails.document || null,
      },
      customer: {
        name: customerDetails.name || "",
        entity_type: customerDetails.entity_type || "",
        ssm_number: customerDetails.ssm_number || "",
        country: customerDetails.country || "MY",
        is_related_party: !!customerDetails.is_related_party,
        document: customerDetails.document || null,
      },
    };

    setFormData(initial);
    setInitialData(JSON.parse(JSON.stringify(initial)));
    setIsInitialized(true);
  }, [contract, isInitialized]);

  /**
   * SAVE FUNCTION
   */
  const handleSave = React.useCallback(async () => {
    if (!contractId) return;

    // Convert values to numbers
    const valueNum =
      typeof formData.contract.value === "string"
        ? parseFloat((formData.contract.value as string).replace(/[^0-9.]/g, "")) || 0
        : (formData.contract.value as number);

    const utilizedFacilityNum =
      typeof formData.contract.utilized_facility === "string"
        ? parseFloat((formData.contract.utilized_facility as string).replace(/[^0-9.]/g, "")) || 0
        : (formData.contract.utilized_facility as number);

    // For now, approved_facility is 0 until admin approves
    const approvedFacilityNum = 0;
    const availableFacilityNum = Math.max(0, approvedFacilityNum - utilizedFacilityNum);

    const updatedContractDetails = {
      ...formData.contract,
      value: valueNum,
      approved_facility: approvedFacilityNum,
      utilized_facility: utilizedFacilityNum,
      available_facility: availableFacilityNum,
      status: "pending" as const,
    };

    await updateContractMutation.mutateAsync({
      id: contractId,
      data: {
        contract_details: updatedContractDetails,
        customer_details: formData.customer,
      },
    });

    setInitialData(
      JSON.parse(
        JSON.stringify({
          contract: updatedContractDetails,
          customer: formData.customer,
        })
      )
    );

    return {
      contract_details: updatedContractDetails,
      customer_details: formData.customer,
    };
  }, [contractId, formData, updateContractMutation]);

  // Notify parent on mount/initialization or data change
  React.useEffect(() => {
    if (isInitialized && onDataChangeRef.current) {
      const hasPendingChanges = JSON.stringify(formData) !== JSON.stringify(initialData);
      onDataChangeRef.current({
        ...formData,
        isValid: !!formData.contract.title && !!formData.customer.name,
        saveFunction: handleSave,
        hasPendingChanges,
      });
    }
  }, [formData, isInitialized, initialData, handleSave]);

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
    if (!contractId) return;

    try {
      setIsUploading((prev) => ({ ...prev, [type]: true }));
      const token = await getAccessToken();
      const apiClient = createApiClient(API_URL, () => Promise.resolve(token));

      // Request upload URL
      const response = await apiClient.requestContractUploadUrl(contractId, {
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
        type: type === "contract" ? "contract" : "consent",
      });

      if (!response.success) {
        throw new Error(response.error.message);
      }

      const { uploadUrl, s3Key } = response.data;

      // Upload to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadRes.ok) {
        throw new Error("Failed to upload file to S3");
      }

      // Update local state
      const docInfo = {
        s3_key: s3Key,
        file_name: file.name,
        file_size: file.size,
      };

      if (type === "contract") {
        handleInputChange("contract", "document", docInfo);
      } else {
        handleInputChange("customer", "document", docInfo);
      }

      toast.success("File uploaded successfully");
    } catch (error: any) {
      toast.error("Upload failed", { description: error.message });
    } finally {
      setIsUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  if (isLoadingApp || (contractId && isLoadingContract)) {
    return (
      <div className="space-y-12 pb-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-8">
      {/* Contract Details Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold">Contract details</h2>

        <div className="space-y-4">
          <FormField label="Contract title">
            <Input
              value={formData.contract.title}
              onChange={(e) => handleInputChange("contract", "title", e.target.value)}
              placeholder="Mining Rig Repair 12654"
              className="rounded-xl"
            />
          </FormField>

          <FormField label="Contract description">
            <Textarea
              value={formData.contract.description}
              onChange={(e) => handleInputChange("contract", "description", e.target.value)}
              placeholder="Add contract description"
              className="rounded-xl min-h-[100px]"
            />
          </FormField>

          <FormField label="Contract number">
            <Input
              value={formData.contract.number}
              onChange={(e) => handleInputChange("contract", "number", e.target.value)}
              placeholder="20212345678"
              className="rounded-xl"
            />
          </FormField>

          <FormField label="Contract value">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none">
                RM
              </div>
              <Input
                value={formData.contract.value === 0 ? "" : formData.contract.value}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  handleInputChange("contract", "value", val);
                }}
                placeholder="5,000,000"
                className="rounded-xl pl-12"
              />
            </div>
          </FormField>

          <FormField label="Contract start date">
            <div className="relative">
              <Input
                type="date"
                value={formData.contract.start_date}
                onChange={(e) => handleInputChange("contract", "start_date", e.target.value)}
                className="rounded-xl pr-10"
              />
              <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </FormField>

          <FormField label="Contract end date">
            <div className="relative">
              <Input
                type="date"
                value={formData.contract.end_date}
                onChange={(e) => handleInputChange("contract", "end_date", e.target.value)}
                className="rounded-xl pr-10"
              />
              <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
            </div>
          </FormField>

          <FormField label="Upload contract">
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload("contract", file)}
              isUploading={isUploading.contract}
              uploadedFile={formData.contract.document}
              onRemove={() => handleInputChange("contract", "document", null as any)}
            />
          </FormField>
        </div>
      </section>

      {/* Customer Details Section */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold">Customer details</h2>

        <div className="space-y-4">
          <FormField label="Customer name">
            <Input
              value={formData.customer.name}
              onChange={(e) => handleInputChange("customer", "name", e.target.value)}
              placeholder="Petronas Chemical Bhd"
              className="rounded-xl"
            />
          </FormField>

          <FormField label="Customer entity type">
            <Select
              value={formData.customer.entity_type}
              onValueChange={(value) => handleInputChange("customer", "entity_type", value)}
            >
              <SelectTrigger className="rounded-xl">
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
          </FormField>

          <FormField label="Customer SSM number">
            <Input
              value={formData.customer.ssm_number}
              onChange={(e) => handleInputChange("customer", "ssm_number", e.target.value)}
              placeholder="20212345678"
              className="rounded-xl"
            />
          </FormField>

          <FormField label="Customer country">
            <Select
              value={formData.customer.country}
              onValueChange={(value) => handleInputChange("customer", "country", value)}
            >
              <SelectTrigger className="rounded-xl">
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
          </FormField>

          <FormField label="is customer related to issuer?">
            <RadioGroup
              value={formData.customer.is_related_party ? "yes" : "no"}
              onValueChange={(value) =>
                handleInputChange("customer", "is_related_party", value === "yes")
              }
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="yes"
                  id="related-yes"
                  className="text-primary border-primary"
                />
                <Label htmlFor="related-yes" className="text-base cursor-pointer">
                  Yes
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="no"
                  id="related-no"
                  className="text-primary border-primary"
                />
                <Label htmlFor="related-no" className="text-base cursor-pointer">
                  NO
                </Label>
              </div>
            </RadioGroup>
          </FormField>

          <FormField label="Upload customer consent">
            <FileUploadArea
              onFileSelect={(file) => handleFileUpload("consent", file)}
              isUploading={isUploading.consent}
              uploadedFile={formData.customer.document}
              onRemove={() => handleInputChange("customer", "document", null as any)}
            />
          </FormField>
        </div>
      </section>
    </div>
  );
}

/**
 * FORM FIELD HELPER
 */
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-2 md:gap-4 items-start md:items-center py-2">
      <Label className="text-base font-medium text-foreground capitalize">{label}</Label>
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}

/**
 * FILE UPLOAD AREA HELPER
 */
interface FileUploadAreaProps {
  onFileSelect: (file: File) => void;
  isUploading?: boolean;
  uploadedFile?: { s3_key: string; file_name: string; file_size: number } | null;
  onRemove?: () => void;
}

function FileUploadArea({
  onFileSelect,
  isUploading,
  uploadedFile,
  onRemove,
}: FileUploadAreaProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (!uploadedFile && !isUploading) {
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

  if (uploadedFile) {
    return (
      <div className="border border-border rounded-xl p-4 flex items-center justify-between bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-medium">{uploadedFile.file_name}</div>
            <div className="text-xs text-muted-foreground">
              {(uploadedFile.file_size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          className="p-2 hover:bg-muted rounded-full transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors bg-card/50"
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        className="hidden"
      />
      <div className="p-3 rounded-full bg-background border shadow-sm">
        <CloudUpload className="h-6 w-6 text-muted-foreground" />
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
