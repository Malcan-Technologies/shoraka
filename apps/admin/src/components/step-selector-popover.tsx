"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PlusIcon } from "@heroicons/react/24/outline";
import {
  BuildingOfficeIcon,
  ClipboardDocumentCheckIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

export interface StepType {
  id: string;
  name: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultConfig?: Record<string, any>;
}

// Available workflow steps - Edit this array to add/remove steps
const AVAILABLE_STEPS: StepType[] = [
  {
    id: "financing_type",
    name: "Financing Type",
    description: "Select the type of financing product",
    icon: CurrencyDollarIcon,
    defaultConfig: {
      name: undefined,
      description: undefined,
      category: undefined,
      s3_key: undefined,
    },
  },
  {
    id: "financing_structure",
    name: "Financing Structure",
    description: "Choose how to apply for financing",
    icon: BuildingOfficeIcon,
    defaultConfig: {},
  },
  {
    id: "contract_details",
    name: "Contract Details",
    description: "Contract and customer information",
    icon: ClipboardDocumentCheckIcon,
    defaultConfig: {},
  },
  {
    id: "invoice_details",
    name: "Invoice Details",
    description: "Upload invoices and financing terms",
    icon: CurrencyDollarIcon,
    defaultConfig: {},
  },
  {
    id: "company_details",
    name: "Company Details",
    description: "Business verification and details",
    icon: BuildingOfficeIcon,
    defaultConfig: {
      requiredFields: [],
    },
  },
  {
    id: "supporting_documents",
    name: "Supporting Documents",
    description: "Required document uploads",
    icon: ClipboardDocumentCheckIcon,
    defaultConfig: {
      categories: [],
    },
  },
  {
    id: "declarations",
    name: "Declarations",
    description: "Terms and conditions agreement",
    icon: CheckCircleIcon,
    defaultConfig: {
      declarations: [],
    },
  },
  {
    id: "review_and_submit",
    name: "Review & Submit",
    description: "Final review before submission",
    icon: CheckCircleIcon,
    defaultConfig: {},
  },
];

interface StepSelectorPopoverProps {
  onSelect: (stepType: StepType) => void;
  existingSteps?: Array<{ name: string }>;
}

export function StepSelectorPopover({ onSelect, existingSteps = [] }: StepSelectorPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredSteps = React.useMemo(() => {
    if (!search) return AVAILABLE_STEPS;
    const lowerSearch = search.toLowerCase();
    return AVAILABLE_STEPS.filter(
      (step) =>
        step.name.toLowerCase().includes(lowerSearch) ||
        step.description?.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  const selectStep = (stepType: StepType) => {
    onSelect(stepType);
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      {/* Trigger Button */}
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-primary h-9 sm:h-8 text-xs w-full sm:w-auto justify-center">
          <PlusIcon className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">Add Step</span>
          <span className="sm:hidden">Add</span>
        </Button>
      </PopoverTrigger>

      {/* Popover Content */}
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="center" side="top">
        <div className="flex flex-col h-[400px] sm:h-[500px]">
          {/* Search Bar */}
          <div className="p-3 border-b flex-shrink-0">
            <div className="relative">
              <Input
                placeholder="Search step..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 sm:h-9 pr-8 text-sm"
              />
              {/* Search Icon */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* List of Available Steps */}
          <div className="overflow-y-auto max-h-[350px] sm:max-h-[450px]">
            {filteredSteps.length === 0 ? (
              // Empty State
              <div className="p-6 sm:p-8 text-center text-xs sm:text-sm text-muted-foreground">
                No steps found
              </div>
            ) : (
              // Step List
              <div className="p-1">
                {filteredSteps.map((step) => {
                  const Icon = step.icon;

                  // Check if this step is already added to the workflow
                  const isAlreadyAdded = existingSteps.some(
                    (existing) => existing.name.toLowerCase() === step.name.toLowerCase()
                  );

                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => !isAlreadyAdded && selectStep(step)}
                      disabled={isAlreadyAdded}
                      className={cn(
                        "w-full flex items-start gap-2 sm:gap-3 p-3 sm:p-3 rounded-md text-left transition-colors",
                        isAlreadyAdded
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary/20 active:bg-accent"
                      )}
                    >
                      {/* Step Icon */}
                      <div className={cn(
                        "mt-0.5 p-1.5 rounded-md shrink-0",
                        isAlreadyAdded ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>

                      {/* Step Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-xs sm:text-sm">{step.name}</span>
                          {isAlreadyAdded && (
                            <span className="text-xs px-1.5 sm:px-2 py-0.5 bg-muted rounded text-muted-foreground shrink-0">
                              Added
                            </span>
                          )}
                        </div>
                        {step.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {step.description}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
