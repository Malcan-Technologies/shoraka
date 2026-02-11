"use client";

import * as React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useApplication, useUpdateApplicationStep, useArchiveApplication, useUpdateApplicationStatus } from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getStepKeyFromStepId,
  APPLICATION_STEP_KEYS_WITH_UI,
  STEP_KEY_DISPLAY,
  type ApplicationStepKey,
} from "@cashsouk/types";
import { ProgressIndicator } from "../../components/progress-indicator";
import { useHeader, SidebarTrigger } from "@cashsouk/ui";
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
import { useQueryClient } from "@tanstack/react-query";

type ApplicationBlockReason =
  | "PRODUCT_DELETED"
  | "PRODUCT_VERSION_CHANGED"
  | null;


/**
* ============================================================
* SAVE & CONTINUE — VALIDATION & CONTROL FLOW CONTRACT
* ============================================================
*
* IMPORTANT:
* - Child step components (e.g. ContractDetailsStep) are
*   responsible for ALL field-level validation.
*
* - Validation MUST happen ONLY when the user clicks
*   "Save and Continue" (not while typing).
*
* - If validation FAILS inside a step:
*   1. The step MUST show its own toast.error(...)
*   2. The step MUST throw an Error (e.g. "VALIDATION_*")
*
* - Throwing an error is REQUIRED to:
*   - Prevent database writes
*   - Prevent navigation to the next step
*   - Prevent the "Saved successfully" toast
*
* - The parent EditApplicationPage:
*   - Treats thrown VALIDATION_* errors as a hard stop
*   - Does NOT show a success toast
*   - Does NOT advance the workflow
*
* DO NOT:
* - Rely on isValid flags alone
* - Return null / empty objects to block saving
* - Show success toasts before validation passes
*
* RULE OF THUMB:
* Toast shows the problem.
* Throw stops the system.
*
* ============================================================
 *  WRONG ASSUMPTION:
 * -------------------
 * "If I return null or {} from handleSave(), saving will stop"
 *
 * THIS IS FALSE.
 *
 * ---------------------------------------------------------------------
 *  Example 1 — return null to stop saving (WRONG)
 * ---------------------------------------------------------------------
 *
 * const handleSave = async () => {
 *   setHasSubmitted(true);
 *
 *   if (!/^\d{12}$/.test(formData.customer.ssm_number)) {
 *     toast.error("SSM number must be 12 digits");
 *     return null; //  DOES NOT STOP SAVE
 *   }
 * };
 *
 *  What developer THINKS happens:
 *   "I returned null, so saving stops"
 *
 *  What ACTUALLY happens:
 *   - await saveFunction() RESOLVES successfully
 *   - Parent continues execution
 *   - DB is updated
 *   - "Saved successfully" toast appears ❌
 *
 * ---------------------------------------------------------------------
 *  Example 2 — return {} to “skip saving” (WRONG)
 * ---------------------------------------------------------------------
 *
 * if (isContractTooShort) {
 *   toast.error("Use invoice-only financing");
 *   return {}; //  STILL RESOLVES SUCCESSFULLY
 * }
 *
 *  Why this is dangerous:
 *   - {} is a valid object
 *   - Parent merges it into payload
 *   - Save continues silently
 *   - High risk of data corruption
 *
 * ---------------------------------------------------------------------
 *  Example 3 — Relying on isValid only (WRONG)
 * ---------------------------------------------------------------------
 *
 * if (!isValid) {
 *   setIsCurrentStepValid(false);
 *   toast.error("Fix errors");
 *   return; //  DOES NOT STOP SAVE
 * }
 *
 *  Why this fails:
 *   - Parent already clicked "Save and Continue"
 *   - handleSave() still resolves
 *   - Save continues anyway
 *
 * ---------------------------------------------------------------------
 *  Example 4 — Showing toast but continuing execution (WRONG)
 * ---------------------------------------------------------------------
 *
 * if (!hasConsentDocument) {
 *   toast.error("Consent document required");
 *   //  forgot to stop execution
 * }
 *
 * Execution CONTINUES unless you THROW.
 *
 * ---------------------------------------------------------------------
 *  THE ONLY CORRECT WAY — THROW (REQUIRED)
 * ---------------------------------------------------------------------
 *
 * if (!/^\d{12}$/.test(formData.customer.ssm_number)) {
 *   toast.error("SSM number must be 12 digits");
 *   throw new Error("VALIDATION_SSM");
 * }
 *
 * ---------------------------------------------------------------------
 *  RULE OF THUMB
 * ---------------------------------------------------------------------
 * - toast.error(...) → informs the user
 * - throw Error(...) → STOPS saving, DB writes, navigation, success toast
 *
 * If you do NOT throw, saving WILL continue.
 *
 * =====================================================================
 */



