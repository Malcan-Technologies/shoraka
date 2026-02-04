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
import { CloudUpload, Calendar as CalendarIcon } from "lucide-react";

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

export function ContractDetailsStep({
  applicationId: _applicationId,
  onDataChange,
}: ContractDetailsStepProps) {
  // Local state for form fields
  const [formData, setFormData] = React.useState({
    contract: {
      title: "Mining Rig Repair 12654",
      description: "",
      number: "20212345678",
      value: "RM 5,000,000",
      start_date: "2025-04-12",
      end_date: "2025-04-12",
    },
    customer: {
      name: "Petronas Chemical Bhd",
      entity_type: "Public Limited Company (Bhd)",
      ssm_number: "20212345678",
      country: "MY",
      is_related_party: "yes",
    },
  });

  // Track if we've initialized the data
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  // Notify parent on mount/initialization
  React.useEffect(() => {
    if (!isInitialized) {
      onDataChangeRef.current?.({ ...formData, isValid: true });
      setIsInitialized(true);
    }
  }, [isInitialized, formData]);

  const handleInputChange = (
    section: "contract" | "customer",
    field: string,
    value: string | boolean
  ) => {
    const newData = {
      ...formData,
      [section]: {
        ...formData[section],
        [field]: value,
      },
    };
    setFormData(newData);
    onDataChangeRef.current?.({ ...newData, isValid: true });
  };

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
            <Input
              value={formData.contract.value}
              onChange={(e) => handleInputChange("contract", "value", e.target.value)}
              placeholder="RM 5,000,000"
              className="rounded-xl"
            />
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
            <FileUploadArea />
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
              value={formData.customer.is_related_party}
              onValueChange={(value) => handleInputChange("customer", "is_related_party", value)}
              className="flex items-center gap-6"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="related-yes" className="text-primary border-primary" />
                <Label htmlFor="related-yes" className="text-base cursor-pointer">Yes</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="related-no" className="text-primary border-primary" />
                <Label htmlFor="related-no" className="text-base cursor-pointer">NO</Label>
              </div>
            </RadioGroup>
          </FormField>

          <FormField label="Upload customer consent">
            <FileUploadArea />
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
      <Label className="text-base font-medium text-foreground capitalize">
        {label}
      </Label>
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}

/**
 * FILE UPLOAD AREA HELPER
 */
function FileUploadArea() {
  return (
    <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors bg-card/50">
      <div className="p-3 rounded-full bg-background border shadow-sm">
        <CloudUpload className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="text-center">
        <span className="text-base font-semibold text-primary">Click to upload</span>
        <span className="text-base text-muted-foreground"> or drag and drop</span>
      </div>
      <div className="text-sm text-muted-foreground">
        PDF (max. 5MB)
      </div>
    </div>
  );
}
