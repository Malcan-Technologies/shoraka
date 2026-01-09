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
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useUpdateProduct } from "../hooks/use-products";
import { WorkflowBuilder } from "./workflow-builder";

const editProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean(),
      config: z.record(z.any()).optional(),
    })
  ).min(1, "At least one workflow step is required"),
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
    defaultValues: {
      workflow: product.workflow || [],
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        workflow: product.workflow || [],
      });
    }
  }, [open, product, form]);

  const onSubmit = async (values: EditProductFormValues) => {
    try {
      // Generate product name, category, and image from workflow financing types
      const financingTypeStep = values.workflow.find(s => 
        s.name.toLowerCase().includes("financing type")
      );
      const firstFinancingType = financingTypeStep?.config?.types?.[0];
      const productName = firstFinancingType?.title || product.name || "Product Workflow";
      const productCategory = firstFinancingType?.category || product.category || "Financing Product";
      const productImage = firstFinancingType?.image_url || product.image_url || null;
      
      await updateProduct.mutateAsync({
        productId: product.id,
        data: {
          data: {
            category: productCategory,
            name: productName,
            description: firstFinancingType?.description || product.description || null,
            image_url: productImage,
            workflow: values.workflow,
          },
        },
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateProduct.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateProduct.isPending}>
                {updateProduct.isPending ? "Updating..." : "Update Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
