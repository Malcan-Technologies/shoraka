"use client";

/**
 * Guide: docs/guides/application-flow/amendment-flow.md — Amendment flow (context fetch, flaggedSections, stepper, tab locking)
 *
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
import { useQueryClient } from "@tanstack/react-query";
import {
  useApplication,
  useUpdateApplicationStep,
  useUpdateApplicationStatus,
  useResubmitApplication,
} from "@/hooks/use-applications";
import { useApprovedContracts } from "@/hooks/use-contracts";
import { useProducts } from "@/hooks/use-products";
import { toast } from "sonner";
import {
  getStepKeyFromStepId,
  APPLICATION_STEP_KEYS_WITH_UI,
  STEP_KEY_DISPLAY,
  type ApplicationStepKey,
} from "@cashsouk/types";
import { ProgressIndicator } from "../../components/progress-indicator";
import {
  ApplicationFlowBlockedBackdrop,
  ApplicationFlowBlockedStepSkeleton,
} from "../../components/application-flow-blocked-backdrop";
import { AmendmentRemarkCard, ReadOnlyStepBanner } from "../../components/amendments";
import { useHeader } from "@cashsouk/ui";
import { FinancingTypeStep } from "../../steps/financing-type-step";
import { FinancingStructureStep } from "../../steps/financing-structure-step";
import { ContractDetailsStep } from "../../steps/contract-details-step";
import { InvoiceDetailsStep } from "../../steps/invoice-details-step";
import { DeclarationsStep } from "../../steps/declarations-step";
import { CompanyDetailsStep } from "../../steps/company-details-step";
import { BusinessDetailsStep } from "../../steps/business-details-step";
import { FinancialStatementsStep } from "../../steps/financial-statements-step";
import { SupportingDocumentsStep } from "../../steps/supporting-documents-step";
import { ReviewAndSubmitStep } from "../../steps/review-and-submit-step";
// dialog components are used by modal components directly
import { useProductVersionGuard } from "@/hooks/use-product-version-guard";
import { VersionMismatchModal } from "@/components/VersionMismatchModal";
import { useNavigationGuard } from "@/hooks/use-navigation-guard2";
import { UnsavedChangesModal } from "@/components/unsaved-changes-modal";
import { DevToolsProvider, useDevTools } from "../../components/dev-tools-context";
import { DevToolsPanel } from "../../components/dev-tools-panel";
import "../../components/dev-tools-registry";
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

/**
 * SECTION: Edit page Suspense fallback
 * WHY: useSearchParams() can omit ?step= on first paint so parsing defaults to 1 and flashes wrong step.
 * INPUT: none
 * OUTPUT: Same shell as blocked/loading so navigation feels stable.
 * WHERE USED: Suspense boundary wrapping edit page client tree.
 */
function EditApplicationSuspenseFallback() {
  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
          <ApplicationFlowBlockedBackdrop>
            <ProgressIndicator steps={[]} currentStep={1} isLoading />
          </ApplicationFlowBlockedBackdrop>
        </div>
        <div className="h-px bg-border w-full" />
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6 relative">
          <ApplicationFlowBlockedStepSkeleton />
        </div>
      </main>
    </div>
  );
}

