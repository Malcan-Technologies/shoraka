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
import { Input } from "../../../../components/ui/input";
import { Label } from "../../../../components/ui/label";
import { Skeleton } from "../../../../components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../components/ui/select";
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useRollbackProductCreate,
  useProductImageUploadUrl,
  useProductTemplateUploadUrl,
} from "../hooks/use-products";
import { uploadFileToS3 } from "../../../../hooks/use-site-documents";
import { stepDisplayName, getDefaultWorkflowSteps, getRequiredFirstAndLastSteps, type WorkflowStepShape } from "../product-utils";
import { getStepKeyFromStepId, STEP_KEY_DISPLAY, STEPS_WITHOUT_CONFIG } from "./workflow-registry";
import { enforceDeclarationsLastAndDropReview } from "@cashsouk/types";
import {
  getStepId,
  buildPayloadFromSteps,
  workflowDeepEqual,
  getRequiredStepErrors,
  getStepIdsWithErrors,
  FIRST_STEP_KEY,
  LAST_STEP_KEY,
  SUPPORTING_DOCS_STEP_KEY,
  BUSINESS_DETAILS_STEP_KEY,
  normalizeWorkflow,
} from "./product-form-helpers";
import { INPUT_CLASS, SELECT_TRIGGER_CLASS, FIELD_GAP } from "./product-form-input-styles";
import { AlertTriangle } from "lucide-react";
import { WorkflowStepCard } from "./workflow-step-card";
import { StepConfigEditor } from "./step-configs/step-config-editor";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, edit mode (load product and update). When null, create mode (default steps, empty name). */
  productId: string | null;
}

/** Presigned URL must use a whitelisted MIME type; browsers sometimes omit or misreport type for Excel. */
function contentTypeForProductTemplateUpload(file: File): string {
  const t = file.type?.trim();
  if (
    t === "application/pdf" ||
    t === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    t === "application/vnd.ms-excel"
  ) {
    return t;
  }
  const lower = file.name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const ext = dot >= 0 ? lower.slice(dot + 1) : "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (ext === "xls") return "application/vnd.ms-excel";
  return "application/pdf";
}

