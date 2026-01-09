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
import { useCreateProduct} from "../hooks/use-products";
import { WorkflowBuilder } from "./workflow-builder";

// Helper function to check if a step has meaningful configuration
function hasConfiguredContent(step: { name: string; config?: Record<string, any> }): boolean {
  const config = step.config || {};
  const stepName = step.name.toLowerCase();
  
  // Financing Type: must have types array with at least one item
  if (stepName.includes("financing type")) {
    return config.types && Array.isArray(config.types) && config.types.length > 0;
  }
  
  // Financing Terms and Invoice Details: no configuration required (not yet implemented)
  if (stepName.includes("financing terms") || stepName.includes("invoice")) {
    return true;
  }
  
  // Supporting Documents: must have at least one document category with documents
  if (stepName.includes("document")) {
    if (!config.categories || !Array.isArray(config.categories)) return false;
    return config.categories.some(
      (cat: any) => cat.documents && Array.isArray(cat.documents) && cat.documents.length > 0
    );
  }
  
  // Declaration: must have at least one declaration
  if (stepName.includes("declaration")) {
    return config.declarations && Array.isArray(config.declarations) && config.declarations.length > 0;
  }
  
  // Invoice Details, Company Info, Review & Submit don't require config
  return true;
}

// Form schema - workflow is an array with validation
const createProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean(),
      config: z.record(z.any()).optional(),
    })
  )
    .min(1, "At least one workflow step is required")
    .refine(
      (steps) => {
        // At least one step must be enabled
        const enabledSteps = steps.filter((s) => s.enabled);
        return enabledSteps.length > 0;
      },
      {
        message: "At least one workflow step must be enabled",
      }
    )
    .refine(
      (steps) => {
        // Check that enabled steps with required config are properly configured
        const enabledSteps = steps.filter((s) => s.enabled);
        
        for (const step of enabledSteps) {
          const stepName = step.name.toLowerCase();
          
          // Financing Type is required and must be configured
          if (stepName.includes("financing type")) {
            if (!hasConfiguredContent(step)) {
              return false;
            }
          }
        }
        
        return true;
      },
      {
        message: "Financing Type step must be configured when enabled",
      }
    )
    .refine(
      (steps) => {
        // Check that at least one declaration exists
        const declarationStep = steps.find((s) => 
          s.enabled && s.name.toLowerCase().includes("declaration")
        );
        
        if (declarationStep) {
          const hasDeclaration = hasConfiguredContent(declarationStep);
          if (!hasDeclaration) {
            return false;
          }
        }
        
        return true;
      },
      {
        message: "At least one declaration must be configured",
      }
    )
    .refine(
      (steps) => {
        // Check that at least one supporting document exists
        const documentStep = steps.find((s) => 
          s.enabled && s.name.toLowerCase().includes("document")
        );
        
        if (documentStep) {
          const hasDocument = hasConfiguredContent(documentStep);
          if (!hasDocument) {
            return false;
          }
        }
        
        return true;
      },
      {
        message: "At least one supporting document must be configured",
      }
    ),
});

type CreateProductFormValues = z.infer<typeof createProductSchema>;

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_WORKFLOW: any[] = [
  { id: "financing_type_1", name: "Financing Type", enabled: true, config: {} },
  { id: "financing_terms_1", name: "Financing Terms", enabled: true, config: {} },
  { id: "invoice_details_1", name: "Invoice Details", enabled: true, config: {} },
  { id: "company_info_1", name: "Company Info", enabled: true, config: {} },
  { id: "supporting_documents_1", name: "Supporting Documents", enabled: true, config: {} },
  { id: "declaration_1", name: "Declaration", enabled: true, config: {} },
  { id: "review_submit_1", name: "Review & Submit", enabled: true, config: {} },
];

export function CreateProductDialog({ open, onOpenChange }: CreateProductDialogProps) {
  const createProduct = useCreateProduct();

  const form = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
    mode: "onChange", // Validate on change so button state updates
    defaultValues: {
      workflow: DEFAULT_WORKFLOW,
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (values: CreateProductFormValues) => {
    try {
      // Clean up workflow: filter out empty document categories
      const cleanedWorkflow = values.workflow.map((step) => {
        const stepName = step.name.toLowerCase();
        
        // For supporting documents, filter out categories with no documents
        if (stepName.includes("document") && step.config?.categories) {
          const filteredCategories = (step.config.categories as any[]).filter(
            (cat: any) => cat.documents && Array.isArray(cat.documents) && cat.documents.length > 0
          );
          
          return {
            ...step,
            config: {
              ...step.config,
              categories: filteredCategories.length > 0 ? filteredCategories : undefined,
            },
          };
        }
        
        return step;
      });

      // Send workflow array directly (stored as JSON in database)
      const payload = {
        workflow: cleanedWorkflow,
      };

      console.log("=".repeat(80));
      console.log("CREATE PRODUCT PAYLOAD");
      console.log("=".repeat(80));
      console.log(JSON.stringify(payload, null, 2));
      console.log("=".repeat(80));

      await createProduct.mutateAsync(payload);
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error("Error creating product:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Product</DialogTitle>
          <DialogDescription>
            Configure product workflow steps - add financing types, set terms, documents, and declarations.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Workflow Builder */}
            <FormField
              control={form.control}
              name="workflow"
              render={() => (
                <FormItem>
                  <WorkflowBuilder form={form} />
                </FormItem>
              )}
            />

            {/* Show required fields summary */}
            {(() => {
              const steps = form.watch("workflow") || [];
              const financingTypeStep = steps.find((s: any) => 
                s.enabled && s.name.toLowerCase().includes("financing type")
              );
              const declarationStep = steps.find((s: any) => 
                s.enabled && s.name.toLowerCase().includes("declaration")
              );
              const documentStep = steps.find((s: any) => 
                s.enabled && s.name.toLowerCase().includes("document")
              );
              
              const requiredItems = [];
              
              // Only check if step exists AND is enabled but not configured
              if (financingTypeStep && !hasConfiguredContent(financingTypeStep)) {
                requiredItems.push("Financing Type");
              }
              if (declarationStep && !hasConfiguredContent(declarationStep)) {
                requiredItems.push("Declaration");
              }
              if (documentStep && !hasConfiguredContent(documentStep)) {
                requiredItems.push("Supporting Documents");
              }
              
              if (requiredItems.length > 0) {
                return (
                  <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
                    <p className="text-sm font-medium">Required to complete:</p>
                    <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                      {requiredItems.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                );
              }
              return null;
            })()}

            <DialogFooter>
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
                disabled={createProduct.isPending || !form.formState.isValid}
              >
                {createProduct.isPending ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
