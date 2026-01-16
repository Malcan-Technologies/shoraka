"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
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
import { useUpdateProduct } from "../hooks/use-products";
import { 
  useRequestProductImageUploadUrl, 
  useRequestProductImageReplaceUrl,
  uploadImageToS3 
} from "../hooks/use-product-images";
import { WorkflowBuilder } from "./workflow-builder";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";

/**
 * Check if a workflow step has been properly configured
 * (Same logic as create dialog)
 */
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

/**
 * Validation helper: Check if financing type step is configured
 */
function validateFinancingType(steps: any[]): boolean {
  const financingTypeStep = steps.find((s) => 
    s.name.toLowerCase().includes("financing type")
  );
  
  if (!financingTypeStep) {
    return false;
  }
  
  return hasConfiguredContent(financingTypeStep);
}

/**
 * Validation helper: Check if declaration step is configured
 */
function validateDeclaration(steps: any[]): boolean {
  const declarationStep = steps.find((s) => 
    s.name.toLowerCase().includes("declaration")
  );
  
  if (!declarationStep) {
    return true; // Optional
  }
  
  return hasConfiguredContent(declarationStep);
}

/**
 * Validation helper: Check if supporting documents step is configured
 */
function validateSupportingDocuments(steps: any[]): boolean {
  const documentStep = steps.find((s) => 
    s.name.toLowerCase().includes("document")
  );
  
  if (!documentStep) {
    return true; // Optional
  }
  
  return hasConfiguredContent(documentStep);
}

/**
 * Form validation schema (same as create dialog)
 */
const editProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.record(z.any()).optional(),
    })
  )
    .min(1, "At least one workflow step is required")
    .refine(validateFinancingType, {
      message: "Financing Type step must be configured with a product name",
    })
    .refine(validateDeclaration, {
      message: "Declaration step must have at least one declaration",
    })
    .refine(validateSupportingDocuments, {
      message: "Supporting Documents step must have at least one document",
    }),
});

type EditProductFormValues = z.infer<typeof editProductSchema>;

interface EditProductDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const updateProduct = useUpdateProduct();
  const requestUploadUrl = useRequestProductImageUploadUrl();
  const requestReplaceUrl = useRequestProductImageReplaceUrl();

  // Track pending image files by step ID (new files selected but not yet uploaded)
  const pendingFilesRef = React.useRef<Map<string, File>>(new Map());

  const form = useForm<EditProductFormValues>({
    resolver: zodResolver(editProductSchema),
    mode: "onChange",
    defaultValues: {
      workflow: product?.workflow || [],
    },
  });

  // Reset form with product data when dialog opens
  React.useEffect(() => {
    if (open && product?.workflow) {
      form.reset({
        workflow: Array.isArray(product.workflow) ? product.workflow : [],
      });
      // Clear pending files when dialog opens
      pendingFilesRef.current.clear();
    } else if (!open) {
      // Clear pending files when dialog closes
      pendingFilesRef.current.clear();
    }
  }, [open, product, form]);

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
  const handleFileSelected = React.useCallback((stepId: string, file: File | null) => {
    if (file) {
      pendingFilesRef.current.set(stepId, file);
    } else {
      pendingFilesRef.current.delete(stepId);
    }
  }, []);

  /**
   * Handle form submission
   * 1. Upload all pending images
   * 2. Clean up the workflow
   * 3. Send to API
   * 4. Close dialog on success
   */
  const onSubmit = async (values: EditProductFormValues) => {
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
          // Check if there's an existing S3 key (replace) or need to create new one (upload)
          const existingS3Key = step.config?.s3_key;
          
          let uploadData;
          if (existingS3Key) {
            // Replace existing image at same S3 key
            uploadData = await requestReplaceUrl.mutateAsync({
              s3Key: existingS3Key,
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
            });
          } else {
            // Upload new image (create new S3 key)
            uploadData = await requestUploadUrl.mutateAsync({
              fileName: file.name,
              contentType: file.type,
              fileSize: file.size,
              financingTypeName: step.config.name, // Use configured product name
            });
          }

          // Upload file directly to S3 (replaces if same key, creates if new key)
          await uploadImageToS3(uploadData.uploadUrl, file);

          // Update workflow step with S3 key and original file name
          step.config = {
            ...step.config,
            s3_key: uploadData.s3Key, // Same key if replacing, new key if uploading
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

      // Step 2: Prepare payload for API
      const payload = {
        workflow: cleanedWorkflow,
      };

      // Step 3: Update product via API (backend will delete old S3 files if S3 key changed)
      await updateProduct.mutateAsync({
        productId: product.id,
        data: payload,
      });
      
      // Clear pending files after successful save
      pendingFilesRef.current.clear();
      
      // Close dialog
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product workflow steps - modify financing types, terms, documents, and declarations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Workflow Builder */}
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
                missingItems.push("Declaration (add at least one)");
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
            disabled={updateProduct.isPending}
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={updateProduct.isPending || !form.formState.isValid}
          >
            {updateProduct.isPending ? "Updating..." : "Update Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
