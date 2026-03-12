"use client";

/**
 * ApplicationFlowContext
 *
 * Supporting state for application flow. Does NOT replace step state.
 * Steps continue to load from the API. Draft holds unsaved UI edits and
 * temporary client-side resets only.
 */

import * as React from "react";

export type ApplicationDraft = {
  financingStructure?: {
    structure_type?: "new_contract" | "existing_contract" | "invoice_only";
    existing_contract_id?: string | null;
  };
  contractDraft?: {
    customer_details?: unknown;
    contract_details?: unknown;
  };
  financialDraft?: Record<string, unknown>;
};

export type ApplicationFlowContextValue = {
  draft: ApplicationDraft;
  updateDraft: (section: keyof ApplicationDraft, data: unknown) => void;
  resetOnStructureChange: (newStructure: string, prevStructure?: string) => void;
  clearDraftSection: (section: keyof ApplicationDraft) => void;
};

const ApplicationFlowContext = React.createContext<ApplicationFlowContextValue | null>(null);

export function useApplicationFlowContext(): ApplicationFlowContextValue {
  const ctx = React.useContext(ApplicationFlowContext);
  if (!ctx) {
    throw new Error("useApplicationFlowContext must be used within ApplicationFlowProvider");
  }
  return ctx;
}

type ApplicationFlowProviderProps = {
  children: React.ReactNode;
  application?: {
    financing_structure?: unknown;
    financial_statements?: unknown;
  } | null;
  /** Optional ref to expose resetOnStructureChange for parent callers outside the provider tree. */
  resetOnStructureChangeRef?: React.MutableRefObject<((newStructure: string, prevStructure?: string) => void) | null>;
};

/**
 * Hydrates draft from application. contractDraft is not hydrated here
 * because contract data is fetched separately by ContractDetailsStep.
 */
function hydrateDraft(application: ApplicationFlowProviderProps["application"]): ApplicationDraft {
  if (!application) return {};
  const fs = application.financing_structure as ApplicationDraft["financingStructure"] | undefined;
  const fin = application.financial_statements as Record<string, unknown> | undefined;
  return {
    financingStructure: fs ? { structure_type: fs.structure_type, existing_contract_id: fs.existing_contract_id } : undefined,
    financialDraft: fin && typeof fin === "object" ? { ...fin } : undefined,
  };
}

export function ApplicationFlowProvider({ children, application, resetOnStructureChangeRef }: ApplicationFlowProviderProps) {
  const [draft, setDraft] = React.useState<ApplicationDraft>(() => hydrateDraft(application));

  React.useEffect(() => {
    setDraft(hydrateDraft(application));
  }, [application]);

  const updateDraft = React.useCallback((section: keyof ApplicationDraft, data: unknown) => {
    setDraft((prev) => ({ ...prev, [section]: data }));
  }, []);

  const clearDraftSection = React.useCallback((section: keyof ApplicationDraft) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[section];
      return next;
    });
  }, []);

  const resetOnStructureChange = React.useCallback((newStructure: string, prevStructure?: string) => {
    setDraft((prev) => {
      const next = { ...prev };

      if (prevStructure === "new_contract" && newStructure === "invoice_only") {
        if (next.contractDraft) {
          next.contractDraft = { ...next.contractDraft, contract_details: undefined };
        }
      } else if (prevStructure === "existing_contract" && newStructure === "invoice_only") {
        if (next.financingStructure) {
          next.financingStructure = { ...next.financingStructure, existing_contract_id: null };
        }
        if (next.contractDraft) {
          next.contractDraft = { ...next.contractDraft, contract_details: undefined };
        }
      } else if (prevStructure === "invoice_only" && newStructure === "new_contract") {
        if (next.contractDraft) {
          next.contractDraft = { ...next.contractDraft, contract_details: undefined };
        }
      } else if (
        (prevStructure === "new_contract" || prevStructure === "invoice_only") &&
        newStructure === "existing_contract"
      ) {
        delete next.contractDraft;
      }

      return next;
    });
  }, []);

  React.useEffect(() => {
    if (resetOnStructureChangeRef) {
      resetOnStructureChangeRef.current = resetOnStructureChange;
      return () => {
        resetOnStructureChangeRef.current = null;
      };
    }
  }, [resetOnStructureChange, resetOnStructureChangeRef]);

  const value = React.useMemo<ApplicationFlowContextValue>(
    () => ({ draft, updateDraft, resetOnStructureChange, clearDraftSection }),
    [draft, updateDraft, resetOnStructureChange, clearDraftSection]
  );

  return (
    <ApplicationFlowContext.Provider value={value}>
      {children}
    </ApplicationFlowContext.Provider>
  );
}
