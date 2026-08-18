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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@cashsouk/ui";
import {
  useProduct,
  useCreateProduct,
  useUpdateProduct,
  useRollbackProductCreate,
  useProductImageUploadUrl,
  useProductTemplateUploadUrl,
} from "../hooks/use-products";
import { uploadFileToS3 } from "@/lib/upload-file-to-s3";
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
import { SigningPackageConfig } from "./step-configs/signing-package-config";
import { AcceptanceDocumentsConfig } from "./step-configs/acceptance-documents-config";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  isSigningTemplateDocumentCategoryKey,
  parseSigningPackagesConfig,
  writeSigningPackagesConfig,
} from "@cashsouk/types";

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
  const [marketplaceListingDurationDays, setMarketplaceListingDurationDays] = useState<string>("14");
  const [serviceFeeRatePercent, setServiceFeeRatePercent] = useState<string>("15");
  const [defaultFacilityFeeRatePercent, setDefaultFacilityFeeRatePercent] = useState<string>("1");
  const [productCode, setProductCode] = useState<string>("");
  const [activeTab, setActiveTab] = useState("workflow");
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
      setMarketplaceListingDurationDays("");
      setServiceFeeRatePercent("");
      setDefaultFacilityFeeRatePercent("");
      setProductCode("");
      setActiveTab("workflow");
      initialWorkflowRef.current = [];
      return;
    }
    setSaveInProgress(false);
    setSaveTriggered(false);
    setActiveTab("workflow");
    if (isEdit && product) {
      const raw = product.workflow?.length
        ? enforceDeclarationsLastAndDropReview(product.workflow as { id?: string }[])
        : getDefaultWorkflowSteps();
      const stepsToSet = enforceFirstAndLast(ensureFirstAndLastPresent(raw));
      setSteps(stepsToSet);
      initialWorkflowRef.current = normalizeWorkflow(
        buildPayloadFromSteps(stepsToSet)
      );
      const listingDays = (product as { marketplace_listing_duration_days?: number | null })
        .marketplace_listing_duration_days;
      setMarketplaceListingDurationDays(listingDays != null ? String(listingDays) : "14");
      const serviceFee = (product as { service_fee_rate_percent?: number | null }).service_fee_rate_percent;
      setServiceFeeRatePercent(serviceFee != null ? String(serviceFee) : "15");
      const defaultFacility = (product as { default_facility_fee_rate_percent?: number | null }).default_facility_fee_rate_percent;
      setDefaultFacilityFeeRatePercent(defaultFacility != null ? String(defaultFacility) : "1");
      setProductCode((product as { product_code?: string | null }).product_code ?? "");
    } else {
      const [firstStep, lastStep] = getRequiredFirstAndLastSteps();
      setSteps([firstStep, lastStep]);
      initialWorkflowRef.current = [];
      setMarketplaceListingDurationDays("14");
      setServiceFeeRatePercent("15");
      setDefaultFacilityFeeRatePercent("1");
      setProductCode("");
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

  /** Financing-type step config — SigningPackageConfig migrates legacy dual / signing_template on read. */
  const getSigningPackagesStepConfig = useCallback((): Record<string, unknown> => {
    const firstStep = steps.find((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY);
    return (firstStep as { config?: Record<string, unknown> } | undefined)?.config ?? {};
  }, [steps]);

  const handleSigningPackagesChange = useCallback((nextConfig: Record<string, unknown>) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (getStepKeyFromStepId(getStepId(s)) !== FIRST_STEP_KEY) return s;
        return { ...(s as Record<string, unknown>), config: nextConfig };
      })
    );
  }, []);

  const handleAcceptanceDocumentsConfigChange = useCallback((nextConfig: Record<string, unknown>) => {
    setSteps((prev) =>
      prev.map((s) => {
        if (getStepKeyFromStepId(getStepId(s)) !== FIRST_STEP_KEY) return s;
        return { ...(s as Record<string, unknown>), config: nextConfig };
      })
    );
  }, []);

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
          const existing =
            config.guarantor_agreement && typeof config.guarantor_agreement === "object"
              ? ({ ...(config.guarantor_agreement as Record<string, unknown>) } as Record<string, unknown>)
              : {
                  name: "Guarantor agreement",
                  allow_multiple: false,
                  allowed_types: ["pdf"],
                  required: false,
                };
          delete config.guarantor_agreement_template;
          config.guarantor_agreement = {
            ...existing,
            template: { s3_key: s3Key, file_name: file.name, file_size: file.size },
          };
          step.config = config;
        }
        continue;
      }
      if (isSigningTemplateDocumentCategoryKey(categoryKey)) {
        const firstIdx = nextSteps.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY);
        if (firstIdx >= 0) {
          const step = nextSteps[firstIdx] as Record<string, unknown>;
          const config = { ...((step.config ?? {}) as Record<string, unknown>) };
          const template = parseSigningPackagesConfig(config);
          const documents = [...template.documents];
          const document = documents[index];
          if (document) {
            documents[index] = {
              ...document,
              template: { s3_key: s3Key, file_name: file.name, file_size: file.size },
            };
            step.config = writeSigningPackagesConfig(config, { ...template, documents });
          }
        }
        continue;
      }
      if (categoryKey === "acceptance_documents") {
        const firstIdx = nextSteps.findIndex((s) => getStepKeyFromStepId(getStepId(s)) === FIRST_STEP_KEY);
        if (firstIdx >= 0) {
          const step = nextSteps[firstIdx] as Record<string, unknown>;
          const config = { ...((step.config ?? {}) as Record<string, unknown>) };
          const list = ((config[categoryKey] as unknown[]) ?? []).slice();
          const item = (list[index] ?? {}) as Record<string, unknown>;
          const updated = {
            ...item,
            template: { s3_key: s3Key, file_name: file.name, file_size: file.size },
          };
          if (index >= list.length) {
            while (list.length < index) list.push({});
            list.push(updated);
          } else {
            list[index] = updated;
          }
          config[categoryKey] = list;
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
        const marketplaceListingDurationNum =
          marketplaceListingDurationDays.trim() !== ""
            ? (() => {
                const n = Number(marketplaceListingDurationDays);
                return !Number.isNaN(n) && n >= 1 && n <= 90 ? n : null;
              })()
            : null;
        const serviceFeeRatePercentNum =
          serviceFeeRatePercent.trim() !== ""
            ? (() => {
                const v = serviceFeeRatePercent.trim();
                const decimalOk =
                  /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
                const n = Number(v);
                return !Number.isNaN(n) && n >= 0 && n <= 15 && decimalOk ? n : null;
              })()
            : 15;
        const defaultFacilityFeeRatePercentNum =
          defaultFacilityFeeRatePercent.trim() !== ""
            ? (() => {
                const v = defaultFacilityFeeRatePercent.trim();
                const decimalOk =
                  /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
                const n = Number(v);
                return !Number.isNaN(n) && n >= 0 && n <= 1 && decimalOk ? n : null;
              })()
            : 1;
        const created = await createProduct.mutateAsync({
          workflow: buildPayloadFromSteps(steps),
          marketplace_listing_duration_days: marketplaceListingDurationNum,
          service_fee_rate_percent: serviceFeeRatePercentNum,
          default_facility_fee_rate_percent: defaultFacilityFeeRatePercentNum,
          product_code: productCode.trim().toUpperCase(),
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
      // Keep merged S3 keys in UI so a failed persist still looks dirty and can retry.
      // Do not advance initialWorkflowRef until the API update succeeds.
      setSteps(payload);
      const marketplaceListingDurationNum =
        marketplaceListingDurationDays.trim() !== ""
          ? (() => {
              const n = Number(marketplaceListingDurationDays);
              return !Number.isNaN(n) && n >= 1 && n <= 90 ? n : null;
            })()
          : null;
      const serviceFeeRatePercentNum =
        serviceFeeRatePercent.trim() !== ""
          ? (() => {
              const v = serviceFeeRatePercent.trim();
              const decimalOk =
                /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
              const n = Number(v);
              return !Number.isNaN(n) && n >= 0 && n <= 15 && decimalOk ? n : null;
            })()
          : 15;
      const defaultFacilityFeeRatePercentNum =
        defaultFacilityFeeRatePercent.trim() !== ""
          ? (() => {
              const v = defaultFacilityFeeRatePercent.trim();
              const decimalOk =
                /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
              const n = Number(v);
              return !Number.isNaN(n) && n >= 0 && n <= 1 && decimalOk ? n : null;
            })()
          : 1;
      if (isEdit && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: {
            workflow: payload,
            marketplace_listing_duration_days: marketplaceListingDurationNum,
            service_fee_rate_percent: serviceFeeRatePercentNum,
            default_facility_fee_rate_percent: defaultFacilityFeeRatePercentNum,
            ...(product.product_code
              ? {}
              : productCode.trim()
                ? { product_code: productCode.trim().toUpperCase() }
                : {}),
          },
        });
        initialWorkflowRef.current = normalizeWorkflow(payload);
        toast.success("Product updated");
      } else {
        await updateProduct.mutateAsync({
          id: productId,
          data: {
            workflow: payload,
            completeCreate: true,
            marketplace_listing_duration_days: marketplaceListingDurationNum,
            service_fee_rate_percent: serviceFeeRatePercentNum,
            default_facility_fee_rate_percent: defaultFacilityFeeRatePercentNum,
            product_code: productCode.trim().toUpperCase(),
          },
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

/** Marketplace listing duration validation: blank allowed (optional). */
const marketplaceListingDurationError = (() => {
  const v = marketplaceListingDurationDays.trim();
  if (v === "") return null;
  const num = Number(v);
  if (Number.isNaN(num)) return "Marketplace listing duration must be a number";
  if (num < 1 || num > 90) return "Marketplace listing duration must be between 1 and 90 days";
  return null;
})();

/** Service fee rate validation: blank allowed (optional). 0-15 inclusive. */
const serviceFeeRatePercentError = (() => {
  const v = serviceFeeRatePercent.trim();
  if (v === "") return null;
  const decimalOk =
    /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
  if (!decimalOk) return "Service fee rate must be between 0% and 15%, up to 2 decimal places";
  const num = Number(v);
  if (Number.isNaN(num)) return "Service fee rate must be a valid number";
  if (num < 0 || num > 15) return "Service fee rate must be between 0% and 15%";
  return null;
})();

/** Default facility fee rate validation: blank treated as default (1). 0-100 inclusive. */
const defaultFacilityFeeRatePercentError = (() => {
  const v = defaultFacilityFeeRatePercent.trim();
  if (v === "") return null;
  const decimalOk =
    /^\d+(\.\d{0,2})?$/.test(v) || /^\d+\.$/.test(v) || /^\.\d{1,2}$/.test(v);
  if (!decimalOk)
    return "Default facility fee rate must be between 0% and 100%, up to 2 decimal places";
  const num = Number(v);
  if (Number.isNaN(num)) return "Default facility fee rate must be a valid number";
  if (num < 0 || num > 100)
    return "Default facility fee rate must be between 0% and 100%";
  return null;
})();

const productCodeError = (() => {
  const normalized = productCode.trim().toUpperCase();
  if (!isEdit && normalized.length === 0) {
    return "Product code is required";
  }
  if (normalized.length === 0) return null;
  if (!/^[A-Z0-9]{2,8}$/.test(normalized)) {
    return "Product code must be 2-8 uppercase letters or digits (A-Z, 0-9)";
  }
  return null;
})();

const productCodeLocked = Boolean((product as { product_code_locked?: boolean } | undefined)?.product_code_locked);
const productCodeReadOnly =
  isEdit && (Boolean(product?.product_code) || productCodeLocked);

const hasChanges = !isEdit
  ? true
  : Boolean(pendingImageFile ?? pendingImageFileRef.current) ||
    Object.keys(pendingSupportingDocTemplates).length > 0 ||
    (product
      ? (product as { marketplace_listing_duration_days?: number | null }).marketplace_listing_duration_days !==
          (marketplaceListingDurationDays.trim() === "" ? null : Number(marketplaceListingDurationDays)) ||
        (product as { service_fee_rate_percent?: number | null }).service_fee_rate_percent !==
          (serviceFeeRatePercent.trim() === "" ? 15 : Number(serviceFeeRatePercent)) ||
        (product as { default_facility_fee_rate_percent?: number | null }).default_facility_fee_rate_percent !==
          (defaultFacilityFeeRatePercent.trim() === "" ? 1 : Number(defaultFacilityFeeRatePercent)) ||
        (!product.product_code &&
          productCode.trim().toUpperCase() !== ((product as { product_code?: string | null }).product_code ?? ""))
      : false) ||
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
    const pendingSigningTemplates = Object.keys(pendingSupportingDocTemplates).filter((k) =>
      k.startsWith("signing_template_document_")
    );
    const pendingAcceptanceTemplates = Object.keys(pendingSupportingDocTemplates).filter((k) =>
      k.startsWith("acceptance_documents_")
    );
    const pendingSupportingOnly = Object.keys(pendingSupportingDocTemplates).filter(
      (k) =>
        !k.startsWith("guarantor_agreement_") &&
        !k.startsWith("signing_template_document_") &&
        !k.startsWith("acceptance_documents_")
    );
    const pendingGuarantorAgreementOnly = Object.keys(pendingSupportingDocTemplates).filter((k) =>
      k.startsWith("guarantor_agreement_")
    );
    const edited = new Set<string>();
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepId = getStepId(step);
      const stepKey = getStepKeyFromStepId(stepId);
      if (
        stepKey === FIRST_STEP_KEY &&
        (hasPendingImage || pendingSigningTemplates.length > 0 || pendingAcceptanceTemplates.length > 0)
      ) {
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
      <DialogContent className="flex h-[90dvh] flex-col w-[calc(100vw-1rem)] sm:w-full max-w-4xl overflow-hidden rounded-xl border-border p-4 sm:p-6 gap-3 sm:gap-4">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-base sm:text-lg">{isEdit ? "Edit product" : "Create product"}</DialogTitle>
        </DialogHeader>

        {isEdit && loading ? (
          <div className="flex flex-1 flex-col min-h-0 gap-3 sm:gap-4 mt-2">
            <Skeleton className="h-10 w-full shrink-0 rounded-md" />

            {/* Header Row (exact spacing preserved) */}
            <div className="flex min-h-0 flex-1 flex-col gap-3 min-w-0">
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-3 w-64" />
                </div>
                <Skeleton className="h-9 w-full sm:w-[200px]" />
              </div>

              {/* Exact Workflow Container */}
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
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
            className={`flex flex-1 min-h-0 flex-col min-w-0 ${isSaving ? "pointer-events-none opacity-70" : ""}`}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="flex flex-1 min-h-0 flex-col gap-3"
            >
              <TabsList className="grid h-auto w-full shrink-0 grid-cols-4 gap-1">
                <TabsTrigger
                  value="workflow"
                  className="h-auto whitespace-normal px-1.5 py-2 text-center text-[11px] leading-snug sm:px-2 sm:text-sm"
                >
                  Workflow steps
                </TabsTrigger>
                <TabsTrigger
                  value="acceptance"
                  className="h-auto whitespace-normal px-1.5 py-2 text-center text-[11px] leading-snug sm:px-2 sm:text-sm"
                >
                  Acceptance
                </TabsTrigger>
                <TabsTrigger
                  value="signing"
                  className="h-auto whitespace-normal px-1.5 py-2 text-center text-[11px] leading-snug sm:px-2 sm:text-sm"
                >
                  Signing packages
                </TabsTrigger>
                <TabsTrigger
                  value="fees"
                  className="h-auto whitespace-normal px-1.5 py-2 text-center text-[11px] leading-snug sm:px-2 sm:text-sm"
                >
                  Fees & listing
                </TabsTrigger>
              </TabsList>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <TabsContent
                  value="workflow"
                  className="mt-0 flex min-h-0 flex-1 flex-col focus-visible:ring-0 data-[state=inactive]:hidden"
                >
                  <div className="flex min-h-0 flex-1 flex-col gap-2 min-w-0">
                    <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
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
                                                ? {
                                                    onPendingTemplateChange: handlePendingSupportingDocTemplate,
                                                    ...(stepKey === BUSINESS_DETAILS_STEP_KEY
                                                      ? {
                                                          pendingTemplateFile:
                                                            pendingSupportingDocTemplates[
                                                              "guarantor_agreement_0"
                                                            ] ?? null,
                                                        }
                                                      : {}),
                                                  }
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
                </TabsContent>

                <TabsContent
                  value="signing"
                  className="mt-0 min-h-0 flex-1 overflow-y-auto pr-1 focus-visible:ring-0 data-[state=inactive]:hidden"
                >
                  <SigningPackageConfig
                    config={getSigningPackagesStepConfig()}
                    onChange={handleSigningPackagesChange}
                  />
                </TabsContent>

                <TabsContent
                  value="acceptance"
                  className="mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:space-y-4 focus-visible:ring-0 data-[state=inactive]:hidden"
                >
                  <AcceptanceDocumentsConfig
                    config={getSigningPackagesStepConfig()}
                    onChange={handleAcceptanceDocumentsConfigChange}
                    onPendingTemplateChange={(index, file) =>
                      handlePendingSupportingDocTemplate("acceptance_documents", index, file)
                    }
                  />
                </TabsContent>

                <TabsContent
                  value="fees"
                  className="mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 sm:space-y-4 focus-visible:ring-0 data-[state=inactive]:hidden"
                >
                  <div
                    className={cn(
                      "rounded-xl border bg-card p-4 shrink-0 min-w-0",
                      productCodeError ? "border-amber-500/70 dark:border-amber-500/50" : "border-border"
                    )}
                  >
                    <div className={cn("grid min-w-0", FIELD_GAP)}>
                      <Label htmlFor="product-code" className="text-sm font-medium">
                        Product Code
                      </Label>
                      <Input
                        id="product-code"
                        type="text"
                        value={productCode}
                        onChange={(e) => setProductCode(e.target.value.toUpperCase())}
                        placeholder="ARF"
                        className={cn(INPUT_CLASS, "uppercase font-mono")}
                        readOnly={productCodeReadOnly}
                        aria-readonly={productCodeReadOnly}
                      />
                      <p className="text-xs text-muted-foreground">
                        Stable code used in CashSouk reference numbers, e.g. ARF. The code is shared by all
                        versions of this product and cannot be changed after references have been issued.
                      </p>
                      {productCodeLocked && (
                        <p className="text-xs text-muted-foreground">
                          This product code is locked because canonical references have already been allocated.
                        </p>
                      )}
                      {isEdit && product?.product_code && !productCodeLocked && (
                        <p className="text-xs text-muted-foreground">
                          Product code is inherited by new versions and cannot be changed here.
                        </p>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl border bg-card p-4 shrink-0 min-w-0",
                      serviceFeeRatePercentError ||
                        defaultFacilityFeeRatePercentError
                        ? "border-amber-500/70 dark:border-amber-500/50"
                        : "border-border"
                    )}
                  >
                    <div className={cn("grid min-w-0", FIELD_GAP)}>
                      <Label htmlFor="service-fee-rate-percent" className="text-sm font-medium">
                        Service fee rate (%)
                      </Label>
                      <Input
                        id="service-fee-rate-percent"
                        type="text"
                        value={serviceFeeRatePercent}
                        onChange={(e) => setServiceFeeRatePercent(e.target.value)}
                        placeholder="15"
                        className={INPUT_CLASS}
                      />
                      <p className="text-xs text-muted-foreground">
                        Percentage of investor profit retained as service fee. Allowed range: 0% to 15%, up to 2 decimal
                        places.
                      </p>

                      <Label
                        htmlFor="default-facility-fee-rate-percent"
                        className="text-sm font-medium"
                      >
                        Default facility fee rate (%)
                      </Label>
                      <Input
                        id="default-facility-fee-rate-percent"
                        type="text"
                        value={defaultFacilityFeeRatePercent}
                        onChange={(e) => setDefaultFacilityFeeRatePercent(e.target.value)}
                        placeholder="1"
                        className={INPUT_CLASS}
                      />
                      <p className="text-xs text-muted-foreground">
                        Default Facility Fee rate for new facility offers. Allowed range: 0% to 100%, up to 2 decimal
                        places. Admin can override this value before sending the facility offer.
                      </p>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl border bg-card p-4 shrink-0 min-w-0",
                      marketplaceListingDurationError
                        ? "border-amber-500/70 dark:border-amber-500/50"
                        : "border-border"
                    )}
                  >
                    <div className={cn("grid min-w-0", FIELD_GAP)}>
                      <Label
                        htmlFor="marketplace-listing-duration-days"
                        className="text-sm font-medium"
                      >
                        Marketplace listing duration (days)
                      </Label>
                      <Input
                        id="marketplace-listing-duration-days"
                        type="text"
                        value={marketplaceListingDurationDays}
                        onChange={(e) => setMarketplaceListingDurationDays(e.target.value)}
                        placeholder="14"
                        className={INPUT_CLASS}
                      />
                      <p className="text-xs text-muted-foreground">
                        Number of days this product&apos;s notes stay open in the investor marketplace after publishing.
                      </p>
                    </div>
                  </div>
                </TabsContent>
              </div>
            </Tabs>

            {steps.length > 0 && !isSaving && !saveTriggered && (() => {
              const requiredErrors = [
                ...getRequiredStepErrors(steps),
                ...(marketplaceListingDurationError
                  ? ["Marketplace listing settings: " + marketplaceListingDurationError]
                  : []),
                ...(serviceFeeRatePercentError ? ["Offer settings: " + serviceFeeRatePercentError] : []),
                ...(defaultFacilityFeeRatePercentError
                  ? ["Offer settings: " + defaultFacilityFeeRatePercentError]
                  : []),
                ...(productCodeError ? ["Product code: " + productCodeError] : []),
              ];
              if (requiredErrors.length === 0) return null;

              return (
                <div className="mt-3 shrink-0 rounded-lg border border-amber-500/70 bg-amber-50 px-4 py-3 dark:border-amber-500/50 dark:bg-amber-950/40">
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
                  !!marketplaceListingDurationError ||
                  !!serviceFeeRatePercentError ||
                  !!defaultFacilityFeeRatePercentError ||
                  !!productCodeError ||
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