/**
 * EDIT APPLICATION PAGE
 *
 * This is where users complete their application after creating it.
 *
 * URL Format: /applications/edit/[id]?step=2
 * - [id] = application ID
 * - ?step= = which step to show (1, 2, 3, etc.)
 *
 * Flow:
 * 1. Load application from DB
 * 2. Check which step user wants to see
 * 3. Validate user can access that step (can't skip ahead)
 * 4. Show the step content
 * 5. User clicks "Save and Continue"
 * 6. Save data to DB and go to next step
 */
export default function EditApplicationPage() {
  const { setTitle } = useHeader();

  React.useEffect(() => {
    setTitle("Edit Application");
  }, [setTitle]);

  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  // Get application ID from URL
  const applicationId = params.id as string;

  // Get which step user wants to see from URL
  // URL uses ?step=1, ?step=2, etc. (1-based for users)
  const stepFromUrl = parseInt(searchParams.get("step") || "1");


  // Load products to get workflow steps
  const { data: productsData, isLoading: isLoadingProducts, refetch: refetchProducts, } = useProducts({
    page: 1,
    pageSize: 100,
  });

  // Load application from DB
  const {
    data: application,
    isLoading: isLoadingApp,
    error: appError,
  } = useApplication(applicationId);

  // Handle application error (e.g. 404)
  React.useEffect(() => {
    if (appError) {
      toast.error("Application not found or access denied");
      router.push("/");
    }
  }, [appError, router]);

  // Read financing structure override from sessionStorage (live)
  React.useEffect(() => {
    const read = () => {
      const stored = sessionStorage.getItem(
        "cashsouk:financing_structure_override"
      ) as any;

      setSessionStructureType(stored);
    };

    read(); // initial read on mount
    window.addEventListener("storage", read);

    return () => {
      window.removeEventListener("storage", read);
    };
  }, []);


  // Always refetch products on step navigation
  // to detect product deletion or version changes

  React.useEffect(() => {
    if (!applicationId) return;
    refetchProducts();
  }, [stepFromUrl, applicationId, refetchProducts]);


  // //  FORCE FRESH DATA WHEN STEP CHANGES
  // React.useEffect(() => {
  //   if (!applicationId) return;

  //   refetchApplication(); // refresh application row
  //   refetchProducts();    // refresh product versions
  // }, [stepFromUrl, applicationId, refetchApplication, refetchProducts]);

  // Hook to update application step
  const updateStepMutation = useUpdateApplicationStep();

  // Hook to archive application
  const archiveApplicationMutation = useArchiveApplication();

  // Hook to update application status
  const updateStatusMutation = useUpdateApplicationStatus();
  const queryClient = useQueryClient();
  const navigationInProgressRef = React.useRef(false);
  const didRewindProgressRef = React.useRef(false);


  const [sessionStructureType, setSessionStructureType] =
    React.useState<"new_contract" | "existing_contract" | "invoice_only" | null>(null);

  /**
   * APPLICATION BLOCK REASON
   *
   * Determines whether the application can continue
   * under the currently selected product.
   *
   * - PRODUCT_DELETED: product no longer exists
   * - PRODUCT_VERSION_CHANGED: product exists but version differs
   */
  const applicationBlockReason = React.useMemo<ApplicationBlockReason>(() => {
    if (!application || !productsData) return null;

    const productId = (application.financing_type as any)?.product_id;
    if (!productId) return null;

    const product = productsData.products?.find(
      (p: any) => p.id === productId
    );

    // Product was deleted or is no longer available
    if (!product) {
      return "PRODUCT_DELETED";
    }

    // Product exists but version changed
    if (application.product_version !== product.version) {
      return "PRODUCT_VERSION_CHANGED";
    }

    return null;
  }, [application, productsData]);




  /**
   * HANDLE RESTART APPLICATION
   *
   * Archive current application and redirect to /new
   */
  const handleRestartApplication = async () => {
    try {
      // Archive current application (silently in background)
      await archiveApplicationMutation.mutateAsync(applicationId);

      // Redirect to /new page (it will create new application)
      router.push("/applications/new");
    } catch (error) {
      toast.error("Unable to restart. Please try again.");
      // Modal stays open, user can retry
    }
  };

  // Track if user has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);

  // Track if modal is open
  const [isUnsavedChangesModalOpen, setIsUnsavedChangesModalOpen] = React.useState(false);

  // Track where user wanted to go (for modal)
  const [pendingNavigation, setPendingNavigation] = React.useState<string | null>(null);

  /**
 * Selected product ID on Financing Type step.
 * This represents user intent before saving.
 */
  const [selectedProductId, setSelectedProductId] = React.useState<string | null>(null);



  // Track if we just saved and are navigating to next step
  // Store the target step number to skip validation for that step once
  const targetStepRef = React.useRef<number | null>(null);

  // Store step data from child components
  const stepDataRef = React.useRef<any>(null);


  // Track if we're currently saving to prevent onDataChange from corrupting state
  const isSavingRef = React.useRef<boolean>(false);

  /**
 * EFFECTIVE PRODUCT ID
 *
 * Determines which product the UI should be based on.
 * - Step 1: use selected product if user clicked one, otherwise fallback to saved application product
 * - Step 2+: always use saved application product
 */
  const effectiveProductId = React.useMemo(() => {
    const savedProductId = (application?.financing_type as any)?.product_id;

    if (stepFromUrl === 1) {
      return selectedProductId ?? savedProductId ?? null;
    }

    return savedProductId ?? null;
  }, [stepFromUrl, selectedProductId, application]);

  // Has the financing structure source been resolved yet?
  // - sessionStructureType !== null → user changed it this session
  // - application.financing_structure !== undefined → DB has loaded
  const isStructureResolved =
    sessionStructureType !== null ||
    application?.financing_structure?.structure_type !== undefined;



  // Decide which financing structure applies (session override > DB)
  const effectiveStructureType = React.useMemo(() => {
    // 1️⃣ If user changed structure in this session → use override
    if (sessionStructureType !== null) {
      return sessionStructureType;
    }

    // 2️⃣ Otherwise, use DB value once application is loaded
    if (application?.financing_structure?.structure_type) {
      return application.financing_structure.structure_type;
    }

    // 3️⃣ Fallback ONLY if DB not loaded yet
    return null;
  }, [sessionStructureType, application]);



  /**
   * GET FULL WORKFLOW
   */
  const productWorkflow = React.useMemo(() => {
    if (!effectiveProductId || !productsData) return [];

    const product = productsData.products?.find(
      (p: any) => p.id === effectiveProductId
    );

    return product?.workflow || [];
  }, [effectiveProductId, productsData]);

  // Apply session-based structure override to workflow (UI-only)
  const effectiveWorkflow = React.useMemo(() => {
    if (!productWorkflow.length) return [];

    // If structure not resolved yet, show full workflow
    // Only filter after user has made structure choice
    if (!isStructureResolved) return productWorkflow;

    if (
      effectiveStructureType === "existing_contract" ||
      effectiveStructureType === "invoice_only"
    ) {
      return productWorkflow.filter(
        (step: any) =>
          getStepKeyFromStepId(step.id) !== "contract_details"
      );
    }

    return productWorkflow;
  }, [productWorkflow, effectiveStructureType, isStructureResolved]);


  const isLoading = isLoadingApp || isLoadingProducts;
  const showBlockingSkeleton =
    isLoading || !application || applicationBlockReason !== null;

  const isProgressLoading = isLoadingProducts || !effectiveWorkflow.length;



  const currentStepConfig = React.useMemo(() => {
    if (!effectiveWorkflow.length) return null;
    return effectiveWorkflow[stepFromUrl - 1] ?? null;
  }, [effectiveWorkflow, stepFromUrl]);

  /**
   * FALLBACK STEP DETECTION
   * 
   * If current step is beyond the workflow (user viewing completed step),
   * try to determine which step they're viewing based on application data.
   * This allows users to review completed steps even if workflow changed.
   */
  const currentStepId = currentStepConfig?.id || "";
  const currentStepKey = React.useMemo(() => {
    // First try: get from current config
    let key = getStepKeyFromStepId(currentStepId);
    if (key) {
      return key;
    }

    // Second try: detect from application data structure
    // Check which step column has data at this position
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
      
      // Map step number (1-based) to step key
      const stepIndex = stepFromUrl - 1;
      if (stepIndex < stepSequence.length) {
        const possibleKey = stepSequence[stepIndex];
        // Check if this step has data in application
        if ((application as any)?.[possibleKey] !== undefined) {
          return possibleKey;
        }
      }
    }

    // Third try: handle admin workflow step name
    const rawKey = currentStepId.replace(/_\d+$/, "");
    if (rawKey === "verify_company_info") {
      return "company_details" as const;
    }

    return null;
  }, [currentStepId, application, stepFromUrl]);

  /**
   * Check if current step is mapped to a component
   * Step key must match Application column and have a corresponding step file.
   */
  const isStepMapped =
    currentStepKey !== null &&
    APPLICATION_STEP_KEYS_WITH_UI.includes(currentStepKey as any);


  // Get custom title/description for page display
  // Use pageTitle if available (descriptive), otherwise fall back to title, then workflow name
  const currentStepInfo = React.useMemo(() => {
    if (!currentStepKey) {
      return {
        title: effectiveWorkflow[stepFromUrl - 1]?.name || "Loading...",
        description: "Complete this step to continue",
      };
    }

    const stepDisplay = STEP_KEY_DISPLAY[currentStepKey];
    return {
      title: stepDisplay.pageTitle || stepDisplay.title,
      description: stepDisplay.description || "",
    };
  }, [currentStepKey, effectiveWorkflow, stepFromUrl]);


  /**
   * RENDER STEP COMPONENT
   *
   * Based on the step ID, render the appropriate component.
   * Each step component handles its own data and passes it to parent via onDataChange.
   */
  const renderStepComponent = () => {

    // Get product ID from application
    const financingType = application?.financing_type as any;
    const savedProductId = financingType?.product_id;

    // Match step key (Application column name) to component
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
        <CompanyDetailsStep
          applicationId={applicationId}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "declarations") {
      return (
        <DeclarationsStep
          applicationId={applicationId}
          stepConfig={currentStepConfig?.config}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "business_details") {
      return (
        <BusinessDetailsStep
          applicationId={applicationId}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "supporting_documents") {
      return (
        <SupportingDocumentsStep
          applicationId={applicationId}
          stepConfig={currentStepConfig}
          onDataChange={handleDataChange}
        />
      );
    }

    if (currentStepKey === "financing_structure") {
      return <FinancingStructureStep applicationId={applicationId} onDataChange={handleDataChange} />
    }

    if (currentStepKey === "contract_details") {
      return <ContractDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />;
    }

    if (currentStepKey === "invoice_details") {
      return <InvoiceDetailsStep applicationId={applicationId} onDataChange={handleDataChange} />;
    }

    if (currentStepKey === "review_and_submit") {
      return <ReviewAndSubmitStep applicationId={applicationId} onDataChange={handleDataChange} />;
    }

    // Placeholder for steps not yet implemented (names match Application columns)
    return <div className="text-center py-12 text-muted-foreground">Coming soon...</div>;
  };

  /**
   * RESUME LOGIC
   *
   * If user visits /applications/edit/123 without ?step=
   * Redirect them to maxAllowedStep (last_completed_step + 1, but never step 1 - that's only for /new)
   */
  React.useEffect(() => {
    if (!application || isLoadingApp) return;

    // If no step in URL, go to maxAllowedStep (but never step 1 - that's only for /new)
    if (!searchParams.get("step")) {
      const lastCompleted = application.last_completed_step || 1;
      const maxAllowedStep = lastCompleted + 1;
      // If last completed is step 1, maxAllowedStep is 2, which is correct
      // Otherwise, go to maxAllowedStep (next step they can work on)
      const targetStep = maxAllowedStep;
      router.replace(`/applications/edit/${applicationId}?step=${targetStep}`);
    }
  }, [application, applicationId, router, searchParams, isLoadingApp]);

  /**
   * STEP VALIDATION
   *
   * Prevent users from accessing invalid steps by typing URL manually
   *
   * SCENARIOS:
   *
   * 1. No step in URL (?step missing)
   *    → Resume logic redirects to maxAllowedStep (last_completed_step + 1)
   *
   * 2. Step 1 (financing type)
   *    → BLOCKED: Step 1 only available on /new page
   *    → Redirect to step 2 with error
   *
   * 3. Step beyond workflow length (e.g., workflow has 5 steps, user types ?step=10)
   *    → Redirect to max step user can access: min(maxAllowedStep, workflow.length)
   *    → maxAllowedStep = last_completed_step + 1
   *
   * 4. Skipping steps / Step beyond max allowed
   *    Example: last_completed_step=2, maxAllowedStep=3, user types ?step=4
   *    → Redirect to maxAllowedStep (last_completed_step + 1)
   *    → User must complete steps in order, cannot skip ahead
   *
   * 5. Invalid step number (< 1, e.g., ?step=0 or ?step=-1)
   *    → Redirect to maxAllowedStep (last_completed_step + 1)
   *
   * Summary:
   * - All invalid steps → redirect to maxAllowedStep (last_completed_step + 1)
   * - Beyond workflow → go to max step they can have (min(maxAllowedStep, workflow.length))
   * - maxAllowedStep = last_completed_step + 1 (the next step they can work on)
   */
  React.useEffect(() => {
    if (!application || isLoadingApp || isLoadingProducts || applicationBlockReason !== null) return;
    if (navigationInProgressRef.current) return;

    // Skip validation if there's no step in URL (resume logic will handle redirect)
    if (!searchParams.get("step")) {
      return;
    }

    // Skip validation if we just saved and are navigating to this step
    if (targetStepRef.current !== null && stepFromUrl === targetStepRef.current) {
      const lastCompleted = application.last_completed_step || 1;
      if (lastCompleted >= targetStepRef.current - 1) {
        targetStepRef.current = null;
      }
      return;
    }

    const lastCompleted = application.last_completed_step || 1;
    const maxAllowedStep = lastCompleted + 1;

    // SCENARIO 2: Step 1 is only available on /new page, never in edit mode
    if (stepFromUrl === 1) {
      toast.error("Financing type can only be selected when creating a new application");
      router.replace(`/applications/edit/${applicationId}?step=2`);
      return;
    }

    // SCENARIO 3: Step beyond workflow length but within already completed steps
    // Allow viewing previously completed steps even if workflow changed
    if (effectiveWorkflow.length > 0 && stepFromUrl > effectiveWorkflow.length) {
      // If user is trying to view a step they already completed, allow it
      if (stepFromUrl <= lastCompleted + 1) {
        // Step is within their completed range, allow viewing
        return;
      }
      // Otherwise, redirect to max step they can have
      const maxStepUserCanHave = Math.min(maxAllowedStep, effectiveWorkflow.length);
      toast.error("This step no longer exists in the workflow");
      router.replace(`/applications/edit/${applicationId}?step=${maxStepUserCanHave}`);
      return;
    }

    // SCENARIO 4: Step beyond max allowed → go to maxAllowedStep
    if (stepFromUrl > maxAllowedStep) {
      toast.error("Please complete steps in order");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowedStep}`);
      return;
    }

    // SCENARIO 5: Invalid step number (< 1) → go to maxAllowedStep
    if (stepFromUrl < 1) {
      toast.error("Invalid step number");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowedStep}`);
      return;
    }
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
    currentStepKey,
  ]);

  /**
   * UNSAVED CHANGES WARNING
   *
   * If user has unsaved changes and tries to leave:
   * - Browser back → show modal
   * - Browser refresh/close → show browser warning
   * - Click links → show modal
   */

  // Reset unsaved changes when step changes
  React.useEffect(() => {
    setHasUnsavedChanges(false);
    stepDataRef.current = null; // Clear step data when changing steps
  }, [stepFromUrl]);

  // Browser refresh/close warning
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

  // Browser back button
  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    // Use replaceState to avoid adding extra history entries
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

  // Link clicks
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

  /**
   * When user confirms they want to leave (in modal)
   */
  const handleConfirmLeave = () => {
    setHasUnsavedChanges(false);
    setIsUnsavedChangesModalOpen(false);

    // Navigate to where they wanted to go
    setTimeout(() => {
      if (pendingNavigation) {
        router.push(pendingNavigation);
        setPendingNavigation(null);
      } else if (stepFromUrl === 1) {
        // First step - go to dashboard
        router.push("/");
      } else if (stepFromUrl > 1) {
        // Any other step - go to previous step (but never step 1 - only available on /new)
        let prevStep = stepFromUrl - 1;
        // Skip step 1 entirely - go to dashboard if trying to go back to step 1
        if (prevStep === 1) {
          router.push("/");
        } else {
          router.push(`/applications/edit/${applicationId}?step=${prevStep}`);
        }
      } else {
        // Fallback
        router.push("/");
      }
    }, 0);
  };

  /**
   * Handle back button click
   *
   * Logic:
   * - If on step 1 (first step) → go to dashboard
   * - If on step 2 → skip step 1, go directly to dashboard
   * - If on step 3+ → go to previous step (but never step 1)
   * - Always check for unsaved changes first
   */
  const handleBack = () => {
    if (hasUnsavedChanges) {
      setIsUnsavedChangesModalOpen(true);
      return;
    }

    if (stepFromUrl === 1) {
      // First step - go back to dashboard
      router.push("/");
    } else if (stepFromUrl === 2) {
      // Skip step 1, go directly to dashboard
      router.push("/");
    } else if (stepFromUrl > 2) {
      // Go to previous step (but never step 1)
      let prevStep = stepFromUrl - 1;
      router.push(`/applications/edit/${applicationId}?step=${prevStep}`);
    } else {
      // Fallback - go to dashboard
      router.push("/");
    }
  };

  /**
   * SAVE AND CONTINUE
   *
   * This is called when user clicks "Save and Continue" button.
   *
   * Flow:
   * 1. Get data from current step
   * 2. Call API to save data
   * 3. Clear unsaved changes flag
   * 4. Navigate to next step
   *
   * The data is stored in stepDataRef by child step components.
   */
  const handleSaveAndContinue = async () => {

    try {
      // Set saving flag to prevent onDataChange from corrupting state
      isSavingRef.current = true;

      /**
 * HARD SAFETY GUARD — VERSION MISMATCH
 *
 * If a version mismatch exists, do NOT allow saving.
 * This guarantees the DB is never mutated with incompatible data.
 */
      if (applicationBlockReason !== null) {
        return;
      }

      // Get the data from the current step
      const rawData = stepDataRef.current;
      let dataToSave = rawData ? { ...rawData } : null;

      const structureChanged =
        currentStepKey === "financing_structure" &&
        dataToSave?.structureChanged === true;


      // Remove isValid from JSON as it's only for frontend communication
      if (dataToSave && "isValid" in dataToSave) {
        delete dataToSave.isValid;
      }

      /**
       * STEP-SPECIFIC SAVE FUNCTIONS
       *
       * Some steps need to save additional data before saving the application.
       * For example:
       * - company_details updates organization data first
       * - supporting_documents uploads files to S3 and returns updated data with S3 keys
       */
      if (dataToSave?.saveFunction) {
        const returnedData = await dataToSave.saveFunction();

        // Remove saveFunction from the data being sent to API
        delete dataToSave.saveFunction;

        // If saveFunction returns data, use it (e.g., supporting documents with S3 keys)
        if (returnedData) {
          // Remove isValid from returned data if present
          if (
            typeof returnedData === "object" &&
            returnedData !== null &&
            "isValid" in returnedData
          ) {
            delete (returnedData as any).isValid;
          }

          // For supporting documents, the returned data IS the complete categories structure
          // We need to wrap it in supporting_documents key
          if (currentStepKey === "supporting_documents") {
            dataToSave = {
              supporting_documents: returnedData,
            };
          } else if (currentStepKey === "invoice_details" && returnedData?.supporting_documents) {
            // Persist invoice documents snapshot into application supporting_documents
            dataToSave = {
              supporting_documents: returnedData.supporting_documents,
            };
          } else {
            // For other steps, merge normally
            dataToSave = { ...dataToSave, ...returnedData };
          }
        }
      }

      // Final cleanup of frontend-only properties before saving to DB
      if (dataToSave) {
        // Capture specific fields for invoice_details step before clearing dataToSave
        // (left intentionally unused while invoice changes are in progress)

        delete (dataToSave as any).hasPendingChanges;
        delete (dataToSave as any).saveFunction;
        delete (dataToSave as any).isValid;
        delete (dataToSave as any).validationError;
        delete (dataToSave as any).autofillContract;
        delete (dataToSave as any).structureChanged;
        delete (dataToSave as any).isCreatingContract;

        // If this is a special step that saves to its own table (Contract/Invoice),
        // we previously avoided sending those details back to the Application table.
        // That invoice-specific persistence (contract capacity adjustments) is intentionally
        // disabled while the invoice details UI is being reworked. Keep the payload so
        // it can be persisted via updateStepMutation instead.
        if (currentStepKey === "contract_details" || currentStepKey === "invoice_details") {
          // TODO: Previously this block updated contract.available_facility based on
          // invoice draft totals and cleared application-level invoice data (dataToSave = {}).
          // That behavior is commented out while invoices are rebuilt to avoid unintended DB changes.
          //
          // Kept for reference:
          // const financingStructure = (application as any)?.financing_structure as any;
          // const isInvoiceOnly = financingStructure?.structure_type === "invoice_only";
          // if (currentStepKey === "invoice_details" && (application as any)?.contract?.id && !isInvoiceOnly) {
          //   // ... compute newAvailableFacility and call updateContractMutation ...
          // }
          //
          // Currently we DO NOT call updateContractMutation here and we DO NOT clear dataToSave.
        }
      }

      /**
       * DECLARATIONS VALIDATION
       *
       * For declarations step, check if all boxes are checked.
       * We check the declarations array directly.
       */
      if (currentStepId === "declarations_1") {
        const declarations = dataToSave?.declarations || [];
        const allChecked = declarations.every((d: any) => d.checked === true);

        if (!allChecked || declarations.length === 0) {
          toast.error("Please check all declarations to continue");
          return;
        }
      }

      // For now, we're using placeholder data
      // Later, step components will update stepDataRef with real data
      if (dataToSave === null) {
        // No data yet - just navigate for now
        toast.success("Step completed");
        setHasUnsavedChanges(false);
        router.push(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`);
        return;
      }

      // After computing nextStep
      let nextStep = stepFromUrl + 1;
      didRewindProgressRef.current = structureChanged;



      // Clear live structure override once user commits
      // if (currentStepKey === "financing_structure") {
      // sessionStorage.removeItem("cashsouk:financing_structure_override");
      // setSessionStructureType(null);

      // }




      targetStepRef.current = nextStep;

      // If this is the final submission, use updateStatusMutation
      if (currentStepKey === "review_and_submit") {
        // First, update last_completed_step to reflect review_and_submit completion
        await updateStepMutation.mutateAsync({
          id: applicationId,
          stepData: {
            stepId: currentStepId,
            stepNumber: stepFromUrl,
            data: {},
          },
        });

        // Then submit the application
        await updateStatusMutation.mutateAsync({
          id: applicationId,
          status: "SUBMITTED",
        });

        setHasUnsavedChanges(false);
        toast.success("Application submitted successfully!");
        router.push("/");
        return;
      }

      if (
        currentStepKey === "financing_structure" &&
        structureChanged === false
      ) {
        // Just move forward, no DB write
        setHasUnsavedChanges(false);
        router.push(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`);
        return;
      }

      // Call API to save step data
      // DEBUG: log nextStep and payload before API call
      // eslint-disable-next-line no-console
      const stepPayload: any = {
        stepId: currentStepId,
        stepNumber: nextStep - 1,
        data: dataToSave,
      };

      if (structureChanged) {
        stepPayload.forceRewindToStep = stepFromUrl;
      }

      await updateStepMutation.mutateAsync({
        id: applicationId,
        stepData: stepPayload,
      });

      // Backend now handles all contract linking/unlinking logic atomically
      // No need for frontend to call separate unlink mutation




      // Success! Clear unsaved changes and navigate
      setHasUnsavedChanges(false);
      toast.success("Saved successfully");

      // Invalidate relevant queries to ensure fresh data on next render
      // The backend mutation is atomic, so we trust it completed successfully
      await queryClient.invalidateQueries({ queryKey: ["application", applicationId] });

      // For financing_structure step, also invalidate contract-related queries
      if (currentStepKey === "financing_structure") {
        const currentContractId = (application as any)?.contract?.id;
        if (currentContractId) {
          await queryClient.invalidateQueries({ queryKey: ["contract", currentContractId] });
        }
        // Invalidate the contracts list to ensure it reflects any changes
        await queryClient.invalidateQueries({ queryKey: ["contracts"] });
      }

      // Go to next step
      navigationInProgressRef.current = true;
      // Clear flag after a short delay to allow navigation to stabilise
      setTimeout(() => {
        navigationInProgressRef.current = false;
      }, 3000);
      const navigationStep = didRewindProgressRef.current
        ? stepFromUrl + 1
        : nextStep;

      didRewindProgressRef.current = false;

      // Clear override immediately before navigation to prevent state inconsistency
      if (currentStepKey === "financing_structure") {
        sessionStorage.removeItem("cashsouk:financing_structure_override");
        setSessionStructureType(null);
      }

      router.push(`/applications/edit/${applicationId}?step=${navigationStep}`);


    } catch (error) {
      // Validation errors already showed their own toast
      if (error instanceof Error && error.message.startsWith("VALIDATION_")) {
        return;
      }

      toast.error("Failed to save. Please try again.");
    } finally {
      // Clear saving flag
      isSavingRef.current = false;
    }
  };

  /**
   * Track if current step is valid
   * Some steps (like supporting documents) need all fields filled before saving
   */
  const [isCurrentStepValid, setIsCurrentStepValid] = React.useState(true);

  /**
   * Callback for step components to pass data to parent
   *
   * Step components will call this when data changes:
   * onDataChange({ company_name: "ABC Corp", ... })
   *
   * Some components (like supporting documents) provide hasPendingChanges flag
   * to indicate if there are actual unsaved changes vs just initial data load
   *
   * We store it in a ref so we always have the latest data
   */
  const handleDataChange = (data: any) => {
    stepDataRef.current = data;

    /**
 * Financing Type step:
 * capture selected product ID as STATE (reactive)
 */
    if (data?.product_id) {
      setSelectedProductId(data.product_id);
    }

    // Check if step provides validation flag
    if (data?.isValid !== undefined) {
      setIsCurrentStepValid(data.isValid);
    } else if (data?.areAllFilesUploaded !== undefined) {
      setIsCurrentStepValid(data.areAllFilesUploaded);
    } else if (data?.areAllDeclarationsChecked !== undefined) {
      // Declarations step provides this flag to indicate if all boxes are checked
      setIsCurrentStepValid(data.areAllDeclarationsChecked);
    } else if (data?.isDeclarationConfirmed !== undefined) {
      // Business details step: declaration checkbox must be checked
      setIsCurrentStepValid(data.isDeclarationConfirmed);
    } else {
      // Default to valid if step doesn't provide validation
      setIsCurrentStepValid(true);
    }

    // Check if step provides pending changes flag (skip during save to prevent corruption)
    if (!isSavingRef.current) {
      if (data?.hasPendingChanges !== undefined) {
        // Use the component's flag (e.g., supporting documents knows if files are selected)
        setHasUnsavedChanges(data.hasPendingChanges);
      } else if (data) {
        // For other steps, mark as unsaved when data is passed
        setHasUnsavedChanges(true);
      }
    }
  };

  // Show loading state while fetching application
  if (showBlockingSkeleton) {
    return (
      <>
        <div className="flex flex-col h-full">
          <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Skeleton className="h-5 sm:h-6 w-28 sm:w-32" />
          </header>

          <main className="flex-1 overflow-y-auto p-3 sm:p-4">
            <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
              {/* Title skeleton */}
              <Skeleton className="h-7 sm:h-9 w-48 sm:w-64 mb-2" />
              <Skeleton className="h-4 sm:h-5 w-64 sm:w-96 mb-6 sm:mb-8" />

              {/* Progress indicator skeleton */}
              <ProgressIndicator
                steps={effectiveWorkflow.length ? effectiveWorkflow.slice(1).map((s: any) => s.name) : ["", "", "", ""]} // Hide step 1
                currentStep={stepFromUrl > 1 ? stepFromUrl - 1 : 1} // Adjust step number
                isLoading
              />


            </div>

            {/* Divider */}
            <div className="h-px bg-border w-full mt-6" />

            {/* Content skeleton */}
            <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6">
              <Skeleton className="h-64 sm:h-96 w-full" />
            </div>

          </main>

          <footer className="sticky bottom-0 border-t bg-background">
            <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
              <Skeleton className="h-11 sm:h-12 w-full sm:w-32 rounded-xl order-2 sm:order-1" />
              <Skeleton className="h-11 sm:h-12 w-full sm:w-48 rounded-xl order-1 sm:order-2" />
            </div>
          </footer>
        </div>

        <Dialog open={applicationBlockReason !== null} onOpenChange={() => { }}>
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
                    The financing product used for this application has been removed
                    and is no longer available. To continue, please start a new
                    application with a different product.
                  </>
                ) : (
                  <>
                    This financing product has been updated with new requirements.
                    To continue, you’ll need to restart your application using the
                    latest version.
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
                {archiveApplicationMutation.isPending
                  ? "Restarting..."
                  : "Start New Application"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </>
    );
  }

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
            steps={effectiveWorkflow.slice(1).map((s: any) => s.name)} // Hide step 1 (financing type)
            currentStep={stepFromUrl > 1 ? stepFromUrl - 1 : 1} // Adjust step number since we're hiding step 1
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
          {/* Back button */}
          <Button
            variant="outline"
            onClick={handleBack}
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-2 sm:order-1 h-11"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>

          {/* Continue button */}
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
            <Button
              variant="destructive"
              onClick={handleConfirmLeave}
              className="h-11"
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
