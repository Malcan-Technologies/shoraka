"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useApprovedContracts } from "@/hooks/use-contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * FINANCING STRUCTURE STEP
 *
 * This step lets users choose how they want to apply for financing:
 * 1. Submit a new contract - User will fill contract details in next step
 * 2. Use an existing contract - Select from previously approved contracts
 * 3. Invoice-only financing - Finance invoices without a contract
 *
 * Props:
 * - applicationId: ID of the current application
 * - onDataChange: callback to pass selected structure to parent
 */

type FinancingStructureType = "new_contract" | "existing_contract" | "invoice_only";

interface FinancingStructureStepProps {
  applicationId: string;
  onDataChange?: (data: any) => void;
}

export function FinancingStructureStep({
  applicationId,
  onDataChange,
}: FinancingStructureStepProps) {
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const { data: approvedContracts = [] } = useApprovedContracts(
    application?.issuer_organization_id || ""
  );

  // Track selected structure type
  const [selectedStructure, setSelectedStructure] = React.useState<FinancingStructureType | null>(
    null
  );

  // Track selected existing contract ID
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");

  // Track if we loaded data from DB yet
  const [isInitialized, setIsInitialized] = React.useState(false);

  // Stable reference for onDataChange callback
  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  /**
   * LOAD SAVED DATA FROM DATABASE
   */
  React.useEffect(() => {
    if (!application || isInitialized) return;

    const savedData = application.financing_structure as any;

    if (savedData?.structure_type) {
      setSelectedStructure(savedData.structure_type);
      if (savedData.existing_contract_id) {
        setSelectedContractId(savedData.existing_contract_id);
      }
    }

    setIsInitialized(true);
  }, [application, isInitialized]);

  /**
   * NOTIFY PARENT WHEN DATA CHANGES
   */
  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;

    const dataToSave = {
      structure_type: selectedStructure,
      existing_contract_id: selectedStructure === "existing_contract" ? selectedContractId : null,
    };

    // If existing contract is selected, provide the details for autofill
    let additionalData = {};
    if (selectedStructure === "existing_contract" && selectedContractId) {
      const contract = approvedContracts.find((c: any) => c.id === selectedContractId);
      if (contract) {
        additionalData = {
          autofillContract: {
            contract_details: contract.contract_details,
            customer_details: contract.customer_details,
          },
        };
      }
    }

    // Check if selection is valid to proceed
    const isValid =
      selectedStructure !== null &&
      (selectedStructure !== "existing_contract" || selectedContractId !== "");

    onDataChangeRef.current({
      ...dataToSave,
      ...additionalData,
      isValid,
    });
  }, [selectedStructure, selectedContractId, isInitialized, approvedContracts]);

  /**
   * Handle structure type selection
   */
  const handleStructureSelect = (type: FinancingStructureType) => {
    setSelectedStructure(type);
    // Clear contract selection if switching away from existing_contract
    if (type !== "existing_contract") {
      setSelectedContractId("");
    }
  };

  /**
   * Handle existing contract selection
   */
  const handleContractSelect = (contractId: string) => {
    setSelectedContractId(contractId);
    // Also select this option when choosing a contract
    if (selectedStructure !== "existing_contract") {
      setSelectedStructure("existing_contract");
    }
  };

  // Loading state
  if (isLoadingApp) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Option 1: Submit a new contract */}
      <OptionCard
        title="Submit a new contract"
        description="My invoice is under a contract that hasn't been approved by Cashsouk"
        isSelected={selectedStructure === "new_contract"}
        onClick={() => handleStructureSelect("new_contract")}
      />

      {/* Option 2: Use an existing contract */}
      <OptionCard
        title="Use an existing contract"
        description="My invoice is under a contract already approved by Cashsouk"
        isSelected={selectedStructure === "existing_contract"}
        onClick={() => handleStructureSelect("existing_contract")}
        rightContent={
          <Select value={selectedContractId} onValueChange={handleContractSelect}>
            <SelectTrigger
              className="w-[280px]"
              onClick={(e) => {
                e.stopPropagation();
                // Also select this option when clicking the dropdown
                if (selectedStructure !== "existing_contract") {
                  handleStructureSelect("existing_contract");
                }
              }}
            >
              <SelectValue placeholder="Select an existing contracts" />
            </SelectTrigger>
            <SelectContent>
              {approvedContracts.map((contract: any) => (
                <SelectItem key={contract.id} value={contract.id}>
                  {(contract.contract_details as any)?.title || "Untitled Contract"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/* Option 3: Invoice-only financing */}
      <OptionCard
        title="Invoice-only financing"
        description="I want to finance my invoice(s) without a contract"
        isSelected={selectedStructure === "invoice_only"}
        onClick={() => handleStructureSelect("invoice_only")}
      />
    </div>
  );
}

/**
 * OPTION CARD COMPONENT
 *
 * A selectable card with radio-style indicator
 */
interface OptionCardProps {
  title: string;
  description: string;
  isSelected: boolean;
  onClick: () => void;
  rightContent?: React.ReactNode;
}

function OptionCard({ title, description, isSelected, onClick, rightContent }: OptionCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "w-full text-left rounded-xl border-2 p-5 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20",
        "hover:border-primary/50",
        isSelected ? "border-primary bg-background" : "border-border bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Radio indicator */}
          <div className="mt-0.5 shrink-0">
            <div
              className={cn(
                "h-5 w-5 rounded-full border-2 flex items-center justify-center",
                isSelected ? "border-primary" : "border-muted-foreground/40"
              )}
            >
              {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
            </div>
          </div>

          {/* Text content */}
          <div className="space-y-1">
            <div className="text-base font-semibold text-foreground">{title}</div>
            <div className="text-sm text-muted-foreground">{description}</div>
          </div>
        </div>

        {/* Right content (e.g., dropdown) */}
        {rightContent && <div className="shrink-0">{rightContent}</div>}
      </div>
    </div>
  );
}