/** Create or edit product in a dialog: drag-and-drop workflow steps only. Version is auto-managed (1 on create, auto-increment on every update). No name field; each step has its own config. */
export function ProductFormDialog({ open, onOpenChange, productId }: ProductFormDialogProps) {
  const isEdit = productId !== null;
  const { data: product, isPending: loading, isError, error } = useProduct(productId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const rollbackProductCreate = useRollbackProductCreate();
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
  const [offerExpiryDays, setOfferExpiryDays] = useState<string>("7");
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

  const getKey = useCallback((s: unknown) => getStepKeyFromStepId(getStepId(s)), []);

  const ensureFirstAndLastPresent = useCallback((items: unknown[]): unknown[] => {
    const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
    let result = [...items];
    if (!result.some((s) => getKey(s) === FIRST_STEP_KEY)) {
      result = [firstStep, ...result];
    }
    if (!result.some((s) => getKey(s) === LAST_STEP_KEY)) {
      result = [...result.filter((s) => getKey(s) !== LAST_STEP_KEY), lastStep];
    }
    return result;
  }, [getKey]);

  const enforceFirstAndLast = useCallback((items: unknown[]): unknown[] => {
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
  }, [getKey]);

  useEffect(() => {
    if (!open) {
      setExpandedStepId(null);
      setPendingImageFile(null);
      pendingImageFileRef.current = null;
      setPendingSupportingDocTemplates({});
      setSaveInProgress(false);
      setSaveTriggered(false);
      setOfferExpiryDays("");
      initialWorkflowRef.current = [];
      return;
    }
    setSaveInProgress(false);
    setSaveTriggered(false);
    if (isEdit && product) {
      const raw = product.workflow?.length
        ? enforceDeclarationsLastAndDropReview(product.workflow as { id?: string }[])
        : getDefaultWorkflowSteps();
      const stepsToSet = enforceFirstAndLast(ensureFirstAndLastPresent(raw));
      setSteps(stepsToSet);
      initialWorkflowRef.current = normalizeWorkflow(
        buildPayloadFromSteps(stepsToSet)
      );
      const days = (product as { offer_expiry_days?: number | null }).offer_expiry_days;
      setOfferExpiryDays(days != null ? String(days) : "7");
    } else {
      const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
      setSteps([firstStep, lastStep]);
      initialWorkflowRef.current = [];
      setOfferExpiryDays("7");
    }
  }, [open, isEdit, product, ensureFirstAndLastPresent, enforceFirstAndLast]);

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
    const next = arrayMove(steps, oldIndex, newIndex);
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

  /** Upload pending image to S3 and write s3Key into the financing type step. Mutates nextSteps. Returns s3Key if uploaded. */
  const uploadImageAndMerge = async (
    productId: string,
    nextSteps: Record<string, unknown>[],
    onS3KeyUploaded: (key: string) => void
  ): Promise<string | null> => {
    const imageFile = pendingImageFile ?? pendingImageFileRef.current;
    if (!imageFile) return null;
    const { uploadUrl, s3Key } = await requestImageUrl.mutateAsync({
      productId,
      fileName: imageFile.name,
      contentType: imageFile.type,
      fileSize: imageFile.size,
    });
    await uploadFileToS3(uploadUrl, imageFile);
    onS3KeyUploaded(s3Key);
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
    return s3Key;
  };

  /** Upload all pending template files to S3 and merge s3Keys into the supporting documents step. Mutates nextSteps. Returns uploaded s3Keys. */
  const uploadTemplatesAndMerge = async (
    productId: string,
    nextSteps: Record<string, unknown>[],
    onS3KeyUploaded: (key: string) => void
  ): Promise<string[]> => {
    const keys: string[] = [];
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
        contentType: contentTypeForProductTemplateUpload(file),
        fileSize: file.size,
      });
      await uploadFileToS3(uploadUrl, file);
      onS3KeyUploaded(s3Key);
      keys.push(s3Key);
      if (categoryKey === "guarantor_agreement") {
        const bdIdx = nextSteps.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === BUSINESS_DETAILS_STEP_KEY);
        if (bdIdx >= 0) {
          const step = nextSteps[bdIdx] as Record<string, unknown>;
          const config = { ...((step.config ?? {}) as Record<string, unknown>) };
          config.guarantor_agreement_template = { s3_key: s3Key, file_name: file.name, file_size: file.size };
          step.config = config;
        }
        continue;
      }
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
    return keys;
  };

  const handleSave = async () => {
    if (saveInProgress) return;
    if (steps.length === 0) {
      toast.error("Add at least one step.");
      return;
    }
    setSaveInProgress(true);
    setSaveTriggered(true);
    let createdProductId: string | null = null;
    const uploadedS3Keys: string[] = [];
    try {
      let productId: string;
      if (isEdit && product) {
        productId = product.id;
      } else {
        const offerExpiryNum =
          offerExpiryDays.trim() !== ""
            ? (() => {
                const n = Number(offerExpiryDays);
                return !Number.isNaN(n) && n > 0 ? n : null;
              })()
            : null;
        const created = await createProduct.mutateAsync({
          workflow: buildPayloadFromSteps(steps),
          offer_expiry_days: offerExpiryNum,
        });
        productId = created.id;
        createdProductId = productId;
      }

      const nextSteps = steps.map((s) => ({
        ...(s as Record<string, unknown>),
        config: { ...((s as { config?: Record<string, unknown> }).config ?? {}) },
      }));

      const onS3KeyUploaded = (key: string) => uploadedS3Keys.push(key);
      await uploadImageAndMerge(productId, nextSteps, onS3KeyUploaded);
      await uploadTemplatesAndMerge(productId, nextSteps, onS3KeyUploaded);

      const payload = buildPayloadFromSteps(nextSteps);
      const offerExpiryNum =
        offerExpiryDays.trim() !== ""
          ? (() => {
              const n = Number(offerExpiryDays);
              return !Number.isNaN(n) && n > 0 ? n : null;
            })()
          : null;
      if (isEdit && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: { workflow: payload, offer_expiry_days: offerExpiryNum },
        });
        toast.success("Product updated");
      } else {
        await updateProduct.mutateAsync({
          id: productId,
          data: { workflow: payload, completeCreate: true, offer_expiry_days: offerExpiryNum },
        });
        toast.success("Product created");
      }
      onOpenChange(false);
    } catch {
      if (createdProductId) {
        try {
          await rollbackProductCreate.mutateAsync({
            id: createdProductId,
            s3Keys: uploadedS3Keys,
          });
        } catch {
          /* best-effort rollback; user already sees error */
        }
      }
      toast.error("Something went wrong. Please try again.");
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

    const normalizedCurrent = normalizeWorkflow(
  buildPayloadFromSteps(steps)
);

const normalizedInitial = initialWorkflowRef.current;

const isEqual = workflowDeepEqual(
  normalizedCurrent,
  normalizedInitial
);

/** Offer expiry validation: when provided, must be number > 0. Blank is allowed (optional). */
const offerExpiryError = (() => {
  const v = offerExpiryDays.trim();
  if (v === "") return null;
  const num = Number(v);
  if (Number.isNaN(num)) return "Offer expiry must be a number greater than 0";
  if (num <= 0) return "Offer expiry must be a number greater than 0";
  return null;
})();

const hasChanges = !isEdit
  ? true
  : Boolean(pendingImageFile ?? pendingImageFileRef.current) ||
    Object.keys(pendingSupportingDocTemplates).length > 0 ||
    (isEdit &&
      product &&
      (product as { offer_expiry_days?: number | null }).offer_expiry_days !==
        (offerExpiryDays.trim() === "" ? null : Number(offerExpiryDays))) ||
    !isEqual;

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
    const pendingSupportingOnly = Object.keys(pendingSupportingDocTemplates).filter(
      (k) => !k.startsWith("guarantor_agreement_")
    );
    const pendingGuarantorAgreementOnly = Object.keys(pendingSupportingDocTemplates).filter((k) =>
      k.startsWith("guarantor_agreement_")
    );
    const edited = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = getStepId(step);
      const stepKey = getStepKeyFromStepId(stepId);
      if (stepKey === FIRST_STEP_KEY && hasPendingImage) {
        edited.add(stepId);
        continue;
      }
      if (stepKey === SUPPORTING_DOCS_STEP_KEY && pendingSupportingOnly.length > 0) {
        edited.add(stepId);
        continue;
      }
      if (stepKey === BUSINESS_DETAILS_STEP_KEY && pendingGuarantorAgreementOnly.length > 0) {
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

  /** Step IDs with validation errors (for card outline highlight). */
  const stepIdsWithErrors = useMemo(() => getStepIdsWithErrors(steps), [steps]);

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
          <div
            aria-disabled={isSaving}
            className={`flex-1 min-h-0 overflow-y-auto min-w-0 ${isSaving ? "pointer-events-none opacity-70" : ""}`}
          >
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
                      <SelectTrigger className={cn("w-full sm:w-[200px] shrink-0", SELECT_TRIGGER_CLASS)}>
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
                                  hasError={stepIdsWithErrors.has(stepId)}
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
                                          ? {
                                              onPendingImageChange: handlePendingImageChange,
                                              pendingImageFile,
                                            }
                                          : stepKey === SUPPORTING_DOCS_STEP_KEY ||
                                              stepKey === BUSINESS_DETAILS_STEP_KEY
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

              {/* Offer settings — below workflow steps, card layout to match workflow container */}
              <div
                className={cn(
                  "rounded-xl border bg-card p-4 shrink-0 min-w-0",
                  offerExpiryError ? "border-amber-500/70 dark:border-amber-500/50" : "border-border"
                )}
              >
                <div className={cn("grid min-w-0", FIELD_GAP)}>
                  <Label htmlFor="offer-expiry-days" className="text-sm font-medium">
                    Offer expiry (days)
                  </Label>
                  <Input
                    id="offer-expiry-days"
                    type="text"
                    value={offerExpiryDays}
                    onChange={(e) => setOfferExpiryDays(e.target.value)}
                    placeholder="7"
                    className={INPUT_CLASS}
                  />
                  <p className="text-xs text-muted-foreground">
                    This defines how long an issuer has to accept the offer after it is generated.
                  </p>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {steps.length > 0 && !isSaving && !saveTriggered && (() => {
                  const requiredErrors = [
                    ...getRequiredStepErrors(steps),
                    ...(offerExpiryError ? ["Offer settings: " + offerExpiryError] : []),
                  ];
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
                  !!offerExpiryError ||
                  (isEdit && !hasChanges)
                }
              >
                {isSaving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
