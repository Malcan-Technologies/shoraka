"use client";

/** Imports
 *
 * What: Financing structure step and shared UI pieces.
 * Why: Provide the three structure choices and keep the selection card UI consistent with Financing Type.
 * Data: Uses application data + approved contracts list; emits `{ structure_type, existing_contract_id }` to parent.
 */
import * as React from "react";
import type { Contract } from "@cashsouk/types";
import { useApplication } from "@/hooks/use-applications";
import { useInvoicesByApplication } from "@/hooks/use-invoices";
import { useApprovedContracts } from "@/hooks/use-contracts";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applicationFlowStepHorizontalClassName,
  formInputDisabledClassName,
  formSelectTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { cn } from "@/lib/utils";
import { SelectionCard } from "@/app/(application-flow)/applications/components/selection-card";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { FinancingStructureSkeleton } from "@/app/(application-flow)/applications/components/financing-structure-skeleton";

/**
 * FINANCING STRUCTURE STEP
 *
 * This step lets users choose how they want to apply for financing:
 * 1. Submit a new contract - User will fill contract details in next step
 * 2. Use an existing contract - Select from previously approved contracts
 * 3. Invoice-only financing - Finance invoices without a contract
 *
 * Changing structure is a branch reset: invoices / draft contract data are cleared on save.
 */

type FinancingStructureType = "new_contract" | "existing_contract" | "invoice_only";

interface FinancingStructureStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function FinancingStructureStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancingStructureStepProps) {
  const devTools = useDevTools();

  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const { data: invoices = [], isLoading: isLoadingInvoices } = useInvoicesByApplication(applicationId);
  const { data: approvedContracts = [] } = useApprovedContracts(
    application?.issuer_organization_id || ""
  );
  const hasApprovedContracts = approvedContracts.length > 0;

  const [selectedStructure, setSelectedStructure] = React.useState<FinancingStructureType>(
    "new_contract"
  );
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [branchResetConfirmOpen, setBranchResetConfirmOpen] = React.useState(false);
  const branchResetResolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    if (!application || isInitialized) return;

    const savedData = application.financing_structure as
      | Record<string, unknown>
      | null
      | undefined;

    const initialType = (savedData?.structure_type as FinancingStructureType | undefined) ?? "new_contract";
    const initialContractId = (savedData?.existing_contract_id as string | undefined) ?? "";

    setSelectedStructure(initialType);
    setSelectedContractId(initialContractId);

