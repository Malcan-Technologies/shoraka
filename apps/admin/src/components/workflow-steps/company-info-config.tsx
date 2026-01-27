"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@cashsouk/ui";

interface CompanyInfoConfig {
  requiredFields?: string[];
}

interface CompanyInfoConfigProps {
  config: CompanyInfoConfig;
  onChange: (config: CompanyInfoConfig) => void;
}

const AVAILABLE_FIELDS = [
  { id: "company_name", label: "Company Name", default: true },
  { id: "entity_type", label: "Type of Entity (Sdn Bhd, etc.)", default: true },
  { id: "ssm_no", label: "SSM Number", default: true },
  { id: "industry", label: "Industry/Sector", default: false },
  { id: "nature_business", label: "Nature of Business", default: false },
  { id: "num_employees", label: "Number of Employees", default: false },
  { id: "business_address", label: "Business Address", default: true },
  { id: "registered_address", label: "Registered Address", default: false },
];

export function CompanyInfoConfig({ config, onChange }: CompanyInfoConfigProps) {
  // All fields are required and read-only
  // config and onChange are unused since this is a read-only step
  void config;
  void onChange;

  return (
    <div className="p-3 sm:p-5 rounded-lg border bg-card">
      <div className="mb-4 sm:mb-5 flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm sm:text-base font-semibold">
            Verify Company Info
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            All fields and verification steps are required
          </p>
        </div>
        <span className="text-xs px-2 py-1 bg-muted rounded text-muted-foreground font-medium shrink-0">
          Read Only
        </span>
      </div>
      
      <div className="space-y-4 sm:space-y-5">

      {/* Required Fields */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Company Fields</Label>
        <div className="space-y-2 pl-1">
          {AVAILABLE_FIELDS.map((field) => (
            <div key={field.id} className="flex items-center space-x-3 opacity-60">
              <Checkbox
                id={field.id}
                checked={true}
                disabled
              />
              <Label
                htmlFor={field.id}
                className="text-sm font-normal flex-1"
              >
                {field.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 text-xs text-muted-foreground bg-muted/20 p-2 rounded">
        {AVAILABLE_FIELDS.length} field(s) required
      </div>
      </div>
    </div>
  );
}

