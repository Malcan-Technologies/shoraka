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
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useImageUpload } from "../hooks/use-image-upload";
import { getPendingFiles, clearPendingFile } from "./workflow-steps/financing-type-config";

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
    const hasName = config.type && typeof config.type === 'object' && config.type.name;
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
  { id: "financing_terms_1", name: "Financing Terms", config: {} },
  { id: "invoice_details_1", name: "Invoice Details", config: {} },
  { id: "company_info_1", name: "Company Info", config: {} },
  { id: "supporting_documents_1", name: "Supporting Documents", config: {} },
  { id: "declaration_1", name: "Declaration", config: {} },
  { id: "review_submit_1", name: "Review & Submit", config: {} },
];

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  // Hook to create product via API
  const createProduct = useCreateProduct();
  const uploadImage = useImageUpload();

  // Set up form with default workflow steps
  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    mode: "onChange", // Validate on change so button state updates
    defaultValues: {
      workflow: DEFAULT_WORKFLOW,
    },
  });

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
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

  // Handle form submission - send to API
  const onSubmit = async (values: CreateProductFormValues) => {
    try {
      // Clean up workflow before saving (remove empty categories)
      let cleanedWorkflow = cleanWorkflow(values.workflow);

      // Upload pending images and update s3_key in config
      const pendingFilesMap = getPendingFiles();
      cleanedWorkflow = await Promise.all(
        cleanedWorkflow.map(async (step: any) => {
          if (step.config?.type?._pendingFileId) {
            const fileId = step.config.type._pendingFileId;
            const pendingFile = pendingFilesMap.get(fileId);
            
            if (pendingFile) {
              try {
                const s3Key = await uploadImage.mutateAsync({
                  file: pendingFile.file,
                  financingTypeName: pendingFile.financingTypeName,
                });
                
                // Update config with s3_key and remove pending file ID
                step.config.type.s3_key = s3Key;
                delete step.config.type._pendingFileId;
                clearPendingFile(fileId);
              } catch (error) {
                console.error("Failed to upload image:", error);
                throw error;
              }
            }
          }
          return step;
        })
      );

      // Send workflow to API
      await createProduct.mutateAsync({
        workflow: cleanedWorkflow,
      });
      
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
                  <WorkflowBuilder form={form} />
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
