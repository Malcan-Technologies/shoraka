"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useProduct, useCreateProduct, useUpdateProduct, useProductImageUploadUrl, useProductDocumentTemplateUploadUrl } from "../hooks/use-products";
import { uploadFileToS3 } from "../../../../hooks/use-site-documents";
import { stepDisplayName, getDefaultWorkflowSteps, getRequiredFirstAndLastSteps, type WorkflowStepShape } from "../product-utils";
import { getStepKeyFromStepId, STEP_KEY_DISPLAY } from "@cashsouk/types";

const FIRST_STEP_KEY = "financing_type";
const LAST_STEP_KEY = "review_and_submit";
const SUPPORTING_DOCS_STEP_KEY = "supporting_documents";

/** Step keys that have no config UI in this dialog; no collapse arrow or config panel. */
const STEPS_WITHOUT_CONFIG = new Set([
  "financing_structure",
  "contract_details",
  "company_details",
  "business_details",
  "review_and_submit",
]);
import { AlertTriangle } from "lucide-react";
import { WorkflowStepCard } from "./workflow-step-card";
import { StepConfigEditor } from "./step-configs/step-config-editor";
import { toast } from "sonner";

function getStepId(step: unknown): string {
  return (step as { id?: string })?.id ?? "";
}

const SUPPORTING_DOC_CATEGORY_KEYS = ["financial_docs", "legal_docs", "compliance_docs", "others"] as const;

const INVOICE_DETAILS_STEP_KEY = "invoice_details";
const DECLARATIONS_STEP_KEY = "declarations";

