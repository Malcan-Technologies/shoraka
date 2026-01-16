"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  LockClosedIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";
import {
  FinancingTypeConfig,
  FinancingTermsConfig,
  InvoiceDetailsConfig,
  CompanyInfoConfig,
  SupportingDocumentsConfig,
  DeclarationConfig,
  ReviewSubmitConfig,
} from "./workflow-steps";
import { StepSelectorPopover, type StepType } from "./step-selector-popover";

import { UseFormReturn } from "react-hook-form";

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface WorkflowStep {
  id: string;
  name: string;
  config?: Record<string, any>;
}

interface WorkflowBuilderProps {
  form: UseFormReturn<any>; // React Hook Form instance
  onFileSelected?: (stepId: string, file: File | null) => void; // Track pending files by step ID
}

interface SortableStepProps {
  step: WorkflowStep;
  isExpanded: boolean; // Is the step config panel open?
  isLocked: boolean;   // Is this step locked (cannot be reordered or deleted)?
  hasConfig: boolean;  // Does this step have configuration options?
  onDelete: (id: string) => void;    // Delete the step
  onExpand: (id: string) => void;    // Expand/collapse the config panel
  onConfigure: (id: string, config: any) => void; // Save config changes
  onFileSelected?: (stepId: string, file: File | null) => void; // Track pending files by step ID
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check if a step has meaningful configuration (not just empty objects)
function hasConfiguredContent(step: WorkflowStep): boolean {
  const config = step.config || {};
  const stepName = step.name.toLowerCase();
  
  // Financing Type: check if name exists
  if (stepName.includes("financing type")) {
    return config.name && typeof config.name === 'string' && config.name.trim().length > 0;
  }
  
  // Financing Terms: check if any field is set
  if (stepName.includes("financing terms")) {
    return config.minInvoiceAmount || config.maxInvoiceAmount || 
           (config.availableTerms && config.availableTerms.length > 0);
  }
  
  // Invoice Details: check if any customization is done
  if (stepName.includes("invoice")) {
    return config.invoiceNumberLabel || config.invoiceDateLabel || 
           config.buyerInfoRequired !== undefined || config.uploadRequired !== undefined;
  }
  
  // Supporting Documents: check if any documents are added
  if (stepName.includes("document")) {
    if (!config.categories || !Array.isArray(config.categories)) return false;
    const hasDocuments = config.categories.some(
      (cat: any) => cat.documents && Array.isArray(cat.documents) && cat.documents.length > 0
    );
    return hasDocuments;
  }
  
  // Declaration: check if declarations array has items
  if (stepName.includes("declaration")) {
    return config.declarations && Array.isArray(config.declarations) && config.declarations.length > 0;
  }
  
  // Company Info and Review & Submit never show configured badge
  if (stepName.includes("company") || stepName.includes("review")) {
    return false;
  }
  
  // Default: check if config has any keys
  return Object.keys(config).length > 0;
}

// ============================================
// CONFIGURATION PANEL
// Displays the right config UI based on step type
// ============================================
function StepConfigContent({ 
  step, 
  onConfigure,
  onFileSelected 
}: { 
  step: WorkflowStep; 
  onConfigure: (config: any) => void;
  onFileSelected?: (file: File | null) => void;
}) {
  const stepName = step.name.toLowerCase();
  
  // Match step name to the correct configuration component
  if (stepName.includes("financing type")) {
    return <FinancingTypeConfig config={step.config || {}} onChange={onConfigure} onFileSelected={onFileSelected} />;
  }
  if (stepName.includes("financing terms")) {
    return <FinancingTermsConfig config={step.config || {}} onChange={onConfigure} />;
  }
  if (stepName.includes("invoice")) {
    return <InvoiceDetailsConfig config={step.config || {}} onChange={onConfigure} />;
  }
  if (stepName.includes("company")) {
    return <CompanyInfoConfig config={step.config || {}} onChange={onConfigure} />;
  }
  if (stepName.includes("document")) {
    return <SupportingDocumentsConfig config={step.config || {}} onChange={onConfigure} />;
  }
  if (stepName.includes("declaration")) {
    return <DeclarationConfig config={step.config || {}} onChange={onConfigure} />;
  }
  if (stepName.includes("review") || stepName.includes("submit")) {
    return <ReviewSubmitConfig config={step.config || {}} onChange={onConfigure} />;
  }

  // Fallback for unknown steps
  return (
    <div className="pt-4 pb-2 text-xs text-muted-foreground">
      <p>No configuration available for: <span className="font-mono">{step.name}</span></p>
    </div>
  );
}

// ============================================
// INDIVIDUAL STEP CARD
// Shows one workflow step with drag handle, checkbox, and config panel
// ============================================
function SortableStep({ step, isExpanded, isLocked, hasConfig, onDelete, onExpand, onConfigure, onFileSelected }: SortableStepProps) {
  // Setup drag and drop for this step
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: step.id,
    disabled: isLocked, // Locked steps cannot be dragged
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border rounded-lg bg-card transition-all duration-200",
        isExpanded && "border-primary/60 ring-1 ring-primary/10 shadow-sm",
        !isExpanded && "hover:border-primary/40 hover:ring-1 hover:ring-primary/10 hover:shadow-sm",
        isDragging && "shadow-xl z-50 opacity-60 scale-105",
        isLocked && "bg-muted/20"
      )}
    >
      {/* Header - click anywhere to expand/collapse */}
      <div 
        className={cn(
          "flex items-center gap-2 sm:gap-3 p-3 sm:p-4 cursor-pointer",
          isExpanded && "border-b bg-muted/30"
        )}
        onClick={() => hasConfig && onExpand(step.id)}
      >
        {/* Icon: Lock (if locked) or Drag Handle */}
        {isLocked ? (
          <div className="p-1 sm:p-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <LockClosedIcon className="h-5 w-5 sm:h-5 sm:w-5 text-muted-foreground" />
          </div>
        ) : (
          <div
            onClick={(e) => e.stopPropagation()} // Don't expand when dragging
            {...attributes}
            {...listeners}
            className="shrink-0 p-1"
          >
            <Bars3Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        {/* Step name */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-xs sm:text-sm truncate">
            {step.name}
          </h4>
        </div>

        {/* "Configured" badge if step has meaningful config */}
        {hasConfiguredContent(step) && (
          <span className="text-xs px-1.5 sm:px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 rounded-full shrink-0">
            Configured
          </span>
        )}

        {/* Delete button (only for unlocked steps) */}
        {!isLocked && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(step.id);
            }}
            className="p-2 sm:p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
            title="Delete step"
          >
            <TrashIcon className="h-4 w-4 sm:h-4 sm:w-4" />
          </button>
        )}

        {/* Arrow icon to expand/collapse */}
        {hasConfig && (
          <div className={cn(
            "p-1.5 sm:p-1 rounded-full transition-all text-muted-foreground shrink-0",
            isExpanded && "bg-primary/10 text-primary"
          )}>
            {isExpanded ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </div>
        )}
      </div>

      {/* Configuration panel (shown when expanded) */}
      {isExpanded && hasConfig && (
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-3 sm:pb-4">
          <StepConfigContent 
            step={step} 
            onConfigure={(config) => onConfigure(step.id, config)} 
            onFileSelected={onFileSelected ? (file) => onFileSelected(step.id, file) : undefined}
          />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN WORKFLOW BUILDER
// Manages the list of workflow steps with drag-drop reordering
// ============================================
export function WorkflowBuilder({ form, onFileSelected }: WorkflowBuilderProps) {
  // Track which steps are expanded (showing config)
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());
  
  // Track step pending deletion for confirmation dialog
  const [stepToDelete, setStepToDelete] = React.useState<WorkflowStep | null>(null);

  // Get current steps from the form
  const steps = form.watch("workflow") || [];

  // Setup drag and drop sensors (mouse & keyboard)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // Must drag 8px to start
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // When user drags a step to a new position
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s: WorkflowStep) => s.id === active.id);
    const newIndex = steps.findIndex((s: WorkflowStep) => s.id === over.id);
    
    const draggedStep = steps[oldIndex];
    
    // Don't allow moving "Financing Type" from first position or moving anything to first position
    const firstStep = steps[0];
    if (firstStep.name.toLowerCase().includes("financing type")) {
      if (oldIndex === 0 || newIndex === 0) {
        return;
      }
    }
    
    // Don't allow moving "Review & Submit" away from last position
    // Don't allow moving anything else to the last position
    const isReviewSubmit = draggedStep.name.toLowerCase().includes("review");
    const isTargetLastPosition = newIndex === steps.length - 1;
    
    if (isReviewSubmit && oldIndex === steps.length - 1) {
      // Review & Submit cannot be moved away from last position
      return;
    }
    
    if (!isReviewSubmit && isTargetLastPosition) {
      // Other steps cannot be moved to last position (reserved for Review & Submit)
      return;
    }
    
    // Reorder the steps
    form.setValue("workflow", arrayMove(steps, oldIndex, newIndex), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  // Initiate step deletion (shows confirmation dialog)
  const initiateDelete = (id: string) => {
    const step = (steps as WorkflowStep[]).find((s: WorkflowStep) => s.id === id);
    if (step) {
      setStepToDelete(step);
    }
  };
  
  // Confirm and delete a step
  const confirmDelete = () => {
    if (!stepToDelete) return;
    
    const updatedSteps = (steps as WorkflowStep[]).filter((s: WorkflowStep) => s.id !== stepToDelete.id);
    form.setValue("workflow", updatedSteps, { shouldValidate: true, shouldDirty: true });
    
    // Close the step if it was expanded
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.delete(stepToDelete.id);
      return next;
    });
    
    setStepToDelete(null);
  };
  
  // Cancel deletion
  const cancelDelete = () => {
    setStepToDelete(null);
  };

  // Expand or collapse a step's config panel
  const toggleExpand = (id: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Save config changes for a step
  const updateStepConfig = (id: string, config: any) => {
    const updatedSteps = (steps as WorkflowStep[]).map((s: WorkflowStep) => 
      s.id === id ? { ...s, config } : s
    );
    form.setValue("workflow", updatedSteps, { shouldValidate: true, shouldDirty: true });
  };

  // Add a new step (from the "Add Step" button)
  const addStep = (stepType: StepType) => {
    // Don't add if already exists
    const exists = (steps as WorkflowStep[]).some((s: WorkflowStep) => 
      s.name.toLowerCase().includes(stepType.name.toLowerCase())
    );
    if (exists) return;

    const newStep: WorkflowStep = {
      id: `${stepType.id}_${Date.now()}`,
      name: stepType.name,
      config: stepType.defaultConfig || {},
    };
    
    // Insert new steps before "Review & Submit" (always keep it last)
    const lastStep = steps[steps.length - 1];
    const isLastReviewSubmit = lastStep && lastStep.name.toLowerCase().includes("review");
    
    if (isLastReviewSubmit && steps.length > 0) {
      // Insert before the last step
      const updatedSteps = [...steps.slice(0, -1), newStep, lastStep];
      form.setValue("workflow", updatedSteps, { shouldValidate: true, shouldDirty: true });
    } else {
      // Add to the end if no Review & Submit step
      form.setValue("workflow", [...steps, newStep], { shouldValidate: true, shouldDirty: true });
    }
  };

  // Close all expanded steps
  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  // Reset steps to default order
  const resetOrder = () => {
    const defaultOrder = [
      "Financing Type",
      "Financing Terms",
      "Invoice Details",
      "Company Info",
      "Supporting Documents",
      "Declaration",
      "Review & Submit",
    ];

    const sorted = [...steps].sort((a, b) => {
      const aIndex = defaultOrder.findIndex((name) => a.name.toLowerCase().includes(name.toLowerCase()));
      const bIndex = defaultOrder.findIndex((name) => b.name.toLowerCase().includes(name.toLowerCase()));
      if (aIndex === -1) return 1;  // Unknown steps go to end
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });

    form.setValue("workflow", sorted, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Top Bar: Shows stats and action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 pb-3 border-b">
        {/* Left: Step count and drag hint */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
          <span className="text-xs sm:text-sm text-muted-foreground font-medium">
            {steps.length} {steps.length === 1 ? 'step' : 'steps'}
          </span>
          <Separator orientation="vertical" className="hidden sm:block h-4" />
          <span className="text-xs text-muted-foreground flex items-center gap-1 sm:gap-1">
            <Bars3Icon className="h-3.5 w-3.5" /> Drag to reorder
          </span>
        </div>
        
        {/* Right: Action buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
            disabled={expandedSteps.size === 0}
            className="h-9 sm:h-8 text-xs w-full sm:w-auto justify-center"
          >
            Collapse All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetOrder}
            className="h-9 sm:h-8 text-xs w-full sm:w-auto justify-center"
          >
            Reset Order
          </Button>
          <div className="w-full sm:w-auto">
            <StepSelectorPopover onSelect={addStep} existingSteps={steps} />
          </div>
        </div>
      </div>

      {/* Drag and drop container for all steps */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(steps as WorkflowStep[]).map((s: WorkflowStep) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 sm:space-y-3">
            {/* Empty state */}
            {steps.length === 0 ? (
              <div className="text-center py-8 sm:py-12 border-2 border-dashed rounded-lg">
                <p className="text-xs sm:text-sm text-muted-foreground mb-3">No workflow steps yet</p>
                <StepSelectorPopover onSelect={addStep} />
              </div>
            ) : (
              /* Render each step */
              (steps as WorkflowStep[]).map((step: WorkflowStep, index: number) => {
                // Check if this step is locked (cannot be reordered or deleted)
                const isFirstFinancingType = step.name.toLowerCase().includes("financing type") && index === 0;
                const isLastReviewSubmit = step.name.toLowerCase().includes("review") && index === steps.length - 1;
                const isLocked = isFirstFinancingType || isLastReviewSubmit;
                const hasConfig = !isLastReviewSubmit; // Review & Submit has no config
                
                return (
                  <SortableStep
                    key={step.id}
                    step={step}
                    isExpanded={expandedSteps.has(step.id)}
                    isLocked={isLocked}
                    hasConfig={hasConfig}
                    onDelete={initiateDelete}
                    onExpand={toggleExpand}
                    onConfigure={updateStepConfig}
                    onFileSelected={onFileSelected}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!stepToDelete} onOpenChange={(open) => !open && cancelDelete()}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] sm:w-full max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete workflow step?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete <span className="font-semibold text-foreground">{stepToDelete?.name}</span>? 
              This will remove the step and all its configuration. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel onClick={cancelDelete} className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete Step
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
