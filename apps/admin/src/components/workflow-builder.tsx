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
import { Checkbox } from "@cashsouk/ui";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Bars3Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  LockClosedIcon,
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
  enabled: boolean;
  config?: Record<string, any>;
}

interface WorkflowBuilderProps {
  form: UseFormReturn<any>; // React Hook Form instance
}

interface SortableStepProps {
  step: WorkflowStep;
  isExpanded: boolean; // Is the step config panel open?
  isLocked: boolean;   // Is this step locked (cannot be reordered)?
  hasConfig: boolean;  // Does this step have configuration options?
  onToggle: (id: string) => void;    // Enable/disable the step
  onExpand: (id: string) => void;    // Expand/collapse the config panel
  onConfigure: (id: string, config: any) => void; // Save config changes
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// Check if a step has meaningful configuration (not just empty objects)
function hasConfiguredContent(step: WorkflowStep): boolean {
  const config = step.config || {};
  const stepName = step.name.toLowerCase();
  
  // Financing Type: check if types array has items
  if (stepName.includes("financing type")) {
    return config.types && Array.isArray(config.types) && config.types.length > 0;
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
    if (!config.categories) return false;
    const hasDocuments = Object.values(config.categories).some(
      (docs: any) => Array.isArray(docs) && docs.length > 0
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
function StepConfigContent({ step, onConfigure }: { step: WorkflowStep; onConfigure: (config: any) => void }) {
  const stepName = step.name.toLowerCase();
  
  // Match step name to the correct configuration component
  if (stepName.includes("financing type")) {
    return <FinancingTypeConfig config={step.config || {}} onChange={onConfigure} />;
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
function SortableStep({ step, isExpanded, isLocked, hasConfig, onToggle, onExpand, onConfigure }: SortableStepProps) {
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
          "flex items-center gap-3 p-4 cursor-pointer",
          isExpanded && "border-b bg-muted/30"
        )}
        onClick={() => hasConfig && onExpand(step.id)}
      >
        {/* Icon: Lock (if locked) or Drag Handle */}
        {isLocked ? (
          <div className="p-0.5" onClick={(e) => e.stopPropagation()}>
            <LockClosedIcon className="h-5 w-5 text-muted-foreground" />
          </div>
        ) : (
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted"
            onClick={(e) => e.stopPropagation()} // Don't expand when dragging
            {...attributes}
            {...listeners}
          >
            <Bars3Icon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
          </button>
        )}

        {/* Checkbox to enable/disable step */}
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={step.enabled}
            onCheckedChange={() => onToggle(step.id)}
            disabled={isLocked} // Locked steps always enabled
          />
        </div>

        {/* Step name */}
        <div className="flex-1">
          <h4 className={cn(
            "font-medium text-sm",
            !step.enabled && "text-muted-foreground line-through"
          )}>
            {step.name}
          </h4>
          {!step.enabled && (
            <p className="text-xs text-muted-foreground mt-0.5">Disabled</p>
          )}
        </div>

        {/* "Configured" badge if step has meaningful config */}
        {step.enabled && hasConfiguredContent(step) && (
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 rounded-full">
            Configured
          </span>
        )}

        {/* Arrow icon to expand/collapse */}
        {hasConfig && (
          <div className={cn(
            "p-1 rounded-full transition-all text-muted-foreground",
            isExpanded && "bg-primary/10 text-primary"
          )}>
            {isExpanded ? <ChevronDownIcon className="h-5 w-5" /> : <ChevronRightIcon className="h-5 w-5" />}
          </div>
        )}
      </div>

      {/* Configuration panel (shown when expanded) */}
      {isExpanded && hasConfig && (
        <div className="px-4 pb-4">
          <StepConfigContent step={step} onConfigure={(config) => onConfigure(step.id, config)} />
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN WORKFLOW BUILDER
// Manages the list of workflow steps with drag-drop reordering
// ============================================
export function WorkflowBuilder({ form }: WorkflowBuilderProps) {
  // Track which steps are expanded (showing config)
  const [expandedSteps, setExpandedSteps] = React.useState<Set<string>>(new Set());

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
    
    // Don't allow moving "Financing Type" from first position
    const firstStep = steps[0];
    if (firstStep.name.toLowerCase().includes("financing type") && (oldIndex === 0 || newIndex === 0)) {
      return;
    }
    
    // Don't allow moving "Review & Submit" from last position
    const lastStep = steps[steps.length - 1];
    if (lastStep.name.toLowerCase().includes("review") && (oldIndex === steps.length - 1 || newIndex === steps.length - 1)) {
      return;
    }
    
    // Reorder the steps
    form.setValue("workflow", arrayMove(steps, oldIndex, newIndex), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  // Enable or disable a step
  const toggleStep = (id: string) => {
    const updatedSteps = (steps as WorkflowStep[]).map((s: WorkflowStep) => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    form.setValue("workflow", updatedSteps, { shouldValidate: true, shouldDirty: true });
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
      enabled: true,
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

  const enabledCount = (steps as WorkflowStep[]).filter((s: WorkflowStep) => s.enabled).length;

  return (
    <div className="space-y-4">
      {/* Top Bar: Shows stats and action buttons */}
      <div className="flex items-center justify-between gap-4 pb-3 border-b">
        {/* Left: Step count and drag hint */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {enabledCount} of {steps.length} enabled
          </span>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            Drag <Bars3Icon className="inline h-3 w-3" /> to reorder
          </span>
        </div>
        
        {/* Right: Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={collapseAll}
            disabled={expandedSteps.size === 0}
            className="h-8 text-xs"
          >
            Collapse All
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetOrder}
            className="h-8 text-xs"
          >
            Reset Order
          </Button>
          <StepSelectorPopover onSelect={addStep} existingSteps={steps} />
        </div>
      </div>

      {/* Drag and drop container for all steps */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={(steps as WorkflowStep[]).map((s: WorkflowStep) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {/* Empty state */}
            {steps.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-lg">
                <p className="text-sm text-muted-foreground mb-3">No workflow steps yet</p>
                <StepSelectorPopover onSelect={addStep} />
              </div>
            ) : (
              /* Render each step */
              (steps as WorkflowStep[]).map((step: WorkflowStep, index: number) => {
                // Check if this step is locked (cannot be reordered)
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
                    onToggle={toggleStep}
                    onExpand={toggleExpand}
                    onConfigure={updateStepConfig}
                  />
                );
              })
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
