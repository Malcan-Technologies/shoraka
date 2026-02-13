"use client";

/**
 * EDIT APPLICATION PAGE
 *
 * This page implements a deterministic wizard flow with:
 * - Single source-of-truth state management (lastCompletedStepState)
 * - Stable navigation gating (no loops, no stale redirects)
 * - Clean save flow (validate → save → update cache → navigate)
 * - Consistent skeleton behavior
 * - Minimal useEffect-driven side effects
 *
 * URL Format: /applications/edit/[id]?step=2
 * - [id] = application ID
 * - ?step= = which step to show (1-based user numbering)
 *
 * Flow:
 * 1. Load application & product workflow from DB
 * 2. Derive currentStep, allowedMaxStep from stable local state
 * 3. Show skeleton if data is loading
 * 4. Validate URL step against allowed range
 * 5. User edits step and clicks "Save and Continue"
 * 6. Save handler validates, saves, updates local state, navigates
 */

import * as React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  useApplication,
  useUpdateApplicationStep,
  useArchiveApplication,
  useUpdateApplicationStatus,
} from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { toast } from "sonner";
import {
  getStepKeyFromStepId,
  APPLICATION_STEP_KEYS_WITH_UI,
  STEP_KEY_DISPLAY,
  type ApplicationStepKey,
} from "@cashsouk/types";
import { ProgressIndicator } from "../../components/progress-indicator";
import { useHeader } from "@cashsouk/ui";
import { FinancingTypeStep } from "../../steps/financing-type-step";
import { FinancingStructureStep } from "../../steps/financing-structure-step";
import { ContractDetailsStep } from "../../steps/contract-details-step";
import { InvoiceDetailsStep } from "../../steps/invoice-details-step";
import { DeclarationsStep } from "../../steps/declarations-step";
import { CompanyDetailsStep } from "../../steps/company-details-step";
import { BusinessDetailsStep } from "../../steps/business-details-step";
import { SupportingDocumentsStep } from "../../steps/supporting-documents-step";
import { ReviewAndSubmitStep } from "../../steps/review-and-submit-step";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DefaultSkeleton } from "../_components/default-skeleton";
import { useQueryClient } from "@tanstack/react-query";

/**
 * SAVE & CONTINUE VALIDATION CONTRACT
 *
 * Child step components MUST follow these rules:
 * 1. Validation happens ONLY when user clicks "Save and Continue"
 * 2. If validation fails, component shows toast.error() and THROWS
 * 3. If validation passes, component returns data object with no errors
 * 4. Throwing is REQUIRED to prevent DB writes and navigation
 *
 * Example:
 *   if (!isValid) {
 *     toast.error("Fix errors");
 *     throw new Error("VALIDATION_REQUIRED");
 *   }
 *   return { field1: value1, ... };
 */

type ApplicationBlockReason = "PRODUCT_DELETED" | "PRODUCT_VERSION_CHANGED" | null;

/**
 * ============================================================
 * WIZARD CONTROLLER STATE
 * ============================================================
 *
 * This is the core of deterministic navigation:
 * - lastCompletedStepState = source of truth for gating
 * - Updated immediately after successful save
 * - Never relies on stale react-query cache
 * - Prevents "Please complete steps in order" loops
 */
interface WizardState {
  /** Which step was last completed (0-based internal, 1-based URLs) */
  lastCompletedStep: number;
  /** Max step user can access: lastCompletedStep + 1 */
  allowedMaxStep: number;
}

