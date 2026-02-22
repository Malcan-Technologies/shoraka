"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
import { useProduct, useCreateProduct, useUpdateProduct, useProductImageUploadUrl, useProductTemplateUploadUrl } from "../hooks/use-products";
import { uploadFileToS3 } from "../../../../hooks/use-site-documents";
import { stepDisplayName, getDefaultWorkflowSteps, getRequiredFirstAndLastSteps, type WorkflowStepShape } from "../product-utils";
import { getStepKeyFromStepId, STEP_KEY_DISPLAY, STEPS_WITHOUT_CONFIG } from "./workflow-registry";
import {
  getStepId,
  buildPayloadFromSteps,
  workflowDeepEqual,
  getRequiredStepErrors,
  FIRST_STEP_KEY,
  LAST_STEP_KEY,
  SUPPORTING_DOCS_STEP_KEY,
} from "./product-form-helpers";
import { AlertTriangle } from "lucide-react";
import { WorkflowStepCard } from "./workflow-step-card";
import { StepConfigEditor } from "./step-configs/step-config-editor";
import { toast } from "sonner";

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
  const requestImageUrl = useProductImageUploadUrl();
  const requestTemplateUrl = useProductTemplateUploadUrl();
  const [steps, setSteps] = useState<unknown[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [addStepValue, setAddStepValue] = useState<string>("");
  const [justAddedStepId, setJustAddedStepId] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const pendingImageFileRef = useRef<File | null>(null);
  const [pendingSupportingDocTemplates, setPendingSupportingDocTemplates] = useState<Record<string, File>>({});
  const [saveInProgress, setSaveInProgress] = useState(false);
  const [saveTriggered, setSaveTriggered] = useState(false);
  /** In edit mode, workflow as loaded from product (normalized). Used to disable Save when nothing changed. */
  const initialWorkflowRef = useRef<unknown[]>([]);

  /** Store pending image; upload happens only on Save. */
  const handlePendingImageChange = useCallback((file: File | null) => {
    setPendingImageFile(file);
    pendingImageFileRef.current = file;
    setSteps((prev) => {
      const firstIdx = prev.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY);
      if (firstIdx === -1) return prev;
      const first = prev[firstIdx] as { id: string; config?: Record<string, unknown> };
      const config = { ...(first.config ?? {}), _pendingImage: !!file };
      return prev.map((s, i) =>
        i === firstIdx ? { ...(s as Record<string, unknown>), config } : s
      );
    });
  }, []);

  const allAvailableSteps = getDefaultWorkflowSteps();
  const addedIds = steps.map(getStepId);
  const addableSteps = allAvailableSteps.filter((s) => !addedIds.includes(s.id));

  function getKey(s: unknown) {
    return getStepKeyFromStepId(getStepId(s));
  }

  function ensureFirstAndLastPresent(items: unknown[]): unknown[] {
    const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
    let result = [...items];
    if (!result.some((s) => getKey(s) === FIRST_STEP_KEY)) {
      result = [firstStep, ...result];
    }
    if (!result.some((s) => getKey(s) === LAST_STEP_KEY)) {
      result = [...result, lastStep];
    }
    return result;
  }

  function enforceFirstAndLast(items: unknown[]): unknown[] {
    if (items.length === 0) return items;
    let result = [...items];
    const firstIdx = result.findIndex((s) => getKey(s) === FIRST_STEP_KEY);
    if (firstIdx >= 0 && getKey(result[0]) !== FIRST_STEP_KEY) {
      result = arrayMove(result, firstIdx, 0);
    }
    const lastIdx = result.findIndex((s) => getKey(s) === LAST_STEP_KEY);
    if (lastIdx >= 0 && getKey(result[result.length - 1]) !== LAST_STEP_KEY) {
      result = arrayMove(result, lastIdx, result.length - 1);
    }
    return result;
  }

  useEffect(() => {
    if (!open) {
      setExpandedStepId(null);
      setPendingImageFile(null);
      pendingImageFileRef.current = null;
      setPendingSupportingDocTemplates({});
      setSaveInProgress(false);
      setSaveTriggered(false);
      initialWorkflowRef.current = [];
      return;
    }
    setSaveInProgress(false);
    setSaveTriggered(false);
    if (isEdit && product) {
      const raw = product.workflow?.length
        ? (product.workflow as unknown[])
        : getDefaultWorkflowSteps();
      const stepsToSet = enforceFirstAndLast(ensureFirstAndLastPresent(raw));
      setSteps(stepsToSet);
      initialWorkflowRef.current = buildPayloadFromSteps(stepsToSet);
    } else {
      const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
      setSteps([firstStep, lastStep]);
      initialWorkflowRef.current = [];
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
    let next = arrayMove(steps, oldIndex, newIndex);
    setSteps(enforceFirstAndLast(next));
  };

  const handleAddStep = (stepToAdd: WorkflowStepShape) => {
    const last = steps[steps.length - 1];
    const newStep = { ...stepToAdd, config: stepToAdd.config ?? {} };
    const middle = [...steps.slice(0, -1), newStep];
    setSteps([...middle, last]);
    setAddStepValue("");
    setJustAddedStepId(stepToAdd.id);
  };

  useEffect(() => {
    if (!justAddedStepId) return;
    const t = setTimeout(() => setJustAddedStepId(null), 3000);
    return () => clearTimeout(t);
  }, [justAddedStepId]);

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

  /** Upload pending image to S3 and write s3Key into the financing type step. Mutates nextSteps. */
  const uploadImageAndMerge = async (productId: string, nextSteps: Record<string, unknown>[]) => {
    const imageFile = pendingImageFile ?? pendingImageFileRef.current;
    if (!imageFile) return;
    const { uploadUrl, s3Key } = await requestImageUrl.mutateAsync({
      productId,
      fileName: imageFile.name,
      contentType: imageFile.type,
      fileSize: imageFile.size,
    });
    await uploadFileToS3(uploadUrl, imageFile);
    const firstIdx = nextSteps.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY);
    if (firstIdx >= 0) {
      const step = nextSteps[firstIdx] as Record<string, unknown>;
      (step.config as Record<string, unknown>).image = {
        s3_key: s3Key,
        file_name: imageFile.name,
        file_size: imageFile.size,
      };
    }
    setPendingImageFile(null);
    pendingImageFileRef.current = null;
  };

  /** Upload all pending template files to S3 and merge s3Keys into the supporting documents step. Mutates nextSteps. */
  const uploadTemplatesAndMerge = async (productId: string, nextSteps: Record<string, unknown>[]) => {
    for (const [slotKey, file] of Object.entries(pendingSupportingDocTemplates)) {
      const parts = slotKey.split("_");
      const categoryKey = parts.slice(0, -1).join("_");
      const index = parseInt(parts[parts.length - 1], 10);
      if (Number.isNaN(index) || !categoryKey) continue;
      const { uploadUrl, s3Key } = await requestTemplateUrl.mutateAsync({
        productId,
        categoryKey,
        templateIndex: index,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });
      await uploadFileToS3(uploadUrl, file);
      const supportIdx = nextSteps.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === SUPPORTING_DOCS_STEP_KEY);
      if (supportIdx >= 0) {
        const step = nextSteps[supportIdx] as Record<string, unknown>;
        const config = (step.config ?? {}) as Record<string, unknown>;
        const list = ((config[categoryKey] as unknown[]) ?? []).slice();
        const item = (list[index] ?? {}) as Record<string, unknown>;
        const updated = { ...item, template: { s3_key: s3Key, file_name: file.name, file_size: file.size } };
        if (index >= list.length) {
          while (list.length < index) list.push({});
          list.push(updated);
        } else {
          list[index] = updated;
        }
        config[categoryKey] = list;
        (step as Record<string, unknown>).config = config;
      }
    }
    setPendingSupportingDocTemplates({});
  };

  const handleSave = async () => {
    if (steps.length === 0) {
      toast.error("Add at least one step.");
      return;
    }
    setSaveInProgress(true);
    setSaveTriggered(true);
    try {
      let productId: string;
      if (isEdit && product) {
        productId = product.id;
      } else {
        const created = await createProduct.mutateAsync({
          workflow: buildPayloadFromSteps(steps),
        });
        productId = created.id;
      }

      const nextSteps = steps.map((s) => ({
        ...(s as Record<string, unknown>),
        config: { ...((s as { config?: Record<string, unknown> }).config ?? {}) },
      }));

      await uploadImageAndMerge(productId, nextSteps);
      await uploadTemplatesAndMerge(productId, nextSteps);

      const payload = buildPayloadFromSteps(nextSteps);
      if (isEdit && product) {
        await updateProduct.mutateAsync({ id: product.id, data: { workflow: payload } });
        toast.success("Product updated");
      } else {
        await updateProduct.mutateAsync({ id: productId, data: { workflow: payload, completeCreate: true } });
        toast.success("Product created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaveInProgress(false);
    }
  };

  const isSaving =
    saveInProgress ||
    createProduct.isPending ||
    updateProduct.isPending ||
    requestImageUrl.isPending ||
    requestTemplateUrl.isPending;

  const hasChanges = !isEdit
    ? true
    : Boolean(pendingImageFile ?? pendingImageFileRef.current) ||
    Object.keys(pendingSupportingDocTemplates).length > 0 ||
    !workflowDeepEqual(buildPayloadFromSteps(steps), initialWorkflowRef.current);

  /** In edit mode, step ids that have unsaved changes (for "Edited" badge on cards). */
  const editedStepIds = useMemo(() => {
    if (!isEdit) return new Set<string>();
    const initial = initialWorkflowRef.current;
    const currentPayload = buildPayloadFromSteps(steps);
    const initialById = new Map<string, unknown>();
    for (const s of initial) {
      initialById.set(getStepId(s), s);
    }
    const hasPendingImage = Boolean(pendingImageFile ?? pendingImageFileRef.current);
    const hasPendingTemplates = Object.keys(pendingSupportingDocTemplates).length > 0;
    const edited = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = getStepId(step);
      const stepKey = getStepKeyFromStepId(stepId);
      if (stepKey === FIRST_STEP_KEY && hasPendingImage) {
        edited.add(stepId);
        continue;
      }
      if (stepKey === SUPPORTING_DOCS_STEP_KEY && hasPendingTemplates) {
        edited.add(stepId);
        continue;
      }
      const initialStep = initialById.get(stepId);
      if (!initialStep) {
        edited.add(stepId);
        continue;
      }
      if (!workflowDeepEqual(currentPayload[i], initialStep)) edited.add(stepId);
    }
    return edited;
  }, [isEdit, steps, pendingImageFile, pendingSupportingDocTemplates]);

  /** Store pending template file; upload happens only on Save. */
  const handlePendingSupportingDocTemplate = useCallback(
    (categoryKey: string, index: number, file: File | null) => {
      const slotKey = `${categoryKey}_${index}`;
      setPendingSupportingDocTemplates((prev) => {
        const next = { ...prev };
        if (file) next[slotKey] = file;
        else delete next[slotKey];
        return next;
      });
    },
    []
  );


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className=" flex flex-col w-[calc(100vw-1rem)] sm:w-full max-w-4xl max-h-[90dvh] overflow-hidden rounded-xl border-border p-4 sm:p-6 gap-3 sm:gap-4 " >
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base sm:text-lg">{isEdit ? "Edit product" : "Create product"}</DialogTitle>
        </DialogHeader>

        {isEdit && loading ? (
          <div className="flex flex-1 flex-col min-h-0 gap-3 sm:gap-4 mt-2">

            {/* Header Row (exact spacing preserved) */}
            <div className="grid gap-3 shrink-0 min-w-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-9 w-full sm:w-[200px]" />
              </div>

              {/* Exact Workflow Container */}
              <div className="rounded-xl border border-border bg-card h-[240px] min-h-0 flex flex-col overflow-hidden sm:h-[320px] md:h-[420px]">
                <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-2 sm:p-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-border bg-background p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-4 w-4 rounded-sm" />
                          <Skeleton className="h-4 w-40" />
                        </div>
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>


          </div>
        ) : isEdit && (isError || !product) ? (
          <p className="text-destructive py-4 text-sm">
            {error instanceof Error ? error.message : "Failed to load product."}
          </p>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="flex flex-col gap-3 sm:gap-4 pr-1">
              <div className="grid gap-2 shrink-0 min-w-0">
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Label className="text-sm font-medium">Workflow steps</Label>
                    <p className="text-sm text-muted-foreground">
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
                      <SelectTrigger className="w-full sm:w-[200px] h-9 shrink-0">
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
                <div className="rounded-xl border border-border bg-card h-[240px] min-h-0 flex flex-col overflow-hidden sm:h-[320px] md:h-[420px]">
                  {steps.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center p-6 text-center">
                      <p className="text-sm text-muted-foreground leading-6">
                        No steps yet. Use &quot;Add step&quot; above to add steps here.
                      </p>
                    </div>
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
                        <div className="flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden p-3 space-y-2 sm:p-4">
                          {steps.map((step) => {
                            const stepId = getStepId(step);
                            const stepKey = getStepKeyFromStepId(stepId);
                            const hasConfig = stepKey && !STEPS_WITHOUT_CONFIG.has(stepKey);
                            return (
                              <div key={stepId} className="relative">
                                <WorkflowStepCard
                                  step={{
                                    id: stepId,
                                    name:
                                      stepKey === FIRST_STEP_KEY
                                        ? STEP_KEY_DISPLAY.financing_type.title
                                        : stepDisplayName(step),
                                  }}
                                  isExpanded={expandedStepId === stepId}
                                  onOpenChange={
                                    hasConfig ? (open) => setExpandedStepId(open ? stepId : null) : undefined
                                  }
                                  onDragHandlePointerDown={() => setExpandedStepId(null)}
                                  isLocked={stepKey === FIRST_STEP_KEY || stepKey === LAST_STEP_KEY}
                                  isJustAdded={stepId === justAddedStepId}
                                  isEdited={editedStepIds.has(stepId)}
                                  onDelete={
                                    stepKey !== FIRST_STEP_KEY && stepKey !== LAST_STEP_KEY
                                      ? () => handleDeleteStep(stepId)
                                      : undefined
                                  }
                                >
                                  {hasConfig && (
                                    <StepConfigEditor
                                      stepKey={stepKey}
                                      config={(step as { config?: unknown }).config}
                                      onChange={(config) => handleConfigChange(stepId, config)}
                                      extraProps={
                                        stepKey === FIRST_STEP_KEY
                                          ? { onPendingImageChange: handlePendingImageChange }
                                          : stepKey === SUPPORTING_DOCS_STEP_KEY
                                            ? { onPendingTemplateChange: handlePendingSupportingDocTemplate }
                                            : undefined
                                      }
                                    />
                                  )}
                                </WorkflowStepCard>
                              </div>
                            );
                          })}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {steps.length > 0 && !isSaving && !saveTriggered && (() => {
                  const requiredErrors = getRequiredStepErrors(steps);
                  if (requiredErrors.length === 0) return null;

                  return (
                    <div className="rounded-lg border border-amber-500/70 bg-amber-50 px-4 py-3 dark:border-amber-500/50 dark:bg-amber-950/40">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500"
                          aria-hidden
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                            {isEdit ? "Complete the following before saving" : "Complete the following before creating"}
                          </p>
                          <ul className="mt-2 list-disc pl-5 space-y-0.5 text-amber-800 dark:text-amber-200">
                            {requiredErrors.map((msg, i) => {
                              const [label, rest] = msg.split(":");
                              return (
                                <li key={i} className="text-sm leading-6">
                                  <span className="font-medium text-amber-900 dark:text-amber-100">
                                    {label}
                                  </span>
                                  <span className="text-amber-800/90 dark:text-amber-200/90">
                                    : {rest}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {!isEdit || product ? (
          <div className="shrink-0 flex flex-col gap-4 min-w-0">
            <DialogFooter className="shrink-0 flex-wrap gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  isSaving ||
                  steps.length === 0 ||
                  getRequiredStepErrors(steps).length > 0 ||
                  (isEdit && !hasChanges)
                }
              >
                {isSaving ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