function EditApplicationPageBody() {
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
  /** Step is always derived from URL; never stored in React state. */
  const stepFromUrl = parseInt(searchParams.get("step") || "1", 10);
  const currentStep = stepFromUrl;

  /** Load application from DB */
  const queryClient = useQueryClient();
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

  /** Approved contracts for Fill Entire Application (existing_contract option). */
  const { data: approvedContracts = [] } = useApprovedContracts(
    application?.issuer_organization_id || ""
  );

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

  /** Syncs wizard state from application on first load. Runs once when application exists and wizardState is still null. */
  React.useEffect(() => {
    if (!application || wizardState !== null) return;

    const lastCompleted = application.last_completed_step || 1;
    setWizardState({
      lastCompletedStep: lastCompleted,
      allowedMaxStep: lastCompleted + 1,
    });

  }, [application, wizardState]);

  /* ================================================================
   LOCK EDITING IF NOT DRAFT
   ================================================================ */

  /** Blocks editing when the application is neither DRAFT nor AMENDMENT_REQUESTED. Redirects to /applications. */
  const isEditBlocked =
    application &&
    application.status !== "DRAFT" &&
    application.status !== "AMENDMENT_REQUESTED";

  React.useEffect(() => {
    if (!application) return;
    if (isSubmittingRef.current) return;
    if (application.status !== "DRAFT" && application.status !== "AMENDMENT_REQUESTED") {
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
  /** Idle: not amendment; loading: fetch in flight; done: context resolved (may be empty on error). */
  const [amendmentContextStatus, setAmendmentContextStatus] = React.useState<
    "idle" | "loading" | "done"
  >("idle");
  const [devPreviewAmendment, setDevPreviewAmendment] = React.useState(false);

  /** Returns mock amendment context for DEV preview. Covers section, item, and tab-level remark types. */
  const getMockAmendmentContext = React.useCallback(() => ({
    review_cycle: (application as { review_cycle?: number })?.review_cycle ?? 1,
    remarks: [
      { scope: "section", scope_key: "contract_details", remark: "Missing contract number\nError with customer name" },
      { scope: "section", scope_key: "invoice_details", remark: "Invoice amount does not match document\nMissing supplier signature" },
      { scope: "item", scope_key: "invoice_details:0:Invoice", remark: "amount does not match document/nInvoice date must match contract" },
      { scope: "item", scope_key: "invoice_details:1:Invoice", remark: "missing supplier signature" },
      { scope: "section", scope_key: "supporting_documents", remark: "Upload missing Company Secretary Letter." },
      { scope: "item", scope_key: "supporting_documents:doc:financial_docs:0:Latest_Management_Account", remark: "Wrong document uploaded" },
      { scope: "item", scope_key: "supporting_documents:doc:legal_docs:0:Deed_of_Assignment", remark: "Document date expired" },
    ],
  }), [(application as { review_cycle?: number })?.review_cycle]);

  React.useEffect(() => {
    if (!application) return;

    if (devPreviewAmendment) {
      setAmendmentContextStatus("done");
      setAmendmentContext(getMockAmendmentContext() as any);
      return;
    }

    if (application.status !== "AMENDMENT_REQUESTED") {
      setAmendmentContext(null);
      setAmendmentContextStatus("idle");
      return;
    }

    let mounted = true;
    setAmendmentContext(null);
    setAmendmentContextStatus("loading");
    (async () => {
      try {
        const token = await getAccessToken();
        const resp = await fetch(`${API_URL}/v1/applications/${applicationId}/amendment-context`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await resp.json();
        if (!mounted) return;
        if (!json.success) {
          setAmendmentContext({
            review_cycle: (application as { review_cycle?: number }).review_cycle ?? 1,
            remarks: [],
          });
          setAmendmentContextStatus("done");
          return;
        }
        setAmendmentContext({ review_cycle: json.data.review_cycle, remarks: json.data.remarks });
        setAmendmentContextStatus("done");
      } catch {
        if (!mounted) return;
        setAmendmentContext({
          review_cycle: (application as { review_cycle?: number }).review_cycle ?? 1,
          remarks: [],
        });
        setAmendmentContextStatus("done");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [application, applicationId, getAccessToken, API_URL, devPreviewAmendment, getMockAmendmentContext]);

  /** Set of scope_keys for section-level remarks. Used to show which tabs need amendment. */
  const flaggedSections = React.useMemo(() => {
    if (!amendmentContext) return new Set<string>();
    const s = new Set<string>();
    for (const r of amendmentContext.remarks || []) {
      const rem = r as { scope?: string; scope_key?: string };
      if (rem.scope === "section" && rem.scope_key) {
        const key = rem.scope_key;
        s.add(key);
      }
    }
    return s;
  }, [amendmentContext]);

  /** Map from tab key to the set of full scope_keys for item-level remarks. Drives per-item error display. */
  const flaggedItems = React.useMemo(() => {
    if (!amendmentContext) return new Map<string, Set<string>>();
    const m = new Map<string, Set<string>>();
    for (const r of amendmentContext.remarks || []) {
      const rem = r as { scope?: string; scope_key?: string };
      if (rem.scope === "item" && rem.scope_key) {
        const tab = rem.scope_key.split(":")[0];
        const tabKey = tab;
        if (!m.has(tabKey)) m.set(tabKey, new Set());
        m.get(tabKey)!.add(rem.scope_key);
      }
    }
    return m;
  }, [amendmentContext]);

  /** Step keys that have amendment remarks. Stepper uses this for red styling. Review & Submit is always flagged in amendment mode.
   * Admin uses "financial" for the Financial tab; issuer workflow uses "financial_statements". Map so the step shows the flag. */
  const amendmentFlaggedStepKeys = React.useMemo(() => {
    const s = new Set<string>();
    for (const k of flaggedSections) {
      s.add(k);
      if (k === "financial") s.add("financial_statements");
    }
    for (const k of flaggedItems.keys()) s.add(k);
    if (application?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment) {
      s.add("review_and_submit");
    }
    return Array.from(s);
  }, [flaggedSections, flaggedItems, application?.status, devPreviewAmendment]);

  /** Step keys the user has acknowledged. Comes from amendment_acknowledged_workflow_ids on the application. */
  const acknowledgedWorkflowIds = React.useMemo(() => {
    const ids = (application as { amendment_acknowledged_workflow_ids?: string[] })?.amendment_acknowledged_workflow_ids ?? [];
    return Array.from(new Set(ids.map((id) => getStepKeyFromStepId(id)).filter(Boolean))) as string[];
  }, [application]);

  /** True when all flagged steps (except financial and review_and_submit) are acknowledged. Required before Resubmit. */
  const allAmendmentStepsAcknowledged = amendmentFlaggedStepKeys
    .filter((step) => !step.startsWith("financial") && step !== "review_and_submit")
    .every((step) => acknowledgedWorkflowIds.includes(step));


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

  /** Filters product workflow using session override when user picks structure before saving. UI-only; does not persist. */
  const effectiveWorkflow = React.useMemo(() => {
    if (!productWorkflow.length) return [];
    if (!isStructureResolved) return productWorkflow;

    if (effectiveStructureType === "existing_contract") {
      return productWorkflow.filter(
        (step: Record<string, unknown>) =>
          getStepKeyFromStepId((step.id as string) || "") !== "contract_details"
      );
    }
    return productWorkflow;
  }, [productWorkflow, effectiveStructureType, isStructureResolved]);

  /** Forward scan for next amendment step that is flagged and not yet acknowledged; else Review & Submit. */
  const stepAcknowledgedForAmendmentNav = React.useCallback(
    (key: string, extraAckedKeys: ReadonlySet<string>) => {
      const acked = (k: string) =>
        acknowledgedWorkflowIds.includes(k) || extraAckedKeys.has(k);
      return acked(key) || (key === "financial_statements" && acked("financial"));
    },
    [acknowledgedWorkflowIds]
  );

  const getNextAmendmentStepNumber = React.useCallback(
    (fromStep1Based: number, extraAckedKeys: readonly string[] = []) => {
      const extra = new Set(extraAckedKeys);
      const amendmentStepsToCheck = amendmentFlaggedStepKeys.filter(
        (k) => k !== "review_and_submit"
      );
      const cur0 = fromStep1Based - 1;
      for (let j = cur0 + 1; j < effectiveWorkflow.length; j++) {
        const row = effectiveWorkflow[j] as Record<string, unknown>;
        const key = getStepKeyFromStepId((row.id as string) || "") || "";
        if (
          amendmentStepsToCheck.includes(key) &&
          !stepAcknowledgedForAmendmentNav(key, extra)
        ) {
          return j + 1;
        }
      }
      const reviewIndex = effectiveWorkflow.findIndex(
        (s: Record<string, unknown>) =>
          (getStepKeyFromStepId((s.id as string) || "") || "") === "review_and_submit"
      );
      return reviewIndex >= 0 ? reviewIndex + 1 : effectiveWorkflow.length;
    },
    [effectiveWorkflow, amendmentFlaggedStepKeys, stepAcknowledgedForAmendmentNav]
  );

  /* ================================================================
     BLOCK REASONS (PRODUCT DELETED/VERSION CHANGED)
     ================================================================ */

  /* ================================================================
     PRODUCT VERSION GUARD (centralized)
     ================================================================ */
  const { isMismatch, blockReason, checkNow } = useProductVersionGuard(applicationId);

  const versionBlocksNavigation = React.useCallback(async () => {
    if (application?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment) {
      return false;
    }
    if (isMismatch) return true;
    return await checkNow();
  }, [application?.status, devPreviewAmendment, isMismatch, checkNow]);

  const navigateWithVersionCheck = React.useCallback(
    async (path: string, mode: "push" | "replace" = "push"): Promise<boolean> => {
      const blocked = await versionBlocksNavigation();
      if (blocked) return false;

      if (mode === "replace") router.replace(path);
      else router.push(path);

      return true;
    },
    [router, versionBlocksNavigation]
  );

  /* ================================================================
     CURRENT STEP RESOLUTION
     ================================================================ */

  const currentStepConfig = React.useMemo(() => {
    if (!effectiveWorkflow.length) return null;
    return (effectiveWorkflow[stepFromUrl - 1] as Record<string, unknown>) ?? null;
  }, [effectiveWorkflow, stepFromUrl]);

  const currentStepId = (currentStepConfig?.id as string) || "";
  const currentStepKey = React.useMemo(() => {
    if (!effectiveWorkflow.length) {
      return null;
    }

    const key = getStepKeyFromStepId(currentStepId);
    if (key) return key;

    // Fallback detection from application data (only after workflow is known)
    if (application && stepFromUrl > 1) {
      const stepSequence: ApplicationStepKey[] = [
        "financing_type",
        "financing_structure",
        "contract_details",
        "invoice_details",
        "company_details",
        "business_details",
        "financial_statements",
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
  }, [currentStepId, application, stepFromUrl, effectiveWorkflow.length]);

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
      if (currentStepKey === "contract_details") {
        const isInvoiceOnly = effectiveStructureType === "invoice_only";
        return {
          title: isInvoiceOnly ? "Provide Customer Details" : "Provide Contract and Customer Details",
          description: isInvoiceOnly
            ? "Tell us about the customer billed under this invoice."
            : "Help us understand your contract and the customer billed under this invoice.",
        };
      }
      const stepDisplay = STEP_KEY_DISPLAY[currentStepKey];
      return {
        title: (stepDisplay.pageTitle || stepDisplay.title) as string,
        description: (stepDisplay.description || "") as string,
      };
    },
    [currentStepKey, effectiveWorkflow, stepFromUrl, effectiveStructureType]
  ) as { title: string; description: string };

  const isRealAmendmentMode = (application as any)?.status === "AMENDMENT_REQUESTED";
  const isAmendmentModeEffective = isRealAmendmentMode || devPreviewAmendment;

  /* ================================================================
     STEP DATA STORAGE (REF)
     ================================================================ */

  const stepDataRef = React.useRef<Record<string, unknown> | null>(null);
  /** Stores the step key for the data in stepDataRef. Prevents saving stale data when user clicks Back then Save. */
  const stepDataStepKeyRef = React.useRef<string | null>(null);
  const isSavingRef = React.useRef<boolean>(false);
  const isSubmittingRef = React.useRef<boolean>(false);
  /** UI state for Save & Continue: triggers re-render so button shows "Saving..." and disables. */
  const [isSaving, setIsSaving] = React.useState(false);

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
    setHasUnsavedChanges(false);
    /** Keeps stepDataRef intact. The new step overwrites it when ready. Clearing it caused a race where Save ran before data loaded. */
  }, [stepFromUrl]);

  // Navigation guard integration
  const pendingNavRef = React.useRef<{ path: string; leavingPage: boolean } | null>(null);
  const isNavigatingRef = React.useRef(false);

  const onConfirmNavigation = React.useCallback(
    async (path: string) => {
      const pending = pendingNavRef.current;
      isNavigatingRef.current = true;
      try {
        setHasUnsavedChanges(false);
        stepDataRef.current = null;
        stepDataStepKeyRef.current = null;

        if (path === "__BACK__") {
          pendingNavRef.current = null;
          const didNavigate = await navigateWithVersionCheck("/", "replace");
          if (didNavigate) setHasUnsavedChanges(false);
          return;
        }

        if (pending?.leavingPage) {
          pendingNavRef.current = null;
          const didNavigate = await navigateWithVersionCheck(path, "replace");
          if (didNavigate) setHasUnsavedChanges(false);
        } else {
          pendingNavRef.current = null;
          const didNavigate = await navigateWithVersionCheck(path, "push");
          if (didNavigate) setHasUnsavedChanges(false);
        }
      } finally {
        isNavigatingRef.current = false;
      }
    },
    [navigateWithVersionCheck]
  );

  const { isModalOpen, requestNavigation, confirmLeave, cancelLeave, pendingPath } = useNavigationGuard(
    hasUnsavedChanges,
    onConfirmNavigation
  );

  const safeNavigate = React.useCallback(
    async (
      path: string,
      opts: { leavingPage?: boolean; forceSkipGuard?: boolean } = {}
    ): Promise<boolean> => {
      const { leavingPage = false, forceSkipGuard = false } = opts;
      if (forceSkipGuard || !hasUnsavedChanges) {
        return await navigateWithVersionCheck(path, leavingPage ? "replace" : "push");
      }

      pendingNavRef.current = { path, leavingPage };
      requestNavigation(path);
      return false;
    },
    [hasUnsavedChanges, requestNavigation, navigateWithVersionCheck]
  );

  /* ================================================================
     RESUME LOGIC
     ================================================================ */

  /** When URL has no step param: amendment mode → first amended step that is not yet acknowledged; normal flow → max allowed step. */
  React.useEffect(() => {
    if (isSubmittingRef.current) return;
    if (!application || isLoadingApp || wizardState === null) return;

    if (!searchParams.get("step")) {
      const isRealAmendmentMode = (application as { status?: string })?.status === "AMENDMENT_REQUESTED";
      const isAmendmentMode = isRealAmendmentMode || devPreviewAmendment;

      let targetStep: number;
      if (isAmendmentMode) {
        if (
          amendmentContextStatus !== "done" ||
          !amendmentContext ||
          effectiveWorkflow.length === 0 ||
          !isStructureResolved
        ) {
          return;
        }
        const amendmentStepsToCheck = amendmentFlaggedStepKeys.filter(
          (k) => k !== "review_and_submit"
        );
        const stepAcknowledged = (key: string) =>
          acknowledgedWorkflowIds.includes(key) ||
          (key === "financial_statements" && acknowledgedWorkflowIds.includes("financial"));
        const firstUnack = effectiveWorkflow.findIndex(
          (s: Record<string, unknown>) => {
            const key = getStepKeyFromStepId((s.id as string) || "") || "";
            return amendmentStepsToCheck.includes(key) && !stepAcknowledged(key);
          }
        );
        if (firstUnack >= 0) {
          targetStep = firstUnack + 1;
        } else {
          const reviewIndex = effectiveWorkflow.findIndex(
            (s: Record<string, unknown>) =>
              (getStepKeyFromStepId((s.id as string) || "") || "") === "review_and_submit"
          );
          targetStep = reviewIndex >= 0 ? reviewIndex + 1 : effectiveWorkflow.length;
        }
      } else {
        targetStep = wizardState.allowedMaxStep;
      }
      void navigateWithVersionCheck(
        `/applications/edit/${applicationId}?step=${targetStep}`,
        "replace"
      );
    }
  }, [
    application,
    applicationId,
    searchParams,
    isLoadingApp,
    wizardState,
    devPreviewAmendment,
    amendmentContext,
    amendmentContextStatus,
    amendmentFlaggedStepKeys,
    acknowledgedWorkflowIds,
    effectiveWorkflow,
    isStructureResolved,
    navigateWithVersionCheck,
  ]);

  /* ================================================================
     NAVIGATION GATING & VALIDATION
     ================================================================ */

  /**
   * Single gating effect for step access. Runs when data loads or the URL step changes.
   * Uses local wizardState so it never depends on stale react-query cache. Prevents "Please complete steps in order" loops.
   */
  React.useEffect(() => {
    if (isSubmittingRef.current) return;
    if (!application || isLoadingApp || isLoadingProducts) return;
    const versionMismatchBlocksStepGating =
      isMismatch &&
      application.status !== "AMENDMENT_REQUESTED" &&
      !devPreviewAmendment;
    if (versionMismatchBlocksStepGating) return;
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
    const isAmendmentMode = (application as { status?: string })?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment;

    // NaN guard: parseInt("abc") returns NaN; NaN < 1 is false, so explicit check required
    if (!Number.isFinite(stepFromUrl)) {
      void navigateWithVersionCheck(`/applications/edit/${applicationId}?step=1`, "replace");
      return;
    }

    // Lower bound: requestedStep < 1 → redirect to step 1
    if (stepFromUrl < 1) {
      void navigateWithVersionCheck(`/applications/edit/${applicationId}?step=1`, "replace");
      return;
    }

    // Upper bound: requestedStep > totalSteps → redirect to last step
    if (maxStepInWorkflow > 0 && stepFromUrl > maxStepInWorkflow) {
      void navigateWithVersionCheck(
        `/applications/edit/${applicationId}?step=${maxStepInWorkflow}`,
        "replace"
      );
      return;
    }

    // Sequential guard: requestedStep > maxAllowed — SKIP in amendment mode
    if (!isAmendmentMode && stepFromUrl > maxAllowed) {
      toast.error("Please complete steps in order");
      const targetStep = maxStepInWorkflow > 0 ? Math.min(maxAllowed, maxStepInWorkflow) : maxAllowed;
      void navigateWithVersionCheck(
        `/applications/edit/${applicationId}?step=${targetStep}`,
        "replace"
      );
      return;
    }

  }, [
    application,
    applicationId,
    stepFromUrl,
    isLoadingApp,
    isLoadingProducts,
    effectiveWorkflow,
    isMismatch,
    searchParams,
    wizardState,
    devPreviewAmendment,
    navigateWithVersionCheck,
  ]);

  /* ================================================================
     RENDER STEP COMPONENT
     ================================================================ */

  /** True when the current step has section-level remarks or any item-level remarks. Drives amendment UI.
   * Admin uses "financial" for the Financial tab; issuer workflow uses "financial_statements". */
  const isStepFlagged = React.useMemo(() => {
    if (!isAmendmentModeEffective) return true;
    if (!currentStepKey) return false;
    const sectionMatch =
      flaggedSections.has(currentStepKey) ||
      (currentStepKey === "financial_statements" && flaggedSections.has("financial"));
    return sectionMatch || (flaggedItems.get(currentStepKey)?.size ?? 0) > 0;
  }, [isAmendmentModeEffective, flaggedSections, flaggedItems, currentStepKey]);

  /** Remarks for the current step. Section-level ones show on the top card; item-level ones show beside each file or item.
   * Admin uses "financial" for the Financial tab; issuer workflow uses "financial_statements". */
  const currentStepRemarks = React.useMemo(() => {
    if (!currentStepKey || !amendmentContext?.remarks) return [];
    const remarks = amendmentContext.remarks as { scope?: string; scope_key?: string; remark?: string }[];
    return remarks
      .filter((r) => {
        if (r.scope !== "section" || !r.scope_key) return false;
        return (
          r.scope_key === currentStepKey ||
          (currentStepKey === "financial_statements" && r.scope_key === "financial")
        );
      })
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

    if (currentStepKey === "financial_statements") {
      return (
        <FinancialStatementsStep applicationId={applicationId} onDataChange={handleDataChange} readOnly={stepReadOnly} />
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
          isInvoiceOnly={effectiveStructureType === "invoice_only"}
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
    if (isSubmittingRef.current) return;
    if (devPreviewAmendment) {
      toast.info("Preview mode - no database changes");
      return;
    }
    isSubmittingRef.current = true;

    try {
      if (!applicationId) return;

      if (await versionBlocksNavigation()) return;

      const finalStepNumber = effectiveWorkflow.length;
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

      const didLeave = await navigateWithVersionCheck("/", "replace");
      if (didLeave) {
        toast.success(
          isResubmit ? "Application resubmitted successfully" : "Application submitted successfully"
        );
      }
    } catch {
      toast.error("Failed to submit application");
    } finally {
      isSubmittingRef.current = false;
    }
  };




  /** Back: step 1 → exit confirmation modal → navigate to /; step ≥2 → previous step. Does not modify acknowledgement or last_completed_step. */
  const handleBack = () => {
    if (isSubmittingRef.current || isSavingRef.current) return;

    (async () => {
      if (currentStep === 1) {
        pendingNavRef.current = { path: "/", leavingPage: true };
        requestNavigation("/", { forceModal: true });
      } else {
        const prevStep = currentStep - 1;
        pendingNavRef.current = {
          path: `/applications/edit/${applicationId}?step=${prevStep}`,
          leavingPage: false,
        };
        requestNavigation(`/applications/edit/${applicationId}?step=${prevStep}`);
      }
    })();
  };

  /** Amendment mode only: navigate to step via URL. Does not modify amendment_acknowledged_workflow_ids. */
  const handleStepClick = React.useCallback(
    (step: number) => {
      if (isSubmittingRef.current || isSavingRef.current) return;
      safeNavigate(`/applications/edit/${applicationId}?step=${step}`, { leavingPage: false });
    },
    [safeNavigate, applicationId]
  );

  const handleDataChange = React.useCallback((data: Record<string, unknown> | null) => {
    stepDataRef.current = data;
    stepDataStepKeyRef.current = data ? currentStepKey : null;

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
  }, [currentStepKey]);

  /* ================================================================
     SAVE & CONTINUE HANDLER
     ================================================================ */

  /**
   * Save flow: validate form ready → product version guard → save helpers (uploads) → step validations
   * → updateStepMutation → navigate (version checked again inside navigateWithVersionCheck).
   */
  const handleSaveAndContinue = async () => {
    if (isSubmittingRef.current || isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      // Locked step: navigate only, no save, no DB write, no toast
      if (isAmendmentModeEffective && !isStepFlagged) {
        const nextStep = getNextAmendmentStepNumber(stepFromUrl);
        const didNav = await safeNavigate(`/applications/edit/${applicationId}?step=${nextStep}`, {
          leavingPage: false,
          forceSkipGuard: true,
        });
        if (!didNav) return;
        setHasUnsavedChanges(false);
        if (wizardState) {
          setWizardState({
            lastCompletedStep: wizardState.lastCompletedStep,
            allowedMaxStep: Math.max(wizardState.allowedMaxStep, nextStep),
          });
        }
        return;
      }

      const rawData = stepDataRef.current;
      /** Ensures data is for the current step. After Back, the step repopulates async; this avoids saving stale or empty data. */
      if (
        !rawData ||
        (stepDataStepKeyRef.current && stepDataStepKeyRef.current !== currentStepKey)
      ) {
        toast.error("Please wait for the form to load before saving");
        return;
      }

      if (await versionBlocksNavigation()) {
        return;
      }

      let dataToSave: Record<string, unknown> | null = { ...rawData };

      const structureChanged =
        currentStepKey === "financing_structure" &&
        (dataToSave as Record<string, unknown>)?.structureChanged === true;

      /**
       * Step-specific save helpers (uploads, etc.) run after product version is OK.
       * They return persisted data merged into dataToSave; saveFunction is deleted after.
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
            } else if (currentStepKey === "financial_statements") {
              console.log("Saving financial step: using payload from saveFunction only");
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
        delete (dataToSave as Record<string, unknown>).isDeclarationConfirmed;
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

      // FINANCIAL STATEMENTS validation — all fields required (step passes isValid)
      if (currentStepKey === "financial_statements" && (rawData as Record<string, unknown>)?.isValid === false) {
        toast.error("Please fill in all required fields before saving");
        return;
      }

      // BUSINESS & GUARANTOR DETAILS — at least one guarantor; every guarantor row fully filled
      if (currentStepKey === "business_details" && (rawData as Record<string, unknown>)?.isValid === false) {
        toast.error(
          "Add at least one guarantor and complete all fields for every guarantor (including any you added) before continuing"
        );
        return;
      }

      // No data case
      if (dataToSave === null) {
        const navStep = isAmendmentModeEffective
          ? getNextAmendmentStepNumber(stepFromUrl)
          : stepFromUrl + 1;
        const didNav = await safeNavigate(
          `/applications/edit/${applicationId}?step=${navStep}`,
          { leavingPage: false, forceSkipGuard: true }
        );
        if (didNav) {
          toast.success("Step completed");
          setHasUnsavedChanges(false);
        }
        return;
      }

      const linearNext = stepFromUrl + 1;

      /* ============================================================
         FINANCING STRUCTURE NO-CHANGE CASE
         ============================================================ */

      if (currentStepKey === "financing_structure" && structureChanged === false) {
        // If step has been saved before, skip the save
        const hasBeenSavedBefore = (dataToSave as Record<string, unknown>)?.hasBeenSavedBefore as boolean | undefined;
        if (hasBeenSavedBefore) {
          const navStep = isAmendmentModeEffective
            ? getNextAmendmentStepNumber(stepFromUrl)
            : linearNext;
          const ok = await safeNavigate(`/applications/edit/${applicationId}?step=${navStep}`, {
            leavingPage: false,
            forceSkipGuard: true,
          });
          if (ok) setHasUnsavedChanges(false);
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
        stepNumber: stepFromUrl,
        data: dataToSave,
        ...(structureChanged && { forceRewindToStep: stepFromUrl }),
      };

      // Save to database (version already checked above, before save helpers)
      await updateStepMutation.mutateAsync({
        id: applicationId,
        stepData: stepPayload,
      });

      // In amendment mode: if this step is flagged, acknowledge workflow
      try {
        if (application?.status === "AMENDMENT_REQUESTED") {
          const token = await getAccessToken();
          await fetch(`${API_URL}/v1/applications/${applicationId}/acknowledge-workflow`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ workflowId: currentStepId }),
          });
          queryClient.invalidateQueries({ queryKey: ["application", applicationId] });
        }
      } catch {
        // ignore acknowledgement failures - backend enforcement remains authoritative
      }

      const ackExtra: string[] = [];
      if (isAmendmentModeEffective && isStepFlagged && currentStepKey) {
        ackExtra.push(currentStepKey);
        if (currentStepKey === "financial_statements") {
          ackExtra.push("financial");
        }
      }
      const navigationStep = structureChanged
        ? stepFromUrl + 1
        : isAmendmentModeEffective
          ? getNextAmendmentStepNumber(stepFromUrl, ackExtra)
          : linearNext;
      const didNav = await safeNavigate(
        `/applications/edit/${applicationId}?step=${navigationStep}`,
        { leavingPage: false, forceSkipGuard: true }
      );

      if (!didNav) {
        return;
      }

      /** In amendment flow, wizard state is not updated here. Progress is driven by acknowledgement only. */
      if (wizardState && application?.status !== "AMENDMENT_REQUESTED") {
        setWizardState({
          lastCompletedStep: stepFromUrl,
          allowedMaxStep: Math.max(wizardState.allowedMaxStep, linearNext),
        });
      }

      setHasUnsavedChanges(false);

      if (currentStepKey === "financing_structure") {
        sessionStorage.removeItem("cashsouk:financing_structure_override");
        setSessionStructureType(null);
      }

      toast.success("Saved successfully");
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("VALIDATION_")) {
        return;
      }
      toast.error("Something went wrong. Please try again.");
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  /* ================================================================
     RESTART APPLICATION
     ================================================================ */

  /* ================================================================
     STEP VALIDATION STATE
     ================================================================ */

  const [isCurrentStepValid, setIsCurrentStepValid] = React.useState(true);

  const handlePreviewAmendment = React.useCallback(() => {
    const next = !devPreviewAmendment;
    setDevPreviewAmendment(next);
    if (next) {
      const mock = getMockAmendmentContext();
      const previewFlagged = new Set<string>();
      for (const r of mock.remarks) {
        const rem = r as { scope?: string; scope_key?: string };
        if (rem.scope === "section" && rem.scope_key) {
          previewFlagged.add(rem.scope_key);
          if (rem.scope_key === "financial") previewFlagged.add("financial_statements");
        }
        if (rem.scope === "item" && rem.scope_key) {
          previewFlagged.add(rem.scope_key.split(":")[0]);
        }
      }
      const actionable = Array.from(previewFlagged).filter((k) => k !== "review_and_submit");
      let targetStep = 1;
      const firstIdx = effectiveWorkflow.findIndex((s: Record<string, unknown>) => {
        const key = getStepKeyFromStepId((s.id as string) || "") || "";
        return actionable.includes(key);
      });
      if (firstIdx >= 0) targetStep = firstIdx + 1;
      queueMicrotask(() => {
        void navigateWithVersionCheck(
          `/applications/edit/${applicationId}?step=${targetStep}`,
          "replace"
        );
      });
    }
  }, [
    devPreviewAmendment,
    effectiveWorkflow,
    applicationId,
    navigateWithVersionCheck,
    getMockAmendmentContext,
  ]);

  /* ================================================================
     RENDER LOGIC
     ================================================================ */

  const isLoading = isLoadingApp || isLoadingProducts;
  const showBlockingDialog = Boolean(blockReason);
  const useBlockedFlowBackdrop =
    showBlockingDialog ||
    (!isLoading && Boolean(application) && effectiveWorkflow.length === 0);

  const hasStepQuery = searchParams.has("step");
  const amendmentRouteReady =
    !isAmendmentModeEffective ||
    (amendmentContextStatus === "done" && isStructureResolved);
  const isStepRouteReady =
    !useBlockedFlowBackdrop &&
    hasStepQuery &&
    Boolean(application) &&
    !isLoadingApp &&
    !isLoadingProducts &&
    effectiveWorkflow.length > 0 &&
    wizardState !== null &&
    amendmentRouteReady;

  const showStepLoadingShell = !useBlockedFlowBackdrop && !isStepRouteReady;
  const devTools = useDevTools();
  const previewWizardLoadingShell =
    process.env.NODE_ENV === "development" && (devTools?.previewWizardLoadingShell ?? false);
  const useWizardContentShell =
    useBlockedFlowBackdrop || showStepLoadingShell || previewWizardLoadingShell;
  /** Keep footer visible during loading/block shell; buttons stay disabled so layout does not jump. */
  const footerActionsLocked = useWizardContentShell;

  if (isEditBlocked) {
    return null;
  }

  return (
    <>
    <div className="flex flex-col h-full">
      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
          {useWizardContentShell ? (
            <ApplicationFlowBlockedBackdrop>
              <ProgressIndicator
                steps={effectiveWorkflow.map((s: Record<string, unknown>) => {
                  const stepKey = getStepKeyFromStepId((s.id as string) || "");
                  if (stepKey === "contract_details") {
                    return effectiveStructureType === "invoice_only"
                      ? "Customer Details"
                      : "Contract Details";
                  }
                  return (s.name as string) ?? "";
                })}
                currentStep={currentStep}
                isLoading
                isAmendmentMode={isAmendmentModeEffective}
                amendmentFlaggedStepKeys={amendmentFlaggedStepKeys}
                acknowledgedWorkflowIds={acknowledgedWorkflowIds}
                stepKeys={effectiveWorkflow.map(
                  (s: Record<string, unknown>) =>
                    getStepKeyFromStepId((s.id as string) || "") || ""
                )}
                onStepClick={isAmendmentModeEffective ? handleStepClick : undefined}
              />
            </ApplicationFlowBlockedBackdrop>
          ) : (
            <>
              {application ? (
                <div className="mb-4 sm:mb-6">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
                    {currentStepInfo.title}
                  </h1>
                  <p className="text-sm sm:text-[15px] leading-6 sm:leading-7 text-muted-foreground mt-1">
                    {currentStepInfo.description}
                  </p>
                </div>
              ) : null}
              <ProgressIndicator
                steps={effectiveWorkflow.map((s: Record<string, unknown>) => {
                  const stepKey = getStepKeyFromStepId((s.id as string) || "");
                  if (stepKey === "contract_details") {
                    return effectiveStructureType === "invoice_only"
                      ? "Customer Details"
                      : "Contract Details";
                  }
                  return (s.name as string) ?? "";
                })}
                currentStep={currentStep}
                isLoading={isLoading || !effectiveWorkflow.length}
                isAmendmentMode={isAmendmentModeEffective}
                amendmentFlaggedStepKeys={amendmentFlaggedStepKeys}
                acknowledgedWorkflowIds={acknowledgedWorkflowIds}
                stepKeys={effectiveWorkflow.map(
                  (s: Record<string, unknown>) =>
                    getStepKeyFromStepId((s.id as string) || "") || ""
                )}
                onStepClick={isAmendmentModeEffective ? handleStepClick : undefined}
              />
            </>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-border w-full" />

        {/* Step Content - Shows step's own skeleton when loading */}
        <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 pt-4 sm:pt-6 relative">
          {useWizardContentShell ? (
            <ApplicationFlowBlockedStepSkeleton />
          ) : (
            <>
              {isAmendmentModeEffective && !isStepFlagged && currentStepKey !== "review_and_submit" ? (
                <div className="mb-6">
                  <ReadOnlyStepBanner />
                </div>
              ) : null}
              {isStepFlagged ? (
                <div className="mb-6">
                  <AmendmentRemarkCard remarks={currentStepRemarks} showDefaultIntro={false} />
                </div>
              ) : null}
              {renderStepComponent()}
            </>
          )}
        </div>
      </main>

      {/* Bottom buttons — visible during shell; disabled until route is interactive */}
      {application ? (
        <footer className="sticky bottom-0 border-t bg-background">
          <div className="max-w-7xl mx-auto w-full px-3 sm:px-4 py-3 sm:py-4 flex flex-col sm:flex-row gap-3 sm:gap-0 sm:justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={
                footerActionsLocked ||
                isSaving ||
                (currentStepKey === "review_and_submit" &&
                  application?.status === "AMENDMENT_REQUESTED" &&
                  resubmitMutation.isPending)
              }
              className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-2 sm:order-1 h-11"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="order-1 sm:order-2 flex flex-col items-end gap-1">
            <Button
              onClick={
                currentStepKey === "review_and_submit" && (application?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment)
                  ? async () => {
                      if (isSubmittingRef.current || !applicationId) return;
                      if (devPreviewAmendment) {
                        toast.info("Preview mode - no database changes");
                        return;
                      }
                      isSubmittingRef.current = true;
                      try {
                        if (await versionBlocksNavigation()) return;
                        await resubmitMutation.mutateAsync(applicationId);
                        const didLeave = await navigateWithVersionCheck("/", "replace");
                        if (didLeave) {
                          toast.success("Application resubmitted successfully");
                        }
                      } catch {
                        toast.error("Failed to resubmit application");
                      } finally {
                        isSubmittingRef.current = false;
                      }
                    }
                  : currentStepKey === "review_and_submit"
                  ? handleSubmitApplication
                  : handleSaveAndContinue
              }
              disabled={
                footerActionsLocked ||
                (currentStepKey === "review_and_submit" && (application?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment)
                  ? resubmitMutation.isPending ||
                    isSubmittingRef.current ||
                    !allAmendmentStepsAcknowledged ||
                    !isCurrentStepValid
                  : updateStepMutation.isPending ||
                    updateStatusMutation.isPending ||
                    isSaving ||
                    !isCurrentStepValid ||
                    !isStepMapped)
              }
              className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-1 sm:order-2 h-11"
            >
              {currentStepKey === "review_and_submit" && (application?.status === "AMENDMENT_REQUESTED" || devPreviewAmendment)
                ? resubmitMutation.isPending
                  ? "Resubmitting..."
                  : "Resubmit for Review"
                : currentStepKey === "review_and_submit"
                ? updateStatusMutation.isPending
                  ? "Submitting..."
                  : "Submit"
                : updateStepMutation.isPending || isSaving
                  ? "Saving..."
                  : isAmendmentModeEffective && !isStepFlagged
                  ? "Continue"
                  : "Save and Continue"}
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
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

      {/* Unsaved Changes / Exit Confirmation Modal (centralized) */}
      {isModalOpen && (
        <UnsavedChangesModal
          onConfirm={() => {
            confirmLeave();
          }}
          onCancel={() => {
            cancelLeave();
          }}
          variant={pendingPath === "/" ? "exit" : "unsaved"}
          hasUnsavedChanges={pendingPath === "/" ? hasUnsavedChanges : undefined}
        />
      )}
    </div>
    <DevToolsPanel
      currentStepKey={currentStepKey}
      onPreviewAmendment={handlePreviewAmendment}
      isPreviewAmendmentActive={devPreviewAmendment}
      approvedContractIds={approvedContracts?.map((c: { id: string }) => c.id) ?? []}
    />
    </>
  );
}

function EditApplicationPageInner() {
  return (
    <DevToolsProvider>
      <EditApplicationPageBody />
    </DevToolsProvider>
  );
}

export default function EditApplicationPage() {
  return (
    <React.Suspense fallback={<EditApplicationSuspenseFallback />}>
      <EditApplicationPageInner />
    </React.Suspense>
  );
}
