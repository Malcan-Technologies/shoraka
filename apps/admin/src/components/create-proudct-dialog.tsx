"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { WorkflowBuilder } from "./workflow-builder";
import { useCreateProduct } from "../hooks/use-products";
import { useRequestProductImageUploadUrl, uploadImageToS3 } from "../hooks/use-product-images";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

// Schema with validation rules
const createProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.record(z.any()).optional(),
    })
  )
    .min(1, "At least one workflow step is required")
    .refine(validateFinancingType)
    .refine(validateDeclaration)
    .refine(validateSupportingDocuments),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Helper: Check if a workflow step has been properly configured
function hasConfiguredContent(step: { name: string; config?: Record<string, any> }): boolean {
  const config = step.config || {};
  const stepName = step.name.toLowerCase();

  // Financing Type step: Must have a product name
  if (stepName.includes("financing type")) {
    const hasName = config.name && typeof config.name === 'string' && config.name.trim().length > 0;
    return hasName;
  }

  // Supporting Documents step: Must have at least one document
  if (stepName.includes("document")) {
    if (!config.categories || !Array.isArray(config.categories)) {
      return false;
    }
    const hasDocuments = config.categories.some(
      (cat: any) => cat.documents && Array.isArray(cat.documents) && cat.documents.length > 0
    );
    return hasDocuments;
  }

  // Declaration step: Must have at least one declaration
  if (stepName.includes("declaration")) {
    const hasDeclarations = config.declarations && Array.isArray(config.declarations) && config.declarations.length > 0;
    return hasDeclarations;
  }

  // Other steps don't need configuration
  return true;
}

// Validation: Check if financing type step is configured
function validateFinancingType(steps: any[]): boolean {
  const financingTypeStep = steps.find((s) =>
    s.name.toLowerCase().includes("financing type")
  );

  if (!financingTypeStep) {
    return false; // Must have financing type step
  }

  return hasConfiguredContent(financingTypeStep);
}

// Validation: Check if declaration step is configured (if it exists)
function validateDeclaration(steps: any[]): boolean {
  const declarationStep = steps.find((s) =>
    s.name.toLowerCase().includes("declaration")
  );

  if (!declarationStep) {
    return true; // Declaration is optional
  }

  return hasConfiguredContent(declarationStep);
}

// Validation: Check if supporting documents step is configured (if it exists)
function validateSupportingDocuments(steps: any[]): boolean {
  const documentStep = steps.find((s) =>
    s.name.toLowerCase().includes("document")
  );

  if (!documentStep) {
    return true; // Documents are optional
  }

  return hasConfiguredContent(documentStep);
}

