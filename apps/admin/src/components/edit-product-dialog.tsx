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
import { WorkflowBuilder } from "./workflow-builder";

// Helper function to check if a step has meaningful configuration (same as create dialog)
function hasConfiguredContent(step: { name: string; config?: Record<string, any> }): boolean {
  const config = step.config || {};
  const stepName = step.name.toLowerCase();
  
  // Financing Type: must have type object
  if (stepName.includes("financing type")) {
    return config.type && typeof config.type === 'object' && config.type.title;
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

// Form schema - same validation as create dialog
const editProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      config: z.record(z.any()).optional(),
    })
  )
    .min(1, "At least one workflow step is required")
    .refine(
      (steps) => {
        // Check that steps with required config are properly configured
        for (const step of steps) {
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
        message: "Financing Type step must be configured",
      }
    )
    .refine(
      (steps) => {
        // Check that at least one declaration exists
        const declarationStep = steps.find((s) => 
          s.name.toLowerCase().includes("declaration")
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
          s.name.toLowerCase().includes("document")
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

type EditProductFormValues = z.infer<typeof editProductSchema>;

interface EditProductDialogProps {
  product: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: EditProductDialogProps) {
  const updateProduct = useUpdateProduct();

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
    }
  }, [open, product, form]);

  const onSubmit = async (values: EditProductFormValues) => {
    try {
      // Clean up workflow: filter out empty document categories (same as create)
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

      // Send workflow array directly (same format as create)
      const payload = {
        workflow: cleanedWorkflow,
      };

      await updateProduct.mutateAsync({
        productId: product.id,
        data: payload,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating product:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product workflow steps - modify financing types, terms, documents, and declarations.
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
                s.name.toLowerCase().includes("financing type")
              );
              const declarationStep = steps.find((s: any) => 
                s.name.toLowerCase().includes("declaration")
              );
              const documentStep = steps.find((s: any) => 
                s.name.toLowerCase().includes("document")
              );
              
              const requiredItems = [];
              
              // Check if step exists but not configured
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
                disabled={updateProduct.isPending}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateProduct.isPending || !form.formState.isValid}
              >
                {updateProduct.isPending ? "Updating..." : "Update Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