export default function EditApplicationPage() {
  const { setTitle } = useHeader();
  React.useEffect(() => {
    setTitle("Edit Application");
  }, [setTitle]);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  /* ================================================================
     DATA LOADING
     ================================================================ */

  const applicationId = params.id as string;
  const stepFromUrl = parseInt(searchParams.get("step") || "1");

  /** Load application from DB */
  const {
    data: application,
    isLoading: isLoadingApp,
    error: appError,
  } = useApplication(applicationId);

  /** Load products to get workflow steps (only on mount, not on every step change) */
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });

  React.useEffect(() => {
    console.log(
      `[DATA_LOAD] App loaded: ${!!application}, Products loaded: ${!!productsData}`
    );
  }, [application, productsData]);

  /** Handle application not found */
  React.useEffect(() => {
    if (appError) {
      toast.error("Application not found or access denied");
      router.push("/");
    }
  }, [appError, router]);

  /* ================================================================
     WIZARD STATE (LOCAL SOURCE OF TRUTH)
     ================================================================ */

  /**
   * This local state is THE single source of truth for navigation gating.
   * It starts from application.last_completed_step and updates immediately
   * after successful saves, WITHOUT relying on stale react-query cache.
   */
  const [wizardState, setWizardState] = React.useState<WizardState | null>(null);

  /**
   * Flag to prevent gating logic from running during submission
   * This ensures router.replace("/") completes before any effect re-runs
   */
  const isSubmittingRef = React.useRef(false);

  /** Initialize wizard state from application data (run once) */
  React.useEffect(() => {
    console.log(
      `[WIZARD_INIT] Check: application=${!!application}, wizardState=${wizardState !== null}, status=${application?.status}`
    );
    if (!application || wizardState !== null) return;

    const lastCompleted = application.last_completed_step || 1;
    console.log(
      `[WIZARD_INIT] Setting state: lastCompleted=${lastCompleted}, allowedMax=${lastCompleted + 1}`
    );
    setWizardState({
      lastCompletedStep: lastCompleted,
      allowedMaxStep: lastCompleted + 1,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WIZARD] Initialized: lastCompleted=${lastCompleted}, allowedMax=${lastCompleted + 1}, appStatus=${application.status}`
    );
  }, [application, wizardState]);

  /* ================================================================
     FINANCING STRUCTURE HANDLING (SESSION OVERRIDE)
     ================================================================ */

  const [sessionStructureType, setSessionStructureType] =
    React.useState<"new_contract" | "existing_contract" | "invoice_only" | null>(null);

  React.useEffect(() => {
    const read = () => {
      const stored = sessionStorage.getItem(
        "cashsouk:financing_structure_override"
      ) as
        | "new_contract"
        | "existing_contract"
        | "invoice_only"
        | null;
      setSessionStructureType(stored);
    };

    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  const isStructureResolved =
    sessionStructureType !== null ||
    application?.financing_structure?.structure_type !== undefined;

  const effectiveStructureType = React.useMemo(() => {
    if (sessionStructureType !== null) return sessionStructureType;
    if (application?.financing_structure?.structure_type) {
      return application.financing_structure.structure_type;
    }
    return null;
  }, [sessionStructureType, application]);

  /* ================================================================
     PRODUCT & WORKFLOW DERIVATION
     ================================================================ */

  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);

  const effectiveProductId = React.useMemo(() => {
    const savedProductId = (
      (application?.financing_type as Record<string, unknown>)?.product_id as
        | string
        | undefined
    ) || undefined;
    if (stepFromUrl === 1) {
      return selectedProductId ?? savedProductId ?? null;
    }
    return savedProductId ?? null;
  }, [stepFromUrl, selectedProductId, application]);

  const productWorkflow = React.useMemo(() => {
    if (!effectiveProductId || !productsData?.products) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = (productsData.products as any).find((p: { id: string }) => p.id === effectiveProductId);
    return (product?.workflow as Record<string, unknown>[] | undefined) || [];
  }, [effectiveProductId, productsData]);

  /** Apply session structure override to filter workflow (UI-only) */
  const effectiveWorkflow = React.useMemo(() => {
    if (!productWorkflow.length) return [];
    if (!isStructureResolved) return productWorkflow;

    if (
      effectiveStructureType === "existing_contract" ||
      effectiveStructureType === "invoice_only"
    ) {
      return productWorkflow.filter(
        (step: Record<string, unknown>) =>
          getStepKeyFromStepId((step.id as string) || "") !== "contract_details"
      );
    }
    return productWorkflow;
  }, [productWorkflow, effectiveStructureType, isStructureResolved]);

  /* ================================================================
     BLOCK REASONS (PRODUCT DELETED/VERSION CHANGED)
     ================================================================ */

  const applicationBlockReason = React.useMemo<ApplicationBlockReason>(() => {
    if (!application || !productsData) return null;

    const productId = (application.financing_type as Record<string, unknown>)
      ?.product_id as string | undefined;
    if (!productId) return null;

    const product = ((productsData?.products as unknown) as Array<{ id: string; version: number }>)?.find((p: { id: string; version: number }) => p.id === productId);
    if (!product) return "PRODUCT_DELETED";
    if (application.product_version !== product.version)
      return "PRODUCT_VERSION_CHANGED";

    return null;
  }, [application, productsData]);

  /* ================================================================
     CURRENT STEP RESOLUTION
     ================================================================ */

  const currentStepConfig = React.useMemo(() => {
    if (!effectiveWorkflow.length) return null;
    return (effectiveWorkflow[stepFromUrl - 1] as Record<string, unknown>) ?? null;
  }, [effectiveWorkflow, stepFromUrl]);

  const currentStepId = (currentStepConfig?.id as string) || "";
  const currentStepKey = React.useMemo(() => {
    const key = getStepKeyFromStepId(currentStepId);
    if (key) return key;

    // Fallback detection from application data
    if (application && stepFromUrl > 1) {
      const stepSequence: ApplicationStepKey[] = [
        "financing_type",
        "financing_structure",
        "contract_details",
        "invoice_details",
        "company_details",
        "business_details",
        "supporting_documents",
        "declarations",
        "review_and_submit",
      ];

      const stepIndex = stepFromUrl - 1;
      if (stepIndex < stepSequence.length) {
        const possibleKey = stepSequence[stepIndex];
        if ((application as unknown as Record<string, unknown>)?.[possibleKey] !== undefined) {
          return possibleKey;
        }
      }
    }

    const rawKey = currentStepId.replace(/_\d+$/, "");
    if (rawKey === "verify_company_info") return "company_details" as const;

    return null;
  }, [currentStepId, application, stepFromUrl]);

  const isStepMapped =
    currentStepKey !== null &&
    APPLICATION_STEP_KEYS_WITH_UI.includes(
      currentStepKey as ApplicationStepKey
    );

  const currentStepInfo = React.useMemo(
    () => {
      if (!currentStepKey) {
        return {
          title: (
            ((effectiveWorkflow[stepFromUrl - 1] as Record<string, unknown>)
              ?.name as string) || "Loading..."
          ) as string,
          description: "Complete this step to continue" as string,
        };
      }
      const stepDisplay = STEP_KEY_DISPLAY[currentStepKey];
      return {
        title: (stepDisplay.pageTitle || stepDisplay.title) as string,
        description: (stepDisplay.description || "") as string,
      };
    },
    [currentStepKey, effectiveWorkflow, stepFromUrl]
  ) as { title: string; description: string };

  /* ================================================================
     STEP DATA STORAGE (REF)
     ================================================================ */

  const stepDataRef = React.useRef<Record<string, unknown> | null>(null);
  const isSavingRef = React.useRef<boolean>(false);

  /* ================================================================
     MUTATIONS
     ================================================================ */

  const updateStepMutation = useUpdateApplicationStep();
  const archiveApplicationMutation = useArchiveApplication();
  const updateStatusMutation = useUpdateApplicationStatus();

  /* ================================================================
     UNSAVED CHANGES TRACKING
     ================================================================ */

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = React.useState(false);
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHasUnsavedChanges(false);
    stepDataRef.current = null;
  }, [stepFromUrl]);

  React.useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;
    window.history.replaceState({ preventNav: true }, "", window.location.href);

    const handlePopState = () => {
      if (hasUnsavedChanges) {
        window.history.replaceState({ preventNav: true }, "", window.location.href);
        setIsUnsavedChangesModalOpen(true);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [hasUnsavedChanges]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (anchor && anchor.href && !anchor.href.includes(window.location.pathname)) {
        e.preventDefault();
        setPendingNavigation(anchor.href);
        setIsUnsavedChangesModalOpen(true);
      }
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [hasUnsavedChanges]);

  /* ================================================================
     RESUME LOGIC
     ================================================================ */

  /**
   * If user visits /applications/edit/123 without ?step=,
   * redirect to maxAllowedStep (last_completed_step + 1).
   */
  React.useEffect(() => {
    if (!application || isLoadingApp || wizardState === null) return;

    if (!searchParams.get("step")) {
      const targetStep = wizardState.allowedMaxStep;
      router.replace(`/applications/edit/${applicationId}?step=${targetStep}`);
    }
  }, [application, applicationId, router, searchParams, isLoadingApp, wizardState]);

  /* ================================================================
     NAVIGATION GATING & VALIDATION
     ================================================================ */

  /**
   * Single stable gating effect:
   * - Runs when initial data loads OR URL step changes
   * - Uses local wizardState (never stale cache)
   * - Prevents "Please complete steps in order" loops
   */
  React.useEffect(() => {
    console.log(
      `[GATING_DEPS] application=${!!application}, isLoadingApp=${isLoadingApp}, isLoadingProducts=${isLoadingProducts}, wizardState=${wizardState !== null}, step=${searchParams.get("step")}`
    );

    // SKIP gating if submission is in progress
    if (isSubmittingRef.current) {
      console.log("[GATING] Submission in progress, skipping gating");
      return;
    }

    if (!application || isLoadingApp || isLoadingProducts || applicationBlockReason !== null) return;
    if (wizardState === null) return;
    if (!searchParams.get("step")) return;

    console.log(
      `[GATING] Running gating check. App status: ${application.status}, lastCompleted: ${application.last_completed_step}`
    );

    // EARLY GUARD: Skip gating if application is already submitted
    if (application.status === "SUBMITTED") {
      console.log(
        `[GATING] Application already SUBMITTED (${application.status}), skipping gating`
      );
      return;
    }

    const maxStepInWorkflow = effectiveWorkflow.length;
    const maxAllowed = wizardState.allowedMaxStep;

    console.log(
      `[GATING] Gate check: stepFromUrl=${stepFromUrl}, allowed=${maxAllowed}, workflow=${maxStepInWorkflow}, lastCompleted=${wizardState.lastCompletedStep}`
    );

    // SCENARIO 1: Step 1 only available on /new page
    if (stepFromUrl === 1) {
      toast.error("Financing type can only be selected when creating a new application");
      router.replace(`/applications/edit/${applicationId}?step=2`);
      return;
    }

    // SCENARIO 2: Step beyond workflow but within completed steps (allow viewing)
    if (maxStepInWorkflow > 0 && stepFromUrl > maxStepInWorkflow) {
      if (stepFromUrl <= wizardState.lastCompletedStep + 1) {
        return; // Allow viewing completed steps even if workflow changed
      }
      const safeStep = Math.min(maxAllowed, maxStepInWorkflow);
      toast.error("This step no longer exists in the workflow");
      router.replace(`/applications/edit/${applicationId}?step=${safeStep}`);
      return;
    }

    // SCENARIO 3: Step beyond max allowed (skip ahead attempt)
    if (stepFromUrl > maxAllowed) {
      toast.error("Please complete steps in order");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowed}`);
      return;
    }

    // SCENARIO 4: Invalid step (< 1)
    if (stepFromUrl < 1) {
      toast.error("Invalid step number");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowed}`);
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `[WIZARD] Gate check: stepFromUrl=${stepFromUrl}, allowed=${maxAllowed}, workflow=${maxStepInWorkflow}`
    );
  }, [
    application,
    applicationId,
    stepFromUrl,
    router,
    isLoadingApp,
    isLoadingProducts,
    effectiveWorkflow,
    applicationBlockReason,
    searchParams,
    wizardState,
  ]);

  /* ================================================================
     RENDER STEP COMPONENT
     ================================================================ */

  const renderStepComponent = () => {
    const financingType = application?.financing_type as Record<string, unknown>;
    const savedProductId = (financingType?.product_id as string) || "";

    if (currentStepKey === "financing_type") {
      return (
        <FinancingTypeStep
          initialProductId={savedProductId}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "company_details") {
      return (
        <CompanyDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    if (currentStepKey === "declarations") {
      return (
        <DeclarationsStep
          applicationId={applicationId}
          stepConfig={(currentStepConfig?.config as Record<string, unknown>) || undefined}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "business_details") {
      return (
        <BusinessDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    if (currentStepKey === "supporting_documents") {
      return (
        <SupportingDocumentsStep
          applicationId={applicationId}
          stepConfig={
            (currentStepConfig as Record<string, unknown>) ||
            ({} as Record<string, unknown>)
          }
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "financing_structure") {
      return (
        <FinancingStructureStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    if (currentStepKey === "contract_details") {
      return (
        <ContractDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    if (currentStepKey === "invoice_details") {
      return (
        <InvoiceDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    if (currentStepKey === "review_and_submit") {
      return (
        <ReviewAndSubmitStep applicationId={applicationId} onDataChange={handleDataChange} />
      );
    }

    return <div className="text-center py-12 text-muted-foreground">Coming soon...</div>;
  };

  /* ================================================================
     EVENT HANDLERS
     ================================================================ */

  const handleConfirmLeave = () => {
    setHasUnsavedChanges(false);
    setIsUnsavedChangesModalOpen(false);

    setTimeout(() => {
      if (pendingNavigation) {
        router.push(pendingNavigation);
        setPendingNavigation(null);
      } else if (stepFromUrl === 1) {
        router.push("/");
      } else if (stepFromUrl > 1) {
        const prevStep = stepFromUrl - 1;
        if (prevStep === 1) {
          router.push("/");
        } else {
          router.push(`/applications/edit/${applicationId}?step=${prevStep}`);
        }
      } else {
        router.push("/");
      }
    }, 0);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedChangesModalOpen(true);
      return;
    }

    if (stepFromUrl === 1 || stepFromUrl === 2) {
      router.push("/");
    } else if (stepFromUrl > 2) {
      const prevStep = stepFromUrl - 1;
      router.push(`/applications/edit/${applicationId}?step=${prevStep}`);
    } else {
      router.push("/");
    }
  };

  const handleDataChange = React.useCallback((data: Record<string, unknown> | null) => {
    stepDataRef.current = data;

    if (data && (data.product_id as string | undefined)) {
      setSelectedProductId(data.product_id as string);
    }

    if (data?.isValid !== undefined) {
      setIsCurrentStepValid(data.isValid as boolean);
    } else if (data?.areAllFilesUploaded !== undefined) {
      setIsCurrentStepValid(data.areAllFilesUploaded as boolean);
    } else if (data?.areAllDeclarationsChecked !== undefined) {
      setIsCurrentStepValid(data.areAllDeclarationsChecked as boolean);
    } else if (data?.isDeclarationConfirmed !== undefined) {
      setIsCurrentStepValid(data.isDeclarationConfirmed as boolean);
    } else {
      setIsCurrentStepValid(true);
    }

    if (!isSavingRef.current) {
      if (data?.hasPendingChanges !== undefined) {
        setHasUnsavedChanges(data.hasPendingChanges as boolean);
      } else if (data) {
        setHasUnsavedChanges(true);
      }
    }
  }, []);

  /* ================================================================
     SAVE & CONTINUE HANDLER
     ================================================================ */

  /**
   * Deterministic save flow:
   * 1. Validate step (throws if invalid)
   * 2. Call saveFunction if present
   * 3. Call updateStepMutation or updateStatusMutation
   * 4. Update local wizardState immediately
   * 5. Invalidate react-query cache
   * 6. Navigate to next step
   */
  const handleSaveAndContinue = async () => {
    try {
      isSavingRef.current = true;

      // Hard safety guard: version mismatch
      if (applicationBlockReason !== null) return;

      const rawData = stepDataRef.current;
      let dataToSave: Record<string, unknown> | null = rawData
        ? { ...rawData }
        : null;

      const structureChanged =
        currentStepKey === "financing_structure" &&
        (dataToSave as Record<string, unknown>)?.structureChanged === true;

      /**
       * STEP-SPECIFIC SAVE FUNCTIONS (MUST RUN BEFORE REMOVING)
       * 
       * Some steps (contract, invoice, supporting documents) have pending
       * file uploads that must happen BEFORE we delete saveFunction.
       * These functions return the fully persisted data.
       */
      const saveFunctionFromData = (
        dataToSave as Record<string, unknown>
      )?.saveFunction as (() => Promise<unknown>) | undefined;
      
      if (saveFunctionFromData) {
        const returnedData = await saveFunctionFromData();
        delete (dataToSave as Record<string, unknown>).saveFunction;

        if (returnedData) {
          if (
            typeof returnedData === "object" &&
            returnedData !== null &&
            "isValid" in returnedData
          ) {
            delete (returnedData as Record<string, unknown>).isValid;
          }

          if (currentStepKey === "supporting_documents") {
            dataToSave = { supporting_documents: returnedData };
          } else if (
            currentStepKey === "invoice_details" &&
            (returnedData as Record<string, unknown>)?.supporting_documents
          ) {
            dataToSave = {
              supporting_documents: (returnedData as Record<string, unknown>)
                .supporting_documents,
            };
          } else {
            // Merge returned data with remaining dataToSave
            dataToSave = { ...dataToSave, ...returnedData };
          }
        }
      }

      // Remove frontend-only properties AFTER saveFunction completes
      if (dataToSave) {
        delete (dataToSave as Record<string, unknown>).isValid;
        delete (dataToSave as Record<string, unknown>).hasPendingChanges;
        delete (dataToSave as Record<string, unknown>).validationError;
        delete (dataToSave as Record<string, unknown>).autofillContract;
        delete (dataToSave as Record<string, unknown>).structureChanged;
        delete (dataToSave as Record<string, unknown>).isCreatingContract;
        delete (dataToSave as Record<string, unknown>)._uploadFiles;
      }

      // DECLARATIONS validation
      if (currentStepId === "declarations_1") {
        const declarations = (
          (dataToSave as Record<string, unknown>)?.declarations as Record<string, unknown>[]
        ) || [];
        const allChecked = declarations.every(
          (d: Record<string, unknown>) => (d as Record<string, unknown>).checked === true
        );

        if (!allChecked || declarations.length === 0) {
          toast.error("Please check all declarations to continue");
          return;
        }
      }

      // No data case
      if (dataToSave === null) {
        toast.success("Step completed");
        setHasUnsavedChanges(false);
        router.replace(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`);
        return;
      }

      const nextStep = stepFromUrl + 1;

      // eslint-disable-next-line no-console
      console.log(
        `[SAVE] currentStep=${stepFromUrl}, nextStep=${nextStep}, structureChanged=${structureChanged}`
      );

      /* ============================================================
         FINAL SUBMISSION (review_and_submit)
         ============================================================ */

      if (currentStepKey === "review_and_submit") {
        try {
          console.log("[SUBMIT] Starting submission flow");
          
          // Set flag to prevent gating during submission
          isSubmittingRef.current = true;

          // Update last_completed_step
          console.log(`[SUBMIT] Updating step to ${stepFromUrl}`);
          await updateStepMutation.mutateAsync({
            id: applicationId,
            stepData: {
              stepId: currentStepId,
              stepNumber: stepFromUrl,
              data: {},
            },
          });
          console.log("[SUBMIT] Step mutation completed");

          // Set status to SUBMITTED
          console.log("[SUBMIT] Updating status to SUBMITTED");
          await updateStatusMutation.mutateAsync({
            id: applicationId,
            status: "SUBMITTED",
          });
          console.log("[SUBMIT] Status mutation completed");

          // Update cache with new status immediately (don't wait for refetch)
          queryClient.setQueryData(["application", applicationId], (oldData: any) => {
            if (!oldData) return oldData;
            console.log("[SUBMIT] Updated cache: status = SUBMITTED");
            return {
              ...oldData,
              status: "SUBMITTED",
              last_completed_step: stepFromUrl,
            };
          });

          // Update local wizard state
          if (wizardState) {
            console.log("[SUBMIT] Updating local wizardState");
            setWizardState({
              lastCompletedStep: stepFromUrl,
              allowedMaxStep: stepFromUrl + 1,
            });
          }

          setHasUnsavedChanges(false);
          toast.success("Application submitted successfully");

          // Clear any pending sessionStorage overrides to prevent gating interference
          sessionStorage.removeItem("cashsouk:next_allowed_step");
          console.log("[SUBMIT] Cleared sessionStorage override");

          // eslint-disable-next-line no-console
          console.log(`[SUBMIT] About to navigate to /`);
          console.log(`[SUBMIT] Application status is now: SUBMITTED`);

          router.replace("/");
          console.log("[SUBMIT] router.replace called");
          return;
        } catch (error) {
          console.warn("[SUBMIT] Error:", error instanceof Error ? error.message : error);
          isSubmittingRef.current = false;
          toast.error("Something went wrong. Please try again.");
          throw error;
        }
      }

      /* ============================================================
         FINANCING STRUCTURE NO-CHANGE CASE
         ============================================================ */

      if (currentStepKey === "financing_structure" && structureChanged === false) {
        setHasUnsavedChanges(false);
        router.replace(`/applications/edit/${applicationId}?step=${nextStep}`);
        return;
      }

      /* ============================================================
         STANDARD SAVE FLOW
         ============================================================ */

      const stepPayload = {
        stepId: currentStepId,
        stepNumber: nextStep - 1,
        data: dataToSave,
        ...(structureChanged && { forceRewindToStep: stepFromUrl }),
      };

      // Save to database
      await updateStepMutation.mutateAsync({
        id: applicationId,
        stepData: stepPayload,
      });

      // Update local wizard state immediately (source of truth)
      if (wizardState) {
        setWizardState({
          lastCompletedStep: stepFromUrl,
          allowedMaxStep: Math.max(wizardState.allowedMaxStep, nextStep),
        });
      }

      setHasUnsavedChanges(false);
      toast.success("Saved successfully");

      // Clear session override BEFORE navigation (if financing structure changed)
      if (currentStepKey === "financing_structure") {
        sessionStorage.removeItem("cashsouk:financing_structure_override");
        setSessionStructureType(null);
      }

      // Navigate to next step IMMEDIATELY (deterministic, no loops)
      // Do NOT invalidate queries - this causes skeleton reload flicker
      // The next page will load fresh data on mount
      const navigationStep = structureChanged ? stepFromUrl + 1 : nextStep;
      router.replace(`/applications/edit/${applicationId}?step=${navigationStep}`);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("VALIDATION_")) {
        return;
      }
      toast.error("Something went wrong. Please try again.");
    } finally {
      isSavingRef.current = false;
    }
  };

  /* ================================================================
     RESTART APPLICATION
     ================================================================ */

  const handleRestartApplication = async () => {
    try {
      await archiveApplicationMutation.mutateAsync(applicationId);
      router.push("/applications/new");
    } catch {
      toast.error("Unable to restart. Please try again.");
    }
  };

  /* ================================================================
     STEP VALIDATION STATE
     ================================================================ */

  const [isCurrentStepValid, setIsCurrentStepValid] = React.useState(true);

  /* ================================================================
     RENDER LOGIC
     ================================================================ */

  const isLoading = isLoadingApp || isLoadingProducts;
  const showBlockingSkeleton = isLoading || !application || applicationBlockReason !== null;

  if (showBlockingSkeleton) {
    return (
      <>
        <DefaultSkeleton
          steps={effectiveWorkflow
            .slice(1)
            .map(
              (s: Record<string, unknown>) =>
                (s.name as string | undefined) || ""
            )}
          currentStep={stepFromUrl > 1 ? stepFromUrl - 1 : 1}
        />

        <Dialog open={applicationBlockReason !== null} onOpenChange={() => {}}>
          <DialogContent className="[&>button]:hidden">
            <DialogHeader>
              <DialogTitle>
                {applicationBlockReason === "PRODUCT_DELETED"
                  ? "Product No Longer Available"
                  : "Product Updated"}
              </DialogTitle>
              <DialogDescription>
                {applicationBlockReason === "PRODUCT_DELETED" ? (
                  <>
                    The financing product used for this application has been removed and is no
                    longer available. To continue, please start a new application with a different
                    product.
                  </>
                ) : (
                  <>
                    This financing product has been updated with new requirements. To continue,
                    you'll need to restart your application using the latest version.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={handleRestartApplication}
                className="w-full"
                disabled={archiveApplicationMutation.isPending}
              >
                {archiveApplicationMutation.isPending ? "Restarting..." : "Start New Application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  const isProgressLoading = isLoadingProducts || !effectiveWorkflow.length;

  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
          {/* Page Title */}
          <div className="mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
              {currentStepInfo.title}
            </h1>
            <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground mt-1">
              {currentStepInfo.description}
            </p>
          </div>

          {/* Progress Indicator */}
          <ProgressIndicator
            steps={effectiveWorkflow
              .slice(1)
              .map((s: Record<string, unknown>) => (s.name as string))}
            currentStep={stepFromUrl > 1 ? stepFromUrl - 1 : 1}
            isLoading={isProgressLoading}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full" />

        {/* Step Content */}
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6">
          {renderStepComponent()}
        </div>
      </main>

      {/* Bottom buttons */}
      <footer className="sticky bottom-0 border-t bg-background">
        <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-2 sm:order-1 h-11"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button
            onClick={handleSaveAndContinue}
            disabled={
              updateStepMutation.isPending ||
              updateStatusMutation.isPending ||
              !isCurrentStepValid ||
              !isStepMapped
            }
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-1 sm:order-2 h-11"
          >
            {updateStepMutation.isPending || updateStatusMutation.isPending
              ? "Saving..."
              : currentStepKey === "review_and_submit"
                ? "Submit Application"
                : "Save and Continue"}
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </footer>

      {/* Unsaved Changes Modal */}
      <Dialog open={isUnsavedChangesModalOpen} onOpenChange={setIsUnsavedChangesModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. Are you sure you want to leave? Your changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsUnsavedChangesModalOpen(false)}
              className="h-11"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmLeave} className="h-11">
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