// Default workflow steps that appear when creating a new product
const DEFAULT_WORKFLOW = [
  { id: "financing_type_1", name: "Financing Type", config: {} },
  { id: "financing_structure_1", name: "Financing Structure", config: {} },
  { id: "contract_details_1", name: "Contract Details", config: {} },
  { id: "invoice_details_1", name: "Invoice Details", config: {} },
  { id: "company_details_1", name: "Company Details", config: {} },
  { id: "supporting_documents_1", name: "Supporting Documents", config: {} },
  { id: "declarations_1", name: "Declarations", config: {} },
  { id: "review_and_submit_1", name: "Review & Submit", config: {} },
];

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  // Hook to create product via API
  const createProduct = useCreateProduct();
  const requestUploadUrl = useRequestProductImageUploadUrl();

  // Track pending image files by step ID (files selected but not yet uploaded)
  const pendingFilesRef = React.useRef<Map<string, File>>(new Map());

  // Set up form with default workflow steps
  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    mode: "onChange", // Validate on change so button state updates
    defaultValues: {
      workflow: DEFAULT_WORKFLOW,
    },
  });

  // Reset form and clear pending files when dialog closes
  React.useEffect(() => {
    if (!open) {
      pendingFilesRef.current.clear();
      form.reset();
    }
  }, [open, form]);

  // Remove empty document categories before saving
  const cleanWorkflow = (workflow: any[]): any[] => {
    return workflow.map((step: any) => {
      // Only clean "Supporting Documents" steps
      if (step.name?.toLowerCase().includes("document") && step.config?.categories) {
        const categories = step.config.categories.filter(
          (cat: any) => cat.documents?.length > 0
        );

        return {
          ...step,
          config: {
            ...step.config,
            categories: categories.length > 0 ? categories : undefined,
          },
        };
      }

      return step;
    });
  };

  // Handle file selection from financing type config
  // Only financing type has images, so we only store one file
  const handleFileSelected = React.useCallback((stepId: string, file: File | null) => {
    if (file) {
      pendingFilesRef.current.set(stepId, file); // Store file for this step
    } else {
      pendingFilesRef.current.delete(stepId); // Remove file if user clears selection
    }
  }, []);

  // Handle form submission - upload images first, then save product
  const onSubmit = async (values: CreateProductFormValues) => {
    try {
      // Clean up workflow before saving (remove empty categories)
      let cleanedWorkflow = cleanWorkflow(values.workflow);

      // Step 1: Upload image if pending (only financing type has images)
      const pendingFiles = Array.from(pendingFilesRef.current.entries());

      if (pendingFiles.length > 0) {
        // There should only be one file (financing type step)
        const [stepId, file] = pendingFiles[0];

        // Find the financing type step
        const step = cleanedWorkflow.find((s: any) => s.id === stepId);

        if (!step || !step.config?.name) {
          toast.error("Cannot upload image", {
            description: "Please configure the financing type name before saving",
          });
          return;
        }

        try {
          // Request presigned upload URL
          const uploadData = await requestUploadUrl.mutateAsync({
            fileName: file.name,
            contentType: file.type,
            fileSize: file.size,
            financingTypeName: step.config.name, // Use configured product name
          });

          // Upload file directly to S3
          await uploadImageToS3(uploadData.uploadUrl, file);

          // Update workflow step with S3 key and original file name
          step.config = {
            ...step.config,
            s3_key: uploadData.s3Key,
            file_name: file.name, // Store original file name
          };

          // Remove from pending files
          pendingFilesRef.current.delete(stepId);
        } catch (error) {
          toast.error("Image upload failed", {
            description: error instanceof Error ? error.message : "Failed to upload image",
          });
          // Don't proceed with saving if upload fails
          return;
        }
      }

      // Step 2: Send workflow to API (now includes S3 keys)
      await createProduct.mutateAsync({
        workflow: cleanedWorkflow,
      });

      // Clear pending files after successful save
      pendingFilesRef.current.clear();

      // Close dialog on success
      onOpenChange(false);
      form.reset();
    } catch (error) {
      // Error is handled by the hook (shows toast)
      console.error("Error creating product:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Create Product</DialogTitle>
          <DialogDescription>
            Configure product workflow steps - add financing types, set terms, documents, and declarations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Workflow Builder - visual editor for workflow steps */}
            <FormField
              control={form.control}
              name="workflow"
              render={() => (
                <FormItem>
                  <WorkflowBuilder form={form} onFileSelected={handleFileSelected} />
                </FormItem>
              )}
            />

            {/* Show what still needs to be configured */}
            {(() => {
              const steps = form.watch("workflow") || [];
              const missingItems: string[] = [];

              // Check each required step
              const financingTypeStep = steps.find((s: any) =>
                s.name.toLowerCase().includes("financing type")
              );
              if (financingTypeStep && !hasConfiguredContent(financingTypeStep)) {
                missingItems.push("Financing Type (add at least one)");
              }


              const documentStep = steps.find((s: any) =>
                s.name.toLowerCase().includes("document")
              );
              if (documentStep && !hasConfiguredContent(documentStep)) {
                missingItems.push("Supporting Documents (add at least one)");
              }

              const declarationStep = steps.find((s: any) =>
                s.name.toLowerCase().includes("declaration")
              );
              if (declarationStep && !hasConfiguredContent(declarationStep)) {
                missingItems.push("Declarations (add at least one)");
              }

              // Show missing items if any
              if (missingItems.length > 0) {
                return (
                  <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-destructive/20">
                        <ExclamationTriangleIcon className="h-5 w-5 text-destructive flex-shrink-0" />
                      </div>
                      <p className="text-base font-semibold text-destructive">
                        Configuration Required
                      </p>
                    </div>
                    <p className="text-sm text-foreground">
                      The following items need to be configured before you can save:
                    </p>
                    <ul className="space-y-2.5">
                      {missingItems.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-sm text-foreground">
                          <span className="text-destructive">•</span>
                          <span className="font-medium">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}
            </form>
          </Form>
        </div>

        <DialogFooter className="px-6 pb-6 pt-4 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createProduct.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={createProduct.isPending || !form.formState.isValid}
          >
            {createProduct.isPending ? "Creating..." : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