/** Returns human-readable messages for steps that have config but missing required fields. All fields in every step are required (including description and image). */
function getRequiredStepErrors(
  steps: unknown[],
  opts?: { pendingImageFile?: File | null }
): string[] {
  const errors: string[] = [];
  const pendingImage = opts?.pendingImageFile ?? null;
  for (const step of steps) {
    const stepId = getStepId(step);
    const stepKey = getStepKeyFromStepId(stepId);
    const config = (step as { config?: Record<string, unknown> }).config ?? {};
    const stepLabel = STEP_KEY_DISPLAY[stepKey as keyof typeof STEP_KEY_DISPLAY]?.title ?? stepKey;

    if (stepKey === FIRST_STEP_KEY) {
      const name = (config.name as string)?.trim() ?? "";
      const category = (config.category as string)?.trim() ?? "";
      const description = (config.description as string)?.trim() ?? "";
      const image = config.image as { s3_key?: string } | undefined;
      const legacyS3Key = (config.s3_key as string)?.trim();
      const hasImage =
        Boolean((image?.s3_key as string)?.trim()) || Boolean(legacyS3Key) || Boolean(pendingImage);
      if (!name) errors.push(`${stepLabel}: enter name`);
      if (!category) errors.push(`${stepLabel}: enter category`);
      if (!description) errors.push(`${stepLabel}: enter description`);
      if (!hasImage) errors.push(`${stepLabel}: add an image`);
    }

    if (stepKey === SUPPORTING_DOCS_STEP_KEY) {
      let totalDocs = 0;
      let docsMissingName = 0;
      for (const key of SUPPORTING_DOC_CATEGORY_KEYS) {
        const list = config[key] as Array<{ name?: string }> | undefined;
        if (Array.isArray(list)) {
          for (const item of list) {
            totalDocs++;
            if (!(item?.name as string)?.trim()) docsMissingName++;
          }
        }
      }
      if (totalDocs === 0) {
        errors.push(`${stepLabel}: add at least one document with a name`);
      } else if (docsMissingName > 0) {
        errors.push(`${stepLabel}: every document must have a name`);
      }
    }

    if (stepKey === DECLARATIONS_STEP_KEY) {
      const raw = config.declarations;
      if (!Array.isArray(raw) || raw.length === 0) {
        errors.push(`${stepLabel}: add at least one declaration`);
      } else {
        const empty = raw.some((item: unknown) => {
          const text = typeof item === "object" && item != null && "text" in item
            ? String((item as { text: unknown }).text ?? "").trim()
            : typeof item === "string"
              ? item.trim()
              : "";
          return !text;
        });
        if (empty) errors.push(`${stepLabel}: every declaration must have text`);
      }
    }
  }
  return errors;
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
  const requestUploadUrl = useProductImageUploadUrl();
  const requestTemplateUploadUrl = useProductDocumentTemplateUploadUrl();
  const [steps, setSteps] = useState<unknown[]>([]);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [addStepValue, setAddStepValue] = useState<string>("");
  const [justAddedStepId, setJustAddedStepId] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingSupportingDocTemplates, setPendingSupportingDocTemplates] = useState<Record<string, File>>({});

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
      setPendingImageFile(null);
      setPendingSupportingDocTemplates({});
      return;
    }
    if (isEdit && product) {
      const raw = product.workflow?.length
        ? (product.workflow as unknown[])
        : getDefaultWorkflowSteps();
      setSteps(enforceFirstAndLast(ensureFirstAndLastPresent(raw)));
    } else {
      const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
      setSteps([firstStep, lastStep]);
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

  const handleSave = async () => {
    if (steps.length === 0) {
      toast.error("Add at least one step.");
      return;
    }
    try {
      let workflowToSave = steps;
      if (pendingImageFile) {
        const { uploadUrl, s3Key: newKey } = await requestUploadUrl.mutateAsync({
          fileName: pendingImageFile.name,
          contentType: pendingImageFile.type,
        });
        await uploadFileToS3(uploadUrl, pendingImageFile);
        const firstStep = steps.find((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY) as
          | { id: string; name?: string; config?: Record<string, unknown> }
          | undefined;
        if (firstStep) {
          const prevConfig = (firstStep.config ?? {}) as Record<string, unknown>;
          workflowToSave = steps.map((s) => {
            if (getStepId(s) !== firstStep.id) return s;
            return {
              ...(s as Record<string, unknown>),
              config: {
                ...prevConfig,
                image: {
                  s3_key: newKey,
                  file_name: pendingImageFile.name,
                  file_size: pendingImageFile.size,
                },
              },
            };
          });
        }
        setPendingImageFile(null);
      }
      const supportingDocEntries = Object.entries(pendingSupportingDocTemplates);
      if (supportingDocEntries.length > 0) {
        const supportingStep = workflowToSave.find(
          (s) => getStepKeyFromStepId(getStepId(s)) === SUPPORTING_DOCS_STEP_KEY
        ) as { id: string; name?: string; config?: Record<string, unknown> } | undefined;
        if (supportingStep) {
          let stepConfig = { ...(supportingStep.config ?? {}) } as Record<string, unknown>;
          for (const [slotKey, file] of supportingDocEntries) {
            const parts = slotKey.split("_");
            const indexStr = parts[parts.length - 1];
            const categoryKey = parts.slice(0, -1).join("_");
            const index = parseInt(indexStr, 10);
            if (Number.isNaN(index) || !categoryKey) continue;
            const { uploadUrl, s3Key } = await requestTemplateUploadUrl.mutateAsync({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
            });
            await uploadFileToS3(uploadUrl, file);
            const list = (stepConfig[categoryKey] as Record<string, unknown>[]) ?? [];
            const item = { ...(list[index] as Record<string, unknown> ?? {}), template: { s3_key: s3Key, file_name: file.name, file_size: file.size } };
            const nextList = [...list];
            nextList[index] = item;
            stepConfig = { ...stepConfig, [categoryKey]: nextList };
          }
          workflowToSave = workflowToSave.map((s) => {
            if (getStepId(s) !== supportingStep.id) return s;
            return { ...(s as Record<string, unknown>), config: stepConfig };
          });
        }
        setPendingSupportingDocTemplates({});
      }
      const workflowPayload = workflowToSave.map((s) => {
        const step = s as { id?: string; name?: string; config?: unknown };
        let config = (step.config ?? {}) as Record<string, unknown>;
        const stepKey = getStepKeyFromStepId(step.id ?? "");
        if (stepKey === INVOICE_DETAILS_STEP_KEY && (config.max_financing_rate_percent === undefined || config.max_financing_rate_percent === null)) {
          config = { ...config, max_financing_rate_percent: 80 };
        }
        return { ...step, config };
      });
      if (isEdit && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: { workflow: workflowPayload },
        });
        toast.success("Product updated");
      } else {
        await createProduct.mutateAsync({ workflow: workflowPayload });
        toast.success("Product created");
      }
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };

  const isSaving =
    createProduct.isPending ||
    updateProduct.isPending ||
    requestUploadUrl.isPending ||
    requestTemplateUploadUrl.isPending;

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-xl border-border">
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
              <div className="rounded-xl border border-border bg-card h-[420px] flex flex-col overflow-hidden">
                {steps.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center p-6 text-center">
                    <p className="text-sm text-muted-foreground">
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
                      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 space-y-2">
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
                                        ? { onPendingImageChange: setPendingImageFile }
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
          </div>
        )}

        {!isEdit || product ? (
          <>
            {steps.length > 0 && (() => {
              const requiredErrors = getRequiredStepErrors(steps, { pendingImageFile });
              if (requiredErrors.length === 0) return null;
              return (
                <div className="mx-4 -mt-3 rounded-lg border border-amber-500/70 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/50 dark:bg-amber-950/40">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" aria-hidden />
                    <p className="font-medium text-amber-900 dark:text-amber-100">
                      {isEdit ? "Complete these before saving" : "Complete these before create"}
                    </p>
                  </div>
                  <ul className="mt-1.5 list-disc list-inside space-y-0.5 pl-7 text-amber-800 dark:text-amber-200">
                    {requiredErrors.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving || steps.length === 0 || getRequiredStepErrors(steps, { pendingImageFile }).length > 0}
              >
                {isSaving ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
