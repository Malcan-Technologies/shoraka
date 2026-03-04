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
import { useAuthToken } from "@cashsouk/config";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import {
  useApplication,
  useUpdateApplicationStep,
  useUpdateApplicationStatus,
  useResubmitApplication,
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
import { AmendmentRemarkCard } from "../../components/amendment-remark-card";
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
// dialog components are used by modal components directly
import { useProductVersionGuard } from "@/hooks/use-product-version-guard";
import { VersionMismatchModal } from "@/components/VersionMismatchModal";
import { useNavigationGuard } from "@/hooks/use-navigation-guard2";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";

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

// ApplicationBlockReason removed - use guard.blockReason instead

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

  /** Initialize wizard state from application data (run once) */
  React.useEffect(() => {
    if (!application || wizardState !== null) return;

    const lastCompleted = application.last_completed_step || 1;
    setWizardState({
      lastCompletedStep: lastCompleted,
      allowedMaxStep: lastCompleted + 1,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[WIZARD] Initialized: lastCompleted=${lastCompleted}, allowedMax=${lastCompleted + 1}`
    );
  }, [application, wizardState]);

  /* ================================================================
   LOCK EDITING IF NOT DRAFT
   ================================================================ */

  /** Block edit access when status is not DRAFT or AMENDMENT_REQUESTED. */
  const isEditBlocked =
    application &&
    application.status !== "DRAFT" &&
    application.status !== "AMENDMENT_REQUESTED";

  React.useEffect(() => {
    if (!application) return;
    if (isSubmittingRef.current) return;
    if (application.status !== "DRAFT" && application.status !== "AMENDMENT_REQUESTED") {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[EDIT GUARD]", "status:", application.status);
      }
      router.replace("/applications");
    }
  }, [application, router]);

  /* ================================================================
     AMENDMENT CONTEXT LOADING (when application is in AMENDMENT_REQUESTED)
     ================================================================
  */
  const { getAccessToken } = useAuthToken();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const [amendmentContext, setAmendmentContext] = React.useState<{
    review_cycle: number;
    remarks: any[];
  } | null>(null);
  const [devPreviewAmendment, setDevPreviewAmendment] = React.useState(false);

  /** Mock amendment data for DEV preview - raw remarks (scope + scope_key only) */
  const getMockAmendmentContext = React.useCallback(() => ({
    review_cycle: (application as { review_cycle?: number })?.review_cycle ?? 1,
    remarks: [
      { scope: "section", scope_key: "contract_details", remark: "Missing contract number\nCustomer name mismatch" },
      { scope: "section", scope_key: "invoice_details", remark: "Invoice amount does not match document\nMissing supplier signature" },
      { scope: "item", scope_key: "invoice_details:0:Invoice", remark: "Invoice amount does not match document\nMissing supplier signature" },
      { scope: "section", scope_key: "supporting_documents", remark: "Upload missing Company Secretary Letter." },
      { scope: "item", scope_key: "supporting_documents:doc:financial_docs:0:Latest_Management_Account", remark: "Wrong document uploaded" },
      { scope: "item", scope_key: "supporting_documents:doc:legal_docs:0:Deed_of_Assignment", remark: "Document date expired" },
    ],
  }), [(application as { review_cycle?: number })?.review_cycle]);

  React.useEffect(() => {
    if (!application) return;

    if (devPreviewAmendment) {
      setAmendmentContext(getMockAmendmentContext() as any);
      return;
    }

    if (application.status !== "AMENDMENT_REQUESTED") {
      setAmendmentContext(null);
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const token = await getAccessToken();
        const resp = await fetch(`${API_URL}/v1/applications/${applicationId}/amendment-context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await resp.json();
        if (!mounted) return;
        if (!json.success) return;
        setAmendmentContext({ review_cycle: json.data.review_cycle, remarks: json.data.remarks });
      } catch {
        // ignore network errors
      }
    })();

    return () => {
      mounted = false;
    };
  }, [application, applicationId, getAccessToken, API_URL, devPreviewAmendment, getMockAmendmentContext]);

  /** Section-level: scope_key where scope === "section" */
  const flaggedSections = React.useMemo(() => {
    if (!amendmentContext) return new Set<string>();
    const s = new Set<string>();
    for (const r of amendmentContext.remarks || []) {
      const rem = r as { scope?: string; scope_key?: string };
      if (rem.scope === "section" && rem.scope_key) s.add(rem.scope_key);
    }
    return s;
  }, [amendmentContext]);

  /** Item-level: tab (split(":")[0]) -> Set of full scope_key */
  const flaggedItems = React.useMemo(() => {
    if (!amendmentContext) return new Map<string, Set<string>>();
    const m = new Map<string, Set<string>>();
    for (const r of amendmentContext.remarks || []) {
      const rem = r as { scope?: string; scope_key?: string };
      if (rem.scope === "item" && rem.scope_key) {
        const tab = rem.scope_key.split(":")[0];
        if (!m.has(tab)) m.set(tab, new Set());
        m.get(tab)!.add(rem.scope_key);
      }
    }
    return m;
  }, [amendmentContext]);

  /** Step keys that have amendment remarks (section or item). Used by stepper for red styling. */
  const amendmentFlaggedStepKeys = React.useMemo(() => {
    const s = new Set<string>();
    for (const k of flaggedSections) s.add(k);
    for (const k of flaggedItems.keys()) s.add(k);
    return Array.from(s);
  }, [flaggedSections, flaggedItems]);

  /** Step keys the user has acknowledged (saved). Derived from amendment_acknowledged_workflow_ids. */
  const acknowledgedWorkflowIds = React.useMemo(() => {
    const ids = (application as { amendment_acknowledged_workflow_ids?: string[] })?.amendment_acknowledged_workflow_ids ?? [];
    return Array.from(new Set(ids.map((id) => getStepKeyFromStepId(id)).filter(Boolean))) as string[];
  }, [application]);

  /** Skip financial when comparing; only check other flagged steps. */
  const allAmendmentStepsAcknowledged = amendmentFlaggedStepKeys
    .filter((step) => !step.startsWith("financial"))
    .every((step) => acknowledgedWorkflowIds.includes(step));

  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production" && application?.status === "AMENDMENT_REQUESTED") {
      console.log("[AMENDMENT][RESUBMIT_BUTTON]", {
        amendmentFlaggedStepKeys,
        acknowledgedWorkflowIds,
        allAcknowledged: allAmendmentStepsAcknowledged,
      });
    }
  }, [application?.status, amendmentFlaggedStepKeys, acknowledgedWorkflowIds, allAmendmentStepsAcknowledged]);

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

  /* ================================================================
     PRODUCT VERSION GUARD (centralized)
     ================================================================ */
  const { isMismatch, blockReason, checkNow } = useProductVersionGuard(applicationId);

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

  const isRealAmendmentMode = (application as any)?.status === "AMENDMENT_REQUESTED";
  const isAmendmentModeEffective = isRealAmendmentMode || devPreviewAmendment;

  /* ================================================================
     STEP DATA STORAGE (REF)
     ================================================================ */

  const stepDataRef = React.useRef<Record<string, unknown> | null>(null);
  const isSavingRef = React.useRef<boolean>(false);
  const isSubmittingRef = React.useRef<boolean>(false);

  /* ================================================================
     MUTATIONS
     ================================================================ */

  const updateStepMutation = useUpdateApplicationStep();
  const updateStatusMutation = useUpdateApplicationStatus();
  const resubmitMutation = useResubmitApplication();


  /* ================================================================
     UNSAVED CHANGES TRACKING
     ================================================================ */

  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  React.useEffect(() => {
    // reset unsaved state when changing steps
    setHasUnsavedChanges(false);
    stepDataRef.current = null;
  }, [stepFromUrl]);

  // Navigation guard integration
  const pendingNavRef = React.useRef<{ path: string; leavingPage: boolean } | null>(null);
  const isNavigatingRef = React.useRef(false);

  const onConfirmNavigation = React.useCallback(
    async (path: string) => {
      // Parent must reset unsaved BEFORE navigating
      setHasUnsavedChanges(false);

      const pending = pendingNavRef.current;

      // Handle back sentinel
      if (path === "__BACK__") {
        // Deterministic: always exit wizard to dashboard
        pendingNavRef.current = null;
        isNavigatingRef.current = true;
        try {
          await router.replace("/");
        } finally {
          isNavigatingRef.current = false;
        }
        return;
      }

      if (pending?.leavingPage) {
        pendingNavRef.current = null;
        isNavigatingRef.current = true;
        try {
          await router.replace(path);
        } finally {
          isNavigatingRef.current = false;
        }
      } else {
        pendingNavRef.current = null;
        isNavigatingRef.current = true;
        try {
          await router.push(path);
        } finally {
          isNavigatingRef.current = false;
        }
      }
    },
    [router]
  );

  const { isModalOpen, requestNavigation, confirmLeave, cancelLeave } = useNavigationGuard(
    hasUnsavedChanges,
    onConfirmNavigation
  );

  // Centralized safe navigation that enforces version guard precedence
  const safeNavigate = React.useCallback(
    async (path: string, opts: { leavingPage: boolean } = { leavingPage: false }) => {
      const mismatch = await checkNow();
      if (mismatch) return;

      if (!hasUnsavedChanges) {
        // No unsaved changes -> navigate immediately
        if (opts.leavingPage) {
          router.replace(path);
        } else {
          router.push(path);
        }
        return;
      }

      // Has unsaved changes -> store pending and ask guard to open modal
      pendingNavRef.current = { path, leavingPage: opts.leavingPage };
      requestNavigation(path);
    },
    [checkNow, hasUnsavedChanges, pendingNavRef, requestNavigation, router]
  );

  /* ================================================================
     RESUME LOGIC
     ================================================================ */

  /**
   * If user visits /applications/edit/123 without ?step=,
   * redirect to maxAllowedStep (last_completed_step + 1).
   */
  React.useEffect(() => {
    if (isSubmittingRef.current) return;
    if (!application || isLoadingApp || wizardState === null) return;

    if (!searchParams.get("step")) {
      const isRealAmendmentMode = (application as any)?.status === "AMENDMENT_REQUESTED";
      const isAmendmentMode = isRealAmendmentMode || devPreviewAmendment;
      const targetStep = isAmendmentMode ? 1 : wizardState.allowedMaxStep;
      // dev-only debug
      // eslint-disable-next-line no-console
      console.debug("[Amendment] initialStep", targetStep, { isAmendmentMode, lastCompletedStep: (application as any)?.last_completed_step });
      router.replace(`/applications/edit/${applicationId}?step=${targetStep}`);
    }
  }, [application, applicationId, router, searchParams, isLoadingApp, wizardState, devPreviewAmendment]);

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
    if (isSubmittingRef.current) return;
    if (!application || isLoadingApp || isLoadingProducts || isMismatch) return;
    if (wizardState === null) return;
    if (!searchParams.get("step")) return;
    // Keep review & submit stable: if user is on the review page, do not
    // auto-advance or redirect when the workflow changes (e.g. a step was removed).
    // Users expect to stay on the review page and decide next actions manually.
    if (currentStepKey === "review_and_submit") {
      return;
    }
    const maxStepInWorkflow = effectiveWorkflow.length;
    const maxAllowed = wizardState.allowedMaxStep;

    // SCENARIO 1: Invalid step (< 1)
    if (stepFromUrl < 1) {
      toast.error("Invalid step number");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowed}`);
      return;
    }

    // SCENARIO 2: Step beyond workflow but within completed steps (allow viewing)
    if (maxStepInWorkflow > 0 && stepFromUrl > maxStepInWorkflow) {
      // if (stepFromUrl <= wizardState.lastCompletedStep + 1) {
      if (stepFromUrl < wizardState.lastCompletedStep + 1) {
        return; // Allow viewing completed steps even if workflow changed
      }
      const safeStep = Math.min(maxAllowed, maxStepInWorkflow);
      toast.error("This step no longer exists in the workflow");
      router.replace(`/applications/edit/${applicationId}?step=${safeStep}`);
      return;
    }

    // SCENARIO 3: Step beyond max allowed (skip ahead) — redirect to last step (Review and Submit) when beyond workflow
    if (stepFromUrl > maxAllowed) {
      toast.error("Please complete steps in order");
      const targetStep = maxStepInWorkflow > 0
        ? Math.min(maxAllowed, maxStepInWorkflow)
        : maxAllowed;
      router.replace(`/applications/edit/${applicationId}?step=${targetStep}`);
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
    isMismatch,
    searchParams,
    wizardState,
  ]);

  /* ================================================================
     RENDER STEP COMPONENT
     ================================================================ */

  /** Step flagged if section-level or has item-level remarks */
  const isStepFlagged = React.useMemo(() => {
    if (!isAmendmentModeEffective) return true;
    if (!currentStepKey) return false;
    return flaggedSections.has(currentStepKey) || (flaggedItems.get(currentStepKey)?.size ?? 0) > 0;
  }, [isAmendmentModeEffective, flaggedSections, flaggedItems, currentStepKey]);

  /** Section-level remarks only for top card. Item-level remarks show beside each file/item. */
  const currentStepRemarks = React.useMemo(() => {
    if (!currentStepKey || !amendmentContext?.remarks) return [];
    return (amendmentContext.remarks as { scope?: string; scope_key?: string; remark?: string }[])
      .filter((r) => r.scope === "section" && r.scope_key === currentStepKey)
      .map((r) => r.remark || "");
  }, [currentStepKey, amendmentContext?.remarks]);

  const stepReadOnly = isAmendmentModeEffective && !isStepFlagged;

  const renderStepComponent = () => {
    const financingType = application?.financing_type as Record<string, unknown>;
    const savedProductId = (financingType?.product_id as string) || "";

    if (currentStepKey === "financing_type") {
      return (
        <FinancingTypeStep
          initialProductId={savedProductId}
          onDataChange={handleDataChange}
          readOnly={stepReadOnly}
        />
      );
    }

    if (currentStepKey === "company_details") {
      return (
        <CompanyDetailsStep applicationId={applicationId} onDataChange={handleDataChange} readOnly={stepReadOnly} />
      );
    }

    if (currentStepKey === "declarations") {
      return (
        <DeclarationsStep
          applicationId={applicationId}
          stepConfig={(currentStepConfig?.config as Record<string, unknown>) || undefined}
          onDataChange={handleDataChange}
          readOnly={stepReadOnly}
        />
      );
    }

    if (currentStepKey === "business_details") {
      return (
        <BusinessDetailsStep applicationId={applicationId} onDataChange={handleDataChange} readOnly={stepReadOnly} />
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
          readOnly={stepReadOnly}
          amendmentRemarks={amendmentContext?.remarks ?? []}
          isAmendmentMode={isAmendmentModeEffective}
          flaggedSections={flaggedSections}
          flaggedItems={flaggedItems}
        />
      );
    }

    if (currentStepKey === "financing_structure") {
      return (
        <FinancingStructureStep applicationId={applicationId} onDataChange={handleDataChange} readOnly={stepReadOnly} />
      );
    }

    if (currentStepKey === "contract_details") {
      return (
        <ContractDetailsStep
          applicationId={applicationId}
          workflow={effectiveWorkflow}
          onDataChange={handleDataChange}
          isAmendmentMode={isAmendmentModeEffective}
          flaggedSections={flaggedSections}
          flaggedItems={flaggedItems}
          remarks={amendmentContext?.remarks ?? []}
          readOnly={stepReadOnly}
        />
      );
    }

    if (currentStepKey === "invoice_details") {
      return (
        <InvoiceDetailsStep
          applicationId={applicationId}
          onDataChange={handleDataChange}
          readOnly={stepReadOnly}
          isAmendmentMode={isAmendmentModeEffective}
          flaggedSections={flaggedSections}
          flaggedItems={flaggedItems}
          remarks={amendmentContext?.remarks ?? []}
        />
      );
    }

    if (currentStepKey === "review_and_submit") {
      return (
        <ReviewAndSubmitStep applicationId={applicationId} onDataChange={handleDataChange} readOnly={stepReadOnly} />
      );
    }

    return null;
  };

  /* ================================================================
     EVENT HANDLERS
     ================================================================ */

  const handleSubmitApplication = async () => {
    try {
      if (!applicationId) return;

      isSubmittingRef.current = true; // 🔒 prevent gating effects

      // Live guard: ensure product version is current before final submit
      {
        const mismatch = await checkNow();
        if (mismatch) return;
      }

      const finalStepNumber = effectiveWorkflow.length;
      console.log('wizard', finalStepNumber)
      await updateStepMutation.mutateAsync({
        id: applicationId,
        stepData: {
          stepId: currentStepId,
          stepNumber: finalStepNumber,
          data: {}, // no step data change
        },
      });

      const currentStatus = (application as { status?: string })?.status;
      const isResubmit = currentStatus === "AMENDMENT_REQUESTED";
      await updateStatusMutation.mutateAsync({
        id: applicationId,
        status: isResubmit ? "RESUBMITTED" : "SUBMITTED",
      });

      toast.success(
        isResubmit ? "Application resubmitted successfully" : "Application submitted successfully"
      );

      router.replace("/");

    } catch {
      isSubmittingRef.current = false; // allow retry
      toast.error("Failed to submit application");
    }
  };




  const handleBack = () => {
    if (isSubmittingRef.current) return;

    (async () => {
      const mismatch = await checkNow();
      if (mismatch) return;

      if (stepFromUrl > 1) {
        const prevStep = stepFromUrl - 1;

        pendingNavRef.current = {
          path: `/applications/edit/${applicationId}?step=${prevStep}`,
          leavingPage: false,
        };

        requestNavigation(`/applications/edit/${applicationId}?step=${prevStep}`);
      } else {
        pendingNavRef.current = { path: "/", leavingPage: true };
        requestNavigation("/");
      }
    })();
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
      // Ignore transient child updates while we are actively navigating after "Don't Save"
      if (isNavigatingRef.current) return;

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
    if (isSubmittingRef.current) return;

    try {
      // Locked step: navigate only, no save, no DB write, no toast
      if (isAmendmentModeEffective && !isStepFlagged) {
        setHasUnsavedChanges(false);
        const nextStep = stepFromUrl + 1;
        if (wizardState) {
          setWizardState({
            lastCompletedStep: wizardState.lastCompletedStep,
            allowedMaxStep: Math.max(wizardState.allowedMaxStep, nextStep),
          });
        }
        await safeNavigate(`/applications/edit/${applicationId}?step=${nextStep}`, { leavingPage: false });
        return;
      }
      isSavingRef.current = true;

      // Live version guard: perform an up-to-date check before saving/navigation
      {
        const mismatch = await checkNow();
        if (mismatch) return;
      }

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
              // The supporting documents step returns the object shape that should be
              // stored directly on the `supporting_documents` column. Avoid wrapping
              // it a second time (which caused `supporting_documents.supporting_documents`).
              dataToSave = returnedData as Record<string, unknown>;
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
        await safeNavigate(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`, { leavingPage: false });
        return;
      }

      const nextStep = stepFromUrl + 1;

      // eslint-disable-next-line no-console
      console.log(
        `[SAVE] currentStep=${stepFromUrl}, nextStep=${nextStep}, structureChanged=${structureChanged}`
      );

      /* ============================================================
         FINANCING STRUCTURE NO-CHANGE CASE
         ============================================================ */

      if (currentStepKey === "financing_structure" && structureChanged === false) {
        // If step has been saved before, skip the save
        const hasBeenSavedBefore = (dataToSave as Record<string, unknown>)?.hasBeenSavedBefore as boolean | undefined;
        if (hasBeenSavedBefore) {
          setHasUnsavedChanges(false);
          await safeNavigate(`/applications/edit/${applicationId}?step=${nextStep}`, { leavingPage: false });
          return;
        }
        // First-time save: fall through to standard save flow
      }

      if (dataToSave) {
        delete (dataToSave as Record<string, unknown>).hasBeenSavedBefore;
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
      
      // In amendment mode: if this step is flagged, acknowledge workflow
      try {
        if (application?.status === "AMENDMENT_REQUESTED") {
          // currentStepId is the workflow step id (e.g. contract_details_1)
          const token = await getAccessToken();
          await fetch(`${API_URL}/v1/applications/${applicationId}/acknowledge-workflow`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ workflowId: currentStepId }),
          });
        }
      } catch {
        // ignore acknowledgement failures - backend enforcement remains authoritative
      }

      /** Do not update wizard state in amendment flow — progress is driven by acknowledgement only. */
      if (wizardState && application?.status !== "AMENDMENT_REQUESTED") {
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
      await safeNavigate(`/applications/edit/${applicationId}?step=${navigationStep}`, { leavingPage: false });
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

  /* ================================================================
     STEP VALIDATION STATE
     ================================================================ */

  const [isCurrentStepValid, setIsCurrentStepValid] = React.useState(true);

  /* ================================================================
     RENDER LOGIC
     ================================================================ */

  const isLoading = isLoadingApp || isLoadingProducts;
  const showBlockingDialog = Boolean(blockReason);

  if (isEditBlocked) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
          {/* Page Title */}
          {application ? (
            <div className="mb-4 sm:mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                  {currentStepInfo.title}
                </h1>
                <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground mt-1">
                  {currentStepInfo.description}
                </p>
              </div>
              {process.env.NODE_ENV !== "production" ? (
                <div className="ml-4">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      setDevPreviewAmendment((v) => {
                        const next = !v;
                        // If enabling preview, force step to 1 immediately
                        if (next) {
                          const mockFlagged = new Set(["contract_details", "invoice_details", "supporting_documents"]);
                          const firstFlagged = effectiveWorkflow.findIndex(
                            (s: Record<string, unknown>) =>
                              mockFlagged.has(getStepKeyFromStepId((s.id as string) || "") || "")
                          );
                          const targetStep = firstFlagged >= 0 ? firstFlagged + 1 : 1;
                          router.replace(`/applications/edit/${applicationId}?step=${targetStep}`);
                        }
                        return next;
                      });
                    }}
                    className="text-xs px-3 py-1 rounded-md"
                  >
                    Preview Amendment UI
                    <span className="ml-2 text-[10px] text-muted-foreground">DEV</span>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Progress Indicator */}
          <ProgressIndicator
            steps={effectiveWorkflow
              .map((s: Record<string, unknown>) => (s.name as string))}
            currentStep={stepFromUrl}
            lastCompletedStep={wizardState?.lastCompletedStep}
            isLoading={isLoading || !effectiveWorkflow.length}
            isAmendmentMode={application?.status === "AMENDMENT_REQUESTED"}
            amendmentFlaggedStepKeys={amendmentFlaggedStepKeys}
            acknowledgedWorkflowIds={acknowledgedWorkflowIds}
            stepKeys={effectiveWorkflow.map(
              (s: Record<string, unknown>) =>
                getStepKeyFromStepId((s.id as string) || "") || ""
            )}
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full" />

        {/* Step Content - Shows step's own skeleton when loading */}
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6 relative">
          {isAmendmentModeEffective && !isStepFlagged ? (
            <p className="text-sm text-muted-foreground mb-4 py-2 px-3 rounded-lg bg-muted/50">
              Read-only — no amendment requested for this step
            </p>
          ) : null}
          {isStepFlagged ? (
            <div className="mb-6">
              <AmendmentRemarkCard remarks={currentStepRemarks} showDefaultIntro={false} />
            </div>
          ) : null}
          {renderStepComponent()}
        </div>
      </main>

      {/* Bottom buttons */}
      {application && !showBlockingDialog ? (
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

            <div className="order-1 sm:order-2 flex flex-col items-end gap-1">
            <Button
              onClick={
                currentStepKey === "review_and_submit" && application?.status === "AMENDMENT_REQUESTED"
                  ? async () => {
                      try {
                        if (!applicationId) return;
                        isSubmittingRef.current = true;
                        const mismatch = await checkNow();
                        if (mismatch) return;
                        await resubmitMutation.mutateAsync(applicationId);
                        toast.success("Application resubmitted successfully");
                        router.replace("/");
                      } catch {
                        isSubmittingRef.current = false;
                      }
                    }
                  : currentStepKey === "review_and_submit"
                  ? handleSubmitApplication
                  : handleSaveAndContinue
              }
              disabled={
                currentStepKey === "review_and_submit" && application?.status === "AMENDMENT_REQUESTED"
                  ? resubmitMutation.isPending ||
                    isSubmittingRef.current ||
                    !allAmendmentStepsAcknowledged ||
                    !isCurrentStepValid
                  : updateStepMutation.isPending ||
                    updateStatusMutation.isPending ||
                    isSubmittingRef.current ||
                    !isCurrentStepValid ||
                    !isStepMapped
              }
              className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-1 sm:order-2 h-11"
            >
              {currentStepKey === "review_and_submit" && application?.status === "AMENDMENT_REQUESTED"
                ? resubmitMutation.isPending
                  ? "Resubmitting..."
                  : "Resubmit for Review"
                : currentStepKey === "review_and_submit"
                ? updateStatusMutation.isPending
                  ? "Submitting..."
                  : "Submit"
                : updateStepMutation.isPending
                  ? "Saving..."
                  : "Save and Continue"}
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
            {isAmendmentModeEffective && !isStepFlagged && currentStepKey !== "review_and_submit" ? (
              <p className="text-xs text-muted-foreground">Continuing without saving</p>
            ) : null}
            </div>
          </div>
        </footer>
      ) : null}

      {/* Product Block Dialog - using standalone modal */}
      <VersionMismatchModal
        open={showBlockingDialog}
        blockReason={blockReason}
        applicationId={applicationId}
        onOpenChange={() => { }}
      />

      {/* Unsaved Changes Modal (centralized) */}
      {isModalOpen && (
        <UnsavedChangesModal
          onConfirm={() => {
            confirmLeave();
          }}
          onCancel={() => {
            cancelLeave();
          }}
        />
      )}
    </div>
  );
}
