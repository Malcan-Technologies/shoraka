"use client";

import * as React from "react";
import { useApplication } from "@/hooks/use-applications";
import { useApprovedContracts, useCreateContract } from "@/hooks/use-contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Store initial DB values for dirty-check
const initialFinancingStructureRef = React.useRef<{
  structure_type: FinancingStructureType | null;
  existing_contract_id: string | null;
} | null>(null);


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

  const saved = application.financing_structure as any;

  const initialData = {
    structure_type: (saved?.structure_type ?? null) as FinancingStructureType | null,
    existing_contract_id: (saved?.existing_contract_id ?? null) as string | null,
  };

  initialFinancingStructureRef.current = initialData;

  if (initialData.structure_type) {
    setSelectedStructure(initialData.structure_type);
    if (initialData.existing_contract_id) {
      setSelectedContractId(initialData.existing_contract_id);
    }
  }

  setIsInitialized(true);
}, [application, isInitialized]);

  /**
   * NOTIFY PARENT WHEN DATA CHANGES
   */
  const createContractMutation = useCreateContract();

  const saveFunction = React.useCallback(async () => {
  if (selectedStructure === "new_contract") {
    const created = await createContractMutation.mutateAsync(applicationId);
    return created;
  }
  return null;
}, [selectedStructure, applicationId, createContractMutation]);


React.useEffect(() => {
  if (!onDataChangeRef.current || !isInitialized) return;

  const dataToSave = {
    structure_type: selectedStructure,
    existing_contract_id:
      selectedStructure === "existing_contract" ? selectedContractId : null,
  };

  let additionalData: any = {};
  if (selectedStructure === "existing_contract" && selectedContractId) {
    const contract = approvedContracts.find(
      (c: any) => c.id === selectedContractId
    );
    if (contract) {
      additionalData = {
        autofillContract: {
          contract_details: contract.contract_details,
          customer_details: contract.customer_details,
        },
      };
    }
  }

  const isValid =
    selectedStructure !== null &&
    (selectedStructure !== "existing_contract" || selectedContractId !== "");

const initial = initialFinancingStructureRef.current ?? {
  structure_type: null,
  existing_contract_id: null,
};

// normalize CURRENT to persisted shape
const currentStructure = selectedStructure ?? null;
const currentExistingContractId =
  currentStructure === "existing_contract" ? (selectedContractId || null) : null;

// normalize INITIAL to persisted shape
const initialStructure = initial.structure_type ?? null;
const initialExistingContractId =
  initialStructure === "existing_contract" ? (initial.existing_contract_id || null) : null;

const isDirty =
  currentStructure !== initialStructure ||
  currentExistingContractId !== initialExistingContractId;



  onDataChangeRef.current({
    ...dataToSave,
    ...additionalData,
    isValid,
    hasPendingChanges: isDirty,
    saveFunction, // ✅ stable reference
  });
}, [
  selectedStructure,
  selectedContractId,
  approvedContracts,
  isInitialized,
  saveFunction,
]);

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
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
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
              className="w-[280px] rounded-xl border border-border bg-background text-foreground"
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
      className="block w-full cursor-pointer focus:outline-none focus:ring-primary/20"
    >
      {/* OUTER WRAPPER — reserve border space */}
      <div className="rounded-xl border-2 border-transparent">
        {/* VISIBLE ROW */}
        <div
          className={[
            "w-full rounded-[10px] transition-colors",
            "px-6 py-[12px]",
            isSelected
              ? "border-2 border-primary"
              : "border border-border hover:border-primary/50",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4">
            {/* Left */}
            <div className="flex items-start gap-4">
              {/* Radio */}
              <div className="mt-[6px] shrink-0">
                <div
                  className={[
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center",
                    isSelected
                      ? "border-primary"
                      : "border-muted-foreground/40",
                  ].join(" ")}
                >
                  {isSelected && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              </div>

              {/* Text */}
              <div className="min-w-0 flex-1">
                <div className="text-[20px] leading-[28px] font-medium text-foreground">
                  {title}
                </div>
                <div className="text-[16px] leading-[22px] text-muted-foreground">
                  {description}
                </div>
              </div>
            </div>

            {rightContent && <div className="shrink-0">{rightContent}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
