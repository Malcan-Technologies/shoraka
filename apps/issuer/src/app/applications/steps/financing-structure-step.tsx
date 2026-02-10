"use client";

/** Imports
 *
 * What: Financing structure step and shared UI pieces.
 * Why: Provide the three structure choices and keep the selection card UI consistent with Financing Type.
 * Data: Uses application data + approved contracts list; emits `{ structure_type, existing_contract_id }` to parent.
 */
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
import { formSelectTriggerClassName } from "@/app/applications/components/form-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectionCard } from "@/app/applications/components/selection-card";

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
  /** Local state
   *
   * What: Tracks user selection and initialization from DB.
   * Why: Parent saves only on Save and Continue; we still need immediate UI updates.
   * Data: `selectedStructure` is `"new_contract" | "existing_contract" | "invoice_only" | null`.
   *       `selectedContractId` is a contract id string when `existing_contract`.
   */
  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const { data: approvedContracts = [] } = useApprovedContracts(
    application?.issuer_organization_id || ""
  );

  /** Local state
   *
   * What: Selected structure type.
   * Why: Drives selected card styling and validation.
   * Data: `FinancingStructureType | null`.
   */
  const [selectedStructure, setSelectedStructure] = React.useState<FinancingStructureType | null>(
    null
  );

  /** Local state
   *
   * What: Selected contract id for existing contract path.
   * Why: Required for validity when `structure_type === "existing_contract"`.
   * Data: string id.
   */
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");

  /** Local state
   *
   * What: One-time initialization flag.
   * Why: Prevent overwriting user changes on data refresh.
   * Data: boolean.
   */
  const [isInitialized, setIsInitialized] = React.useState(false);

  /** Refs
   *
   * What: Stable callback ref for `onDataChange`.
   * Why: Avoid effect re-runs when parent passes a new function identity.
   * Data: `onDataChange?: (data: any) => void`.
   */
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
  const createContractMutation = useCreateContract();

  React.useEffect(() => {

    if (!onDataChangeRef.current || !isInitialized) return;

    const dataToSave = {
      structure_type: selectedStructure,
      existing_contract_id: selectedStructure === "existing_contract" ? selectedContractId : null,
    };

    // If existing contract is selected, provide the details for autofill
    let additionalData: any = {};
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

    // Save function: create contract when user selected "new_contract"
    const saveFunction = async () => {
      if (selectedStructure === "new_contract") {
        await createContractMutation.mutateAsync(applicationId);
        return null;
      }
      return null;
    };

    const savedStructure = application?.financing_structure as any;

  // Check if user made changes from what's in DB
  const structureChanged =
    !savedStructure ||  // No saved data yet (first time) → need to save
    savedStructure.structure_type !== selectedStructure ||  // Structure type changed
    (
      selectedStructure === "existing_contract" &&
      savedStructure.existing_contract_id !== selectedContractId  // Contract ID changed
    );

  const hasPendingChanges = structureChanged;




    onDataChangeRef.current({
      ...dataToSave,
      ...additionalData,
      isValid,
      saveFunction,
      hasPendingChanges,
      structureChanged,
      isCreatingContract: createContractMutation.isPending,
    });

  }, [selectedStructure, selectedContractId, approvedContracts, isInitialized, createContractMutation.isPending, applicationId, createContractMutation, application]);

  /**
   * Handle structure type selection
   */
  const handleStructureSelect = (type: FinancingStructureType) => {
    setSelectedStructure(type);

    sessionStorage.setItem(
      "cashsouk:financing_structure_override",
      type
    );
    window.dispatchEvent(new Event("storage"));

    if (type !== "existing_contract") {
      setSelectedContractId("");
    }
  };


  /**
   * Handle existing contract selection
   */
  const handleContractSelect = (contractId: string) => {
    setSelectedContractId(contractId);

    if (selectedStructure !== "existing_contract") {
      setSelectedStructure("existing_contract");
    }

    sessionStorage.setItem(
      "cashsouk:financing_structure_override",
      "existing_contract"
    );
    window.dispatchEvent(new Event("storage"));
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

  /** Render blocks
   *
   * What: Three selectable cards.
   * Why: Matches Financing Type card layout while keeping a radio-style indicator.
   * Data: Selected value is kept in local state; parent receives validity + saveFunction via effect.
   */
  return (
    <div className="px-3">
      <div className="space-y-4">
        {/* Option 1: Submit a new contract */}
        <SelectionCard
          title="Submit a new contract"
          description="My invoice is under a contract that hasn't been approved by Cashsouk"
          isSelected={selectedStructure === "new_contract"}
          onClick={() => handleStructureSelect("new_contract")}
        />

        {/* Option 2: Use an existing contract */}
        <SelectionCard
          title="Use an existing contract"
          description="My invoice is under a contract already approved by Cashsouk"
          isSelected={selectedStructure === "existing_contract"}
          onClick={() => handleStructureSelect("existing_contract")}
          trailing={
            <Select value={selectedContractId} onValueChange={handleContractSelect}>
              <SelectTrigger
                className={formSelectTriggerClassName + " w-[280px]"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedStructure !== "existing_contract") {
                    handleStructureSelect("existing_contract");
                  }
                }}
              >
                <SelectValue placeholder="Select an existing contract" />
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
        <SelectionCard
          title="Invoice-only financing"
          description="I want to finance my invoice(s) without a contract"
          isSelected={selectedStructure === "invoice_only"}
          onClick={() => handleStructureSelect("invoice_only")}
        />
      </div>
    </div>
  );
}

