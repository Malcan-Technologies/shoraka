"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../../components/ui/dialog";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import { useProduct, useCreateProduct, useUpdateProduct } from "../hooks/use-products";
import { stepDisplayName, getDefaultWorkflowSteps, type WorkflowStepShape } from "../product-utils";
import { getStepKeyFromStepId } from "@cashsouk/types";
import { WorkflowStepCard } from "./workflow-step-card";
import { StepConfigEditor } from "./step-configs/step-config-editor";
import { toast } from "sonner";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edit mode (load product and update). When null, create mode (default steps, empty name). */
  productId: string | null;
}

/** Create or edit product in a dialog: drag-and-drop workflow steps only. Version is auto-managed (1 on create, auto-increment on every update). No name field; each step has its own config. */
export function ProductFormDialog({ open, onOpenChange, productId }: ProductFormDialogProps) {
  const isEdit = productId !== null;
  const { data: product, isPending: loading, isError, error } = useProduct(productId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const [steps, setSteps] = useState<unknown[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [addStepValue, setAddStepValue] = useState<string>("");

  const allAvailableSteps = getDefaultWorkflowSteps();
  const addedIds = steps.map(getStepId);
  const addableSteps = allAvailableSteps.filter((s) => !addedIds.includes(s.id));

  useEffect(() => {
    if (!open) return;
    if (isEdit && product) {
      setSteps(
        product.workflow?.length
          ? (product.workflow as unknown[])
          : getDefaultWorkflowSteps()
      );
    } else if (!isEdit) {
      setSteps([]);
    }
  }, [open, isEdit, product]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = steps.findIndex((s) => getStepId(s) === active.id);
    const newIndex = steps.findIndex((s) => getStepId(s) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setSteps(arrayMove(steps, oldIndex, newIndex));
  };

  const handleAddStep = (stepToAdd: WorkflowStepShape) => {
    setSteps([...steps, { ...stepToAdd, config: stepToAdd.config ?? {} }]);
    setAddStepValue("");
  };

  const handleDeleteStep = (stepId: string) => {
    setSteps(steps.filter((s) => getStepId(s) !== stepId));
    if (expandedStepId === stepId) setExpandedStepId(null);
  };

  const handleConfigChange = (stepId: string, config: unknown) => {
    setSteps(
      steps.map((s) =>
        getStepId(s) === stepId ? { ...(s as Record<string, unknown>), config } : s
      )
    );
  };

  const handleSave = async () => {
    if (steps.length === 0) {
      toast.error("Add at least one step.");
      return;
    }
    try {
      if (isEdit && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: { workflow: steps },
        });
        toast.success("Product updated");
      } else {
        await createProduct.mutateAsync({ workflow: steps });
        toast.success("Product created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const isSaving = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Create product"}</DialogTitle>
        </DialogHeader>

        {isEdit && loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-48 w-full" />
          </div>
        ) : isEdit && (isError || !product) ? (
          <p className="text-destructive py-4">
            {error instanceof Error ? error.message : "Failed to load product."}
          </p>
        ) : (
          <div className="space-y-4 py-4">
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label>Workflow steps</Label>
                  <p className="text-xs text-muted-foreground">
                    Drag to reorder. Expand to configure. Add steps below.
                  </p>
                </div>
                {addableSteps.length > 0 && (
                  <Select
                    value={addStepValue}
                    onValueChange={(id) => {
                      const step = addableSteps.find((s) => s.id === id);
                      if (step) handleAddStep(step);
                    }}
                  >
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Add step" />
                    </SelectTrigger>
                    <SelectContent>
                      {addableSteps.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {steps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No steps. Add a step above.</p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={steps.map(getStepId)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {steps.map((step) => {
                        const stepId = getStepId(step);
                        const stepKey = getStepKeyFromStepId(stepId);
                        return (
                          <WorkflowStepCard
                            key={stepId}
                            step={{
                              id: stepId,
                              name: stepDisplayName(step),
                            }}
                            isExpanded={expandedStepId === stepId}
                            onOpenChange={(open) => setExpandedStepId(open ? stepId : null)}
                            onDelete={() => handleDeleteStep(stepId)}
                          >
                            {stepKey && (
                              <StepConfigEditor
                                stepKey={stepKey}
                                config={(step as { config?: unknown }).config}
                                onChange={(config) => handleConfigChange(stepId, config)}
                              />
                            )}
                          </WorkflowStepCard>
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        )}

        {!isEdit || product ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || steps.length === 0}>
              {isSaving ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
