"use client";

/** Imports
 *
 * What: Financing goal step and shared UI pieces.
 * Why: Let issuers pick a clear goal without seeing internal structure labels.
 * Data: Uses application data + approved contracts list; emits `{ structure_type, existing_contract_id }` to parent.
 */
import * as React from "react";
import type { Contract } from "@cashsouk/types";
import {
  buildBranchResetDescription,
  buildFinancingJourneySummary,
  facilityChooserRemaining,
  LEFT_ON_CONTRACT_HELPER,
  LEFT_ON_CONTRACT_LABEL,
  LEFT_TO_DRAW_HELPER,
  LEFT_TO_DRAW_LABEL,
  listFinancingGoalChoices,
  NO_APPROVED_FACILITY_COPY,
  resolveInitialFinancingGoal,
  SET_UP_FACILITY_INSTEAD_COPY,
  type FinancingJourneySummary,
  type FinancingStructureType,
} from "@cashsouk/types";
import {
  BanknotesIcon,
  BuildingLibraryIcon,
  DocumentTextIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
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
import { Button } from "@/components/ui/button";
import {
  applicationFlowStepHorizontalClassName,
  formInputDisabledClassName,
  formSelectTriggerClassName,
} from "@/app/(application-flow)/applications/components/form-control";
import { cn } from "@/lib/utils";
import { SelectionCard } from "@/app/(application-flow)/applications/components/selection-card";
import { useDevTools } from "@/app/(application-flow)/applications/components/dev-tools-context";
import { FinancingStructureSkeleton } from "@/app/(application-flow)/applications/components/financing-structure-skeleton";
import { EXISTING_CONTRACT_PREFILL_STORAGE_KEY } from "@/lib/finance-invoice-application-href";
import { formatMoney, StatusBadge } from "@cashsouk/ui";
import { FacilityFeeDrawdownBlockedNotice } from "@/components/financing/facility-fee-drawdown-blocked";
import { resolveIssuerFacilityGate } from "@/lib/facility-enabled";
import { facilityFeeContractHref } from "@/lib/facility-fee-payment-ui";
import {
  goalRadioTabIndex,
  resolveGoalRadioTabStopId,
} from "@/app/(application-flow)/applications/lib/financing-goal-a11y";

const GOAL_ICONS = {
  new_contract: BuildingLibraryIcon,
  existing_contract: BanknotesIcon,
  invoice_only: DocumentTextIcon,
} as const;

function GoalLeadingIcon({
  type,
  isSelected,
  disabled,
}: {
  type: FinancingStructureType;
  isSelected: boolean;
  disabled: boolean;
}) {
  const Icon = GOAL_ICONS[type];
  return (
    <span
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-md",
        disabled
          ? "bg-muted text-muted-foreground"
          : isSelected
            ? "bg-primary/10 text-primary"
            : "bg-muted text-foreground"
      )}
      aria-hidden
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function FinancingJourneyPanel({ summary }: { summary: FinancingJourneySummary }) {
  return (
    <aside
      className="rounded-md border border-status-submitted-text/30 bg-status-submitted-bg px-4 py-3 space-y-2"
      aria-labelledby="financing-journey-heading"
    >
      <div className="flex items-start gap-2">
        <InformationCircleIcon
          className="mt-0.5 h-5 w-5 shrink-0 text-status-submitted-text"
          aria-hidden
        />
        <div className="min-w-0 space-y-2">
          <h3
            id="financing-journey-heading"
            className="text-base font-semibold text-status-submitted-text"
          >
            {summary.title}
          </h3>
          <p className="text-ui leading-7 text-status-submitted-text">
            <span className="font-medium">Now: </span>
            {summary.now}
          </p>
          <p className="text-ui leading-7 text-status-submitted-text">
            <span className="font-medium">After you submit: </span>
            {summary.after}
          </p>
        </div>
      </div>
    </aside>
  );
}

/**
 * FINANCING GOAL STEP
 *
 * Goal-based choices:
 * 1. Set up a new facility
 * 2. Finance an invoice from an approved facility
 * 3. Finance one invoice without a facility
 *
 * Changing the goal is a branch reset: invoices / draft facility data are cleared on save.
 */

interface FinancingStructureStepProps {
  applicationId: string;
  onDataChange?: (data: Record<string, unknown>) => void;
  readOnly?: boolean;
}

function readFacilityRemaining(contract: Contract | undefined) {
  const details = contract?.contract_details;
  return facilityChooserRemaining({
    availableFacility: details?.available_facility ?? null,
    lifetimeRemaining: details?.lifetime_remaining ?? null,
  });
}

export function FinancingStructureStep({
  applicationId,
  onDataChange,
  readOnly = false,
}: FinancingStructureStepProps) {
  const devTools = useDevTools();

  const { data: application, isLoading: isLoadingApp } = useApplication(applicationId);
  const { data: invoices = [], isLoading: isLoadingInvoices } =
    useInvoicesByApplication(applicationId);
  const { data: approvedContracts = [], isLoading: isLoadingContracts } = useApprovedContracts(
    application?.issuer_organization_id || ""
  );
  const hasApprovedContracts = approvedContracts.length > 0;
  const goalChoices = React.useMemo(
    () => listFinancingGoalChoices({ hasApprovedFacilities: hasApprovedContracts }),
    [hasApprovedContracts]
  );

  const [selectedStructure, setSelectedStructure] =
    React.useState<FinancingStructureType>("new_contract");
  const [selectedContractId, setSelectedContractId] = React.useState<string>("");
  const [fromPrefill, setFromPrefill] = React.useState(false);
  const [isInitialized, setIsInitialized] = React.useState(false);
  const [branchResetConfirmOpen, setBranchResetConfirmOpen] = React.useState(false);
  const branchResetResolveRef = React.useRef<((confirmed: boolean) => void) | null>(null);
  const radioRefs = React.useRef<Partial<Record<FinancingStructureType, HTMLDivElement | null>>>(
    {}
  );

  const onDataChangeRef = React.useRef(onDataChange);
  React.useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  React.useEffect(() => {
    if (!application || isInitialized) return;

    const savedData = application.financing_structure as Record<string, unknown> | null | undefined;

    const savedType = savedData?.structure_type as FinancingStructureType | undefined;
    const savedContractId = (savedData?.existing_contract_id as string | undefined) ?? "";
    const prefillContractId = sessionStorage.getItem(EXISTING_CONTRACT_PREFILL_STORAGE_KEY);

    const initial = resolveInitialFinancingGoal({
      savedStructureType: savedType,
      savedFacilityId: savedContractId,
      prefillFacilityId: prefillContractId,
    });
    setSelectedStructure(initial.structureType);
    setSelectedContractId(initial.facilityId);
    setFromPrefill(initial.fromPrefill);
    setIsInitialized(true);
  }, [application, isInitialized]);

  React.useEffect(() => {
    const data = devTools?.autoFillDataMap?.["financing_structure"] as
      | { structure_type?: string; existing_contract_id?: string | null }
      | undefined;
    if (!data?.structure_type) return;
    const type = data.structure_type as FinancingStructureType;
    const contractId =
      data.structure_type === "existing_contract" ? (data.existing_contract_id ?? "") : "";
    if (type === "existing_contract" && !contractId) return;
    setSelectedStructure(type);
    setSelectedContractId(contractId);
    setFromPrefill(false);
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

    const selectedFacilityEnabled =
      selectedStructure !== "existing_contract" ||
      (selectedContractId !== "" &&
        resolveIssuerFacilityGate({
          contractDetails: approvedContracts.find((c: Contract) => c.id === selectedContractId)
            ?.contract_details,
          contractStatus: approvedContracts.find((c: Contract) => c.id === selectedContractId)
            ?.status,
          facilityFeeUpfrontOutstanding: approvedContracts.find(
            (c: Contract) => c.id === selectedContractId
          )?.facilityFeeUpfrontOutstanding,
        }).canStartDrawdown);
    const isValid =
      selectedStructure !== "existing_contract" ||
      (selectedContractId !== "" && selectedFacilityEnabled);

    const savedStructure = application?.financing_structure as
      | Record<string, unknown>
      | null
      | undefined;
    const savedType =
      (savedStructure?.structure_type as FinancingStructureType | undefined) ?? "new_contract";
    const savedContractId = (savedStructure?.existing_contract_id as string | undefined) ?? "";

    const structureChanged =
      savedType !== selectedStructure ||
      (selectedStructure === "existing_contract" && savedContractId !== selectedContractId);

    const hasPendingChanges = Boolean(structureChanged);

    // First-time saves must go through even if structureChanged=false,
    // so the step gets marked as completed in the DB.
    const hasBeenSavedBefore = Boolean(savedStructure);
    const linkedContractId = (application as { contract_id?: string | null } | null | undefined)
      ?.contract_id;
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

  React.useEffect(() => {
    if (!isInitialized || hasApprovedContracts) return;
    if (selectedStructure !== "existing_contract") return;
    setSelectedStructure("new_contract");
    setSelectedContractId("");
    setFromPrefill(false);
  }, [hasApprovedContracts, isInitialized, selectedStructure]);

  const handleStructureSelect = (type: FinancingStructureType) => {
    if (type === "existing_contract" && !hasApprovedContracts) return;
    setSelectedStructure(type);
    setFromPrefill(false);
    sessionStorage.setItem("cashsouk:financing_structure_override", type);
    window.dispatchEvent(new Event("storage"));

    if (type !== "existing_contract") {
      setSelectedContractId("");
    }
  };

  const handleContractSelect = (contractId: string) => {
    const contract = approvedContracts.find((c: Contract) => c.id === contractId);
    const gate = resolveIssuerFacilityGate({
      contractDetails: contract?.contract_details,
      contractStatus: contract?.status,
      facilityFeeUpfrontOutstanding: contract?.facilityFeeUpfrontOutstanding,
    });
    if (!gate.enabled || gate.requiresFacilityFeePayment) return;
    setSelectedContractId(contractId);
    setFromPrefill(false);

    if (selectedStructure !== "existing_contract") {
      setSelectedStructure("existing_contract");
    }

    sessionStorage.setItem("cashsouk:financing_structure_override", "existing_contract");
    window.dispatchEvent(new Event("storage"));
  };

  const handleBranchResetConfirmOpenChange = (open: boolean) => {
    setBranchResetConfirmOpen(open);
    if (!open && branchResetResolveRef.current) {
      branchResetResolveRef.current(false);
      branchResetResolveRef.current = null;
    }
  };

  const journeySummary = buildFinancingJourneySummary(isInitialized ? selectedStructure : null);
  const savedStructure = application?.financing_structure as
    | Record<string, unknown>
    | null
    | undefined;
  const savedType = (savedStructure?.structure_type as FinancingStructureType | undefined) ?? null;
  const linkedContractId = (application as { contract_id?: string | null } | null | undefined)
    ?.contract_id;
  const branchResetDescription = buildBranchResetDescription({
    fromType: savedType,
    hasInvoices: invoices.length > 0,
    hasDraftFacility: Boolean(linkedContractId) && savedType !== "existing_contract",
  });

  const selectedFacility = approvedContracts.find((c: Contract) => c.id === selectedContractId);
  const remaining = readFacilityRemaining(selectedFacility);

  if (isLoadingApp || isLoadingInvoices || isLoadingContracts || devTools?.showSkeletonDebug) {
    return <FinancingStructureSkeleton />;
  }

  const enabledChoiceIds = goalChoices
    .filter((choice) => !choice.disabled)
    .map((choice) => choice.id);
  const radioTabStopId = resolveGoalRadioTabStopId(selectedStructure, enabledChoiceIds);

  const moveGoal = (direction: 1 | -1) => {
    const currentIndex = enabledChoiceIds.indexOf(selectedStructure);
    const nextIndex =
      currentIndex < 0
        ? 0
        : (currentIndex + direction + enabledChoiceIds.length) % enabledChoiceIds.length;
    const nextId = enabledChoiceIds[nextIndex];
    handleStructureSelect(nextId);
    radioRefs.current[nextId]?.focus();
  };

  const showJourney = Boolean(journeySummary) && isInitialized;

  return (
    <>
      <div className={cn(applicationFlowStepHorizontalClassName, "space-y-6")}>
        {showJourney && journeySummary ? <FinancingJourneyPanel summary={journeySummary} /> : null}

        <div
          className="space-y-3"
          role="radiogroup"
          aria-label="What would you like to do?"
          onKeyDown={(event) => {
            if (readOnly) return;
            if (event.key === "ArrowDown" || event.key === "ArrowRight") {
              event.preventDefault();
              moveGoal(1);
            }
            if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
              event.preventDefault();
              moveGoal(-1);
            }
          }}
        >
          {goalChoices.map((choice) => {
            const isExisting = choice.id === "existing_contract";
            const showFacilityContext = isExisting && selectedStructure === "existing_contract";
            const choiceDisabled = readOnly || choice.disabled;
            return (
              <div key={choice.id} className="space-y-3">
                <SelectionCard
                  title={choice.title}
                  description={
                    choice.disabled && choice.disabledReason
                      ? `${choice.description} ${choice.disabledReason}.`
                      : choice.description
                  }
                  isSelected={selectedStructure === choice.id}
                  onClick={readOnly ? () => {} : () => handleStructureSelect(choice.id)}
                  disabled={choiceDisabled}
                  leading={
                    <GoalLeadingIcon
                      type={choice.id}
                      isSelected={selectedStructure === choice.id}
                      disabled={choiceDisabled}
                    />
                  }
                  selectionRole="radio"
                  tabIndex={goalRadioTabIndex({
                    isTabStop: choice.id === radioTabStopId,
                    disabled: choiceDisabled,
                  })}
                  cardRef={(node) => {
                    radioRefs.current[choice.id] = node;
                  }}
                />
                {isExisting && choice.disabled ? (
                  <div className="rounded-md border border-border bg-muted px-3 py-3 space-y-2">
                    <p className="text-ui text-muted-foreground">{NO_APPROVED_FACILITY_COPY}.</p>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10"
                        onClick={() => handleStructureSelect("new_contract")}
                      >
                        {SET_UP_FACILITY_INSTEAD_COPY}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
                {showFacilityContext && hasApprovedContracts ? (
                  <div className="space-y-3">
                    {fromPrefill && selectedFacility ? (
                      <div className="rounded-md border border-border bg-muted/40 px-3 py-2 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-ui font-medium text-foreground">
                            {selectedFacility.contract_details?.title ?? "Untitled facility"}
                          </p>
                          <StatusBadge label="Approved" status="active" />
                        </div>
                        <p className="text-ui text-muted-foreground">
                          You started from this facility. Confirm it below, or choose a different
                          approved facility.
                        </p>
                      </div>
                    ) : null}
                    <Select
                      value={selectedContractId}
                      onValueChange={handleContractSelect}
                      disabled={readOnly}
                    >
                      <SelectTrigger
                        className={cn(
                          formSelectTriggerClassName,
                          "w-full max-w-md",
                          readOnly && formInputDisabledClassName
                        )}
                      >
                        <SelectValue placeholder="Select an approved facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedContracts.map((contract: Contract) => {
                          const gate = resolveIssuerFacilityGate({
                            contractDetails: contract.contract_details,
                            contractStatus: contract.status,
                            facilityFeeUpfrontOutstanding: contract.facilityFeeUpfrontOutstanding,
                          });
                          const title = contract.contract_details?.title ?? "Untitled facility";
                          const blocked = !gate.enabled || gate.requiresFacilityFeePayment;
                          return (
                            <SelectItem
                              key={contract.id}
                              value={contract.id}
                              disabled={blocked}
                              textValue={title}
                            >
                              <span className="flex min-w-0 flex-col">
                                <span>{title}</span>
                                {!gate.enabled ? (
                                  <span className="text-meta leading-5 text-muted-foreground">
                                    Disabled
                                    {gate.disabledReason ? ` — ${gate.disabledReason}` : ""}
                                  </span>
                                ) : gate.requiresFacilityFeePayment ? (
                                  <span className="text-meta leading-5 text-muted-foreground">
                                    Pay the upfront facility fee to start drawdowns
                                  </span>
                                ) : null}
                              </span>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedFacility ? (
                      <div className="space-y-2 text-ui text-muted-foreground">
                        {(() => {
                          const selectedGate = resolveIssuerFacilityGate({
                            contractDetails: selectedFacility.contract_details,
                            contractStatus: selectedFacility.status,
                            facilityFeeUpfrontOutstanding:
                              selectedFacility.facilityFeeUpfrontOutstanding,
                          });
                          if (selectedGate.requiresFacilityFeePayment) {
                            return (
                              <FacilityFeeDrawdownBlockedNotice
                                href={facilityFeeContractHref(selectedFacility.id)}
                              />
                            );
                          }
                          if (selectedGate.enabled) return null;
                          return (
                            <p className="text-ui text-status-action-text" role="status">
                              This facility is disabled and cannot be used for a new drawdown.
                              {selectedGate.disabledReason ? ` ${selectedGate.disabledReason}` : ""}
                            </p>
                          );
                        })()}
                        {remaining.leftToDraw != null ? (
                          <div className="space-y-0.5">
                            <p>
                              {LEFT_TO_DRAW_LABEL}: {formatMoney(remaining.leftToDraw)}
                            </p>
                            <p className="text-meta leading-5">{LEFT_TO_DRAW_HELPER}</p>
                          </div>
                        ) : null}
                        {remaining.leftOnContract != null ? (
                          <div className="space-y-0.5">
                            <p>
                              {LEFT_ON_CONTRACT_LABEL}: {formatMoney(remaining.leftOnContract)}
                            </p>
                            <p className="text-meta leading-5">{LEFT_ON_CONTRACT_HELPER}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        open={branchResetConfirmOpen}
        onOpenChange={handleBranchResetConfirmOpenChange}
        title="Change this application?"
        description={branchResetDescription}
        confirmText="Change choice"
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
