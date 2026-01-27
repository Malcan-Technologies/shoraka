"use client";

import * as React from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { useApplication, useUpdateApplicationStep, useArchiveApplication } from "@/hooks/use-applications";
import { useProducts } from "@/hooks/use-products";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ProgressIndicator } from "../../components/progress-indicator";
import { FinancingTypeStep } from "../../steps/financing-type-step";
import { DeclarationsStep } from "../../steps/declarations-step";
import { VerifyCompanyInfoStep } from "../../steps/verify-company-info-step";
import { SupportingDocumentsStep } from "../../steps/supporting-documents-step";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  
  // Get application ID from URL
  const applicationId = params.id as string;
  
  // Get which step user wants to see from URL
  // URL uses ?step=1, ?step=2, etc. (1-based for users)
  const stepFromUrl = parseInt(searchParams.get("step") || "1");
  
  
  // Load products to get workflow steps
  const { data: productsData, isLoading: isLoadingProducts } = useProducts({
    page: 1,
    pageSize: 100,
  });
  
  // Load application from DB
  const { data: application, isLoading: isLoadingApp, refetch: refetchApplication } = useApplication(applicationId);
  
  // Hook to update application step
  const updateStepMutation = useUpdateApplicationStep();
  
  // Hook to archive application
  const archiveApplicationMutation = useArchiveApplication();
  
  /**
   * VERSION MISMATCH CHECK
   * 
   * Compare application's product version with current product version.
   * If mismatch, user must restart with latest version.
   */
  const versionMismatch = React.useMemo(() => {
    if (!application || !productsData) return false;
    
    const financingType = application.financing_type as any;
    const productId = financingType?.product_id;
    
    if (!productId) return false;
    
    const products = productsData.products || [];
    const currentProduct = products.find((p: any) => p.id === productId);
    
    if (!currentProduct) return false;
    
    // Compare versions
    return application.product_version !== currentProduct.version;
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
  
  // Track if we just saved and are navigating to next step
  // This prevents validation from running with stale data immediately after save
  const justSavedRef = React.useRef(false);
  
  // Store step data from child components
  const stepDataRef = React.useRef<any>(null);
  
  /**
   * GET WORKFLOW STEPS
   * 
   * Get the list of steps from the product workflow.
   * Each product defines its own workflow steps.
   * 
   * Example workflow:
   * [
   *   { name: "Financing Type", id: "financing_type" },
   *   { name: "Verify Company Info", id: "verify_company_info" },
   *   { name: "Documents", id: "supporting_documents" },
   *   { name: "Declarations", id: "declarations" }
   * ]
   */
  const workflowSteps = React.useMemo(() => {
    if (!application || !productsData) return [];
    
    // Get product ID from application
    const financingType = application.financing_type as any;
    const productId = financingType?.product_id;
    
    if (!productId) return [];
    
    // Find the product
    const products = productsData.products || [];
    const product = products.find((p: any) => p.id === productId);
    
    if (!product || !product.workflow) return [];
    
    // Return step names
    return product.workflow.map((step: any) => step.name);
  }, [application, productsData]);
  
  const isLoading = isLoadingApp || isLoadingProducts;
  
  /**
   * GET CURRENT STEP INFO
   * 
   * Get the workflow step configuration for the current step.
   * This tells us which component to render and what config to pass.
   */
  const currentStepConfig = React.useMemo(() => {
    if (!application || !productsData) return null;
    
    // Get product
    const financingType = application.financing_type as any;
    const productId = financingType?.product_id;
    if (!productId) return null;
    
    const products = productsData.products || [];
    const product = products.find((p: any) => p.id === productId);
    if (!product || !product.workflow) return null;
    
    // Get current step from workflow (0-based index)
    const stepIndex = stepFromUrl - 1;
    const step = product.workflow[stepIndex];
    
    return step || null;
  }, [application, productsData, stepFromUrl]);
  
  // Get the step ID (e.g., "financing_type", "verify_company_info")
  const currentStepId = currentStepConfig?.id || "";
  
  /**
   * Check if current step is mapped to a component
   * 
   * If step is not mapped, we show placeholder and disable save button
   */
  const isStepMapped = React.useMemo(() => {
    const mappedStepIds = [
      "financing_type_1",
      "verify_company_info_1",
      "company_info_1",
      "declarations_1",
      "supporting_documents_1",
    ];
    return mappedStepIds.includes(currentStepId);
  }, [currentStepId]);
  
  /**
   * STEP TITLES AND DESCRIPTIONS
   * 
   * Custom titles and descriptions for each step ID.
   * These override the default step names from the workflow.
   */
  const stepTitles: Record<string, { title: string; description: string }> = {
    "financing_type_1": {
      title: "Select Financing Type",
      description: "Choose the type of financing that best suits your business needs"
    },
    "verify_company_info_1": {
      title: "Verify Company Information",
      description: "Review and confirm your company details are accurate"
    },
    "company_info_1": {
      title: "Verify Company Information",
      description: "Review and confirm your company details are accurate"
    },
    "declarations_1": {
      title: "Declarations",
      description: "Please read and accept all declarations to continue"
    },
    "supporting_documents_1": {
      title: "Upload Documents",
      description: "Upload all required supporting documents for your application"
    },
  };
  
  // Get custom title/description or fall back to workflow step name
  const currentStepInfo = stepTitles[currentStepId] || {
    title: workflowSteps[stepFromUrl - 1] || "Loading...",
    description: "Complete this step to continue"
  };
  
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
    
    // Match step ID to component
    if (currentStepId === "financing_type_1") {
      return (
        <FinancingTypeStep
          initialProductId={savedProductId}
          onDataChange={handleDataChange}
        />
      );
    }
    
    if (currentStepId === "verify_company_info_1" ) {
      return (
        <VerifyCompanyInfoStep
          applicationId={applicationId}
          onDataChange={handleDataChange}
        />
      );
    }
    
    if (currentStepId === "declarations_1") {
      return (
        <DeclarationsStep
          applicationId={applicationId}
          stepConfig={currentStepConfig?.config}
          onDataChange={handleDataChange}
        />
      );
    }
    if (currentStepId === "supporting_documents_1") {
      return (
        <SupportingDocumentsStep
          applicationId={applicationId}
          stepConfig={currentStepConfig}
          onDataChange={handleDataChange}
        />
      );
    }
    
    // Placeholder for unmapped steps
    return (
      <div className="text-center py-12 text-muted-foreground">
       Coming soon...
      </div>
    );
  };
  
  /**
   * RESUME LOGIC
   * 
   * If user visits /applications/edit/123 without ?step=
   * Redirect them to their last completed step
   */
  React.useEffect(() => {
    if (!application || isLoadingApp) return;
    
    // If no step in URL, go to last completed step
    if (!searchParams.get("step")) {
      const lastCompleted = application.last_completed_step || 1;
      router.replace(`/applications/edit/${applicationId}?step=${lastCompleted}`);
    }
  }, [application, applicationId, router, searchParams, isLoadingApp]);
  
  /**
   * STEP VALIDATION
   * 
   * Prevent users from skipping steps by typing URL manually
   * 
   * Rules:
   * - User can only access steps 1 through (last_completed_step + 1)
   * - Example: If last_completed_step = 2, user can access steps 1, 2, or 3
   * - Trying to access step 5 → redirect to step 3 with error
   * - Step must exist in the current product workflow
   * 
   * Why? We want users to complete steps in order and ensure steps exist.
   */
  React.useEffect(() => {
    if (!application || isLoadingApp || isLoadingProducts) return;
    
    // Skip validation if we just saved and are navigating to next step
    // This prevents false "complete steps in order" error when data is still updating
    if (justSavedRef.current) {
      // Reset the flag after a short delay to allow validation to run normally next time
      const timer = setTimeout(() => {
        justSavedRef.current = false;
      }, 500);
      return () => clearTimeout(timer);
    }
    
    const lastCompleted = application.last_completed_step || 1;
    const maxAllowedStep = lastCompleted + 1;
    
    // Check if step exists in workflow (workflow might have changed)
    if (workflowSteps.length > 0 && stepFromUrl > workflowSteps.length) {
      const redirectStep = Math.min(lastCompleted, workflowSteps.length);
      toast.error("This step no longer exists in the workflow");
      router.replace(`/applications/edit/${applicationId}?step=${redirectStep}`);
      return;
    }
    
    // User is trying to skip ahead
    if (stepFromUrl > maxAllowedStep) {
      toast.error("Please complete steps in order");
      router.replace(`/applications/edit/${applicationId}?step=${maxAllowedStep}`);
      return;
    }
    
    // User typed invalid step number (less than 1)
    if (stepFromUrl < 1) {
      toast.error("Invalid step number");
      router.replace(`/applications/edit/${applicationId}?step=${lastCompleted}`);
      return;
    }
  }, [application, applicationId, stepFromUrl, router, isLoadingApp, isLoadingProducts, workflowSteps]);
  
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
    
    // Push dummy state to catch back button
    window.history.pushState(null, "", window.location.href);
    
    const handlePopState = () => {
      if (hasUnsavedChanges) {
        window.history.pushState(null, "", window.location.href);
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
        // Any other step - go to previous step
        router.push(`/applications/edit/${applicationId}?step=${stepFromUrl - 1}`);
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
   * - If on step 2+ → go to previous step (step 1 shows financing type with DB data)
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
    } else if (stepFromUrl > 1) {
      // Any other step - go to previous step
      router.push(`/applications/edit/${applicationId}?step=${stepFromUrl - 1}`);
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
      // Get the data from the current step
      let dataToSave = stepDataRef.current;
      console.log(dataToSave)
      
      /**
       * STEP-SPECIFIC SAVE FUNCTIONS
       * 
       * Some steps need to save additional data before saving the application.
       * For example:
       * - verify_company_info updates organization data first
       * - supporting_documents uploads files to S3 and returns updated data with S3 keys
       */
      if (dataToSave?.saveFunction) {
        const returnedData = await dataToSave.saveFunction();
        
        // If saveFunction returns data, use it (e.g., supporting documents with S3 keys)
        if (returnedData) {
          // For supporting documents, the returned data IS the complete categories structure
          // We need to wrap it in supporting_documents key
          if (currentStepId === "supporting_documents" || currentStepId === "supporting_documents_1") {
            dataToSave = {
              supporting_documents: returnedData,
            };
          } else {
            // For other steps, merge normally
            dataToSave = { ...dataToSave, ...returnedData };
          }
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
      if (!dataToSave) {
        // No data yet - just navigate for now
        toast.success("Step completed");
        setHasUnsavedChanges(false);
        router.push(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`);
        return;
      }
      
      // Call API to save
      // API endpoint: PATCH /v1/applications/:id/step
      // Body: { stepNumber: 1, stepId: "financing_type", data: {...} }
      await updateStepMutation.mutateAsync({
        id: applicationId,
        stepData: {
          stepNumber: stepFromUrl,
          stepId: currentStepId,
          data: dataToSave,
        },
      });
      
      // Wait for application data to refetch before navigating
      // This prevents the validation effect from running with stale data
      await refetchApplication();
      
      // Set flag to skip validation temporarily after save
      // This prevents false "complete steps in order" error
      justSavedRef.current = true;
      
      // Success! Clear unsaved changes and navigate
      setHasUnsavedChanges(false);
      toast.success("Saved successfully");
      
      // Go to next step
      router.push(`/applications/edit/${applicationId}?step=${stepFromUrl + 1}`);
      
    } catch (error) {
      // Error already shown by mutation hook
      toast.error("Failed to save. Please try again.");
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
    
    // Check if step provides validation flag
    if (data?.areAllFilesUploaded !== undefined) {
      setIsCurrentStepValid(data.areAllFilesUploaded);
    } else if (data?.areAllDeclarationsChecked !== undefined) {
      // Declarations step provides this flag to indicate if all boxes are checked
      setIsCurrentStepValid(data.areAllDeclarationsChecked);
    } else {
      // Default to valid if step doesn't provide validation
      setIsCurrentStepValid(true);
    }
    
    // Check if step provides pending changes flag
    if (data?.hasPendingChanges !== undefined) {
      // Use the component's flag (e.g., supporting documents knows if files are selected)
      setHasUnsavedChanges(data.hasPendingChanges);
    } else if (data) {
      // For other steps, mark as unsaved when data is passed
      setHasUnsavedChanges(true);
    }
  };
  
  // Show loading state while fetching application
  if (isLoading || !application) {
    return (
      <div className="flex flex-col h-full">
        <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Skeleton className="h-5 sm:h-6 w-28 sm:w-32" />
        </header>
        
        <main className="flex-1 overflow-y-auto p-3 sm:p-4">
          <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 py-4 sm:py-8">
            <Skeleton className="h-7 sm:h-9 w-48 sm:w-64 mb-2" />
            <Skeleton className="h-4 sm:h-5 w-64 sm:w-96 mb-6 sm:mb-8" />
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
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Top navigation bar */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <h1 className="text-base sm:text-lg font-semibold">Edit Application</h1>
      </header>
      
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
            steps={workflowSteps}
            currentStep={stepFromUrl}
            isLoading={false}
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
            className="text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-2 sm:order-1"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          {/* Continue button */}
          <Button
            onClick={handleSaveAndContinue}
            disabled={updateStepMutation.isPending || !isCurrentStepValid || !isStepMapped}
            className="bg-primary text-primary-foreground hover:opacity-95 shadow-brand text-sm sm:text-base font-semibold px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl order-1 sm:order-2"
          >
            {updateStepMutation.isPending ? "Saving..." : "Save and Continue"}
            <ArrowRightIcon className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </footer>
      
      {/* Version Mismatch Modal (Blocking) */}
      <Dialog open={versionMismatch} onOpenChange={() => {}}>
        <DialogContent className="[&>button]:hidden">
          <DialogHeader>
            <DialogTitle>Product Updated</DialogTitle>
            <DialogDescription>
              This product has been updated with new features and requirements.
              Please restart your application to continue.
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
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmLeave}
            >
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