    setIsInitialized(true);
  }, [application, isInitialized]);

  React.useEffect(() => {
    const data = devTools?.autoFillDataMap?.["financing_structure"] as
      | { structure_type?: string; existing_contract_id?: string | null }
      | undefined;
    if (!data?.structure_type) return;
    const type = data.structure_type as FinancingStructureType;
    const contractId = data.structure_type === "existing_contract" ? (data.existing_contract_id ?? "") : "";
    if (type === "existing_contract" && !contractId) return;
    setSelectedStructure(type);
    setSelectedContractId(contractId);
    devTools?.clearAutoFillForStep("financing_structure");
  }, [devTools]);

  React.useEffect(() => {
    if (!onDataChangeRef.current || !isInitialized) return;

    const dataToSave = {
      structure_type: selectedStructure,
      existing_contract_id: selectedStructure === "existing_contract" ? selectedContractId : null,
    };

    let additionalData: Record<string, unknown> = {};
    if (selectedStructure === "existing_contract" && selectedContractId) {
      const contract = approvedContracts.find((c: Contract) => c.id === selectedContractId);
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
      selectedStructure !== "existing_contract" || selectedContractId !== "";

    const savedStructure = application?.financing_structure as Record<string, unknown> | null | undefined;
    const savedType = (savedStructure?.structure_type as FinancingStructureType | undefined) ?? "new_contract";
    const savedContractId = (savedStructure?.existing_contract_id as string | undefined) ?? "";

    const structureChanged =
      savedType !== selectedStructure ||
      (selectedStructure === "existing_contract" &&
        savedContractId !== selectedContractId);

    const hasPendingChanges = Boolean(structureChanged);
    
    // First-time saves must go through even if structureChanged=false,
    // so the step gets marked as completed in the DB.
    const hasBeenSavedBefore = Boolean(savedStructure);
    const linkedContractId = (
      application as { contract_id?: string | null } | null | undefined
    )?.contract_id;
    const hasBranchDataToClear = invoices.length > 0 || Boolean(linkedContractId);
    const needsBranchResetConfirm = structureChanged && hasBranchDataToClear;

    const confirmBranchReset = async () => {
      if (!needsBranchResetConfirm) return;
      const confirmed = await new Promise<boolean>((resolve) => {
        branchResetResolveRef.current = resolve;
        setBranchResetConfirmOpen(true);
      });
      if (!confirmed) {
        throw new Error("VALIDATION_CANCELLED");
      }
    };

    onDataChangeRef.current({
      ...dataToSave,
      ...additionalData,
      isValid,
      hasPendingChanges,
      structureChanged,
      hasBeenSavedBefore,
      ...(needsBranchResetConfirm ? { saveFunction: confirmBranchReset } : {}),
    });
  }, [
    selectedStructure,
    selectedContractId,
    approvedContracts,
    isInitialized,
    application,
    invoices.length,
  ]);

  const handleStructureSelect = (type: FinancingStructureType) => {
    setSelectedStructure(type);
    sessionStorage.setItem("cashsouk:financing_structure_override", type);
    window.dispatchEvent(new Event("storage"));

    if (type !== "existing_contract") {
      setSelectedContractId("");
    }
  };

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

  const handleBranchResetConfirmOpenChange = (open: boolean) => {
    setBranchResetConfirmOpen(open);
    if (!open && branchResetResolveRef.current) {
      branchResetResolveRef.current(false);
      branchResetResolveRef.current = null;
    }
  };

  if (isLoadingApp || isLoadingInvoices || devTools?.showSkeletonDebug) {
    return <FinancingStructureSkeleton />;
  }

  return (
    <>
      <div className={applicationFlowStepHorizontalClassName}>
        <div className="space-y-3">
          <SelectionCard
            title="Submit a new contract"
            description="My invoice is under a contract that hasn't been approved by Cashsouk"
            isSelected={selectedStructure === "new_contract"}
            onClick={readOnly ? () => {} : () => handleStructureSelect("new_contract")}
            disabled={readOnly}
          />

          <SelectionCard
            title="Use an existing contract"
            description="My invoice is under a contract already approved by Cashsouk"
            isSelected={selectedStructure === "existing_contract"}
            onClick={readOnly ? () => {} : () => handleStructureSelect("existing_contract")}
            disabled={readOnly}
            trailing={
              hasApprovedContracts ? (
                <Select value={selectedContractId} onValueChange={handleContractSelect} disabled={readOnly}>
                  <SelectTrigger
                    className={cn(
                      formSelectTriggerClassName,
                      "w-[280px]",
                      readOnly && formInputDisabledClassName
                    )}
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
                    {approvedContracts.map((contract: Contract) => (
                      <SelectItem key={contract.id} value={contract.id}>
                        {contract.contract_details?.title ?? "Untitled Contract"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div
                  className="w-[280px] rounded-md border border-dashed border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
                  onClick={(e) => e.stopPropagation()}
                >
                  No existing contracts
                </div>
              )
            }
          />

          <SelectionCard
            title="Invoice-only financing"
            description="I want to finance my invoice(s) without a contract"
            isSelected={selectedStructure === "invoice_only"}
            onClick={readOnly ? () => {} : () => handleStructureSelect("invoice_only")}
            disabled={readOnly}
          />
        </div>
      </div>

      <ConfirmDialog
        open={branchResetConfirmOpen}
        onOpenChange={handleBranchResetConfirmOpenChange}
        title="Change financing structure?"
        description="This will remove invoices and contract details entered for the current structure, including uploaded files. Other application steps are kept. This can't be undone."
        confirmText="Change structure"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={async () => {
          branchResetResolveRef.current?.(true);
          branchResetResolveRef.current = null;
          setBranchResetConfirmOpen(false);
        }}
      />
    </>
  );
}
