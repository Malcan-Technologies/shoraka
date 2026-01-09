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
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useCreateProduct} from "../hooks/use-products";
import { WorkflowBuilder } from "./workflow-builder";

const createProductSchema = z.object({
  workflow: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      enabled: z.boolean(),
      config: z.record(z.any()).optional(),
    })
  ).min(1, "At least one workflow step is required"),
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
      // Generate product name, category, and image from workflow financing types
      const financingTypeStep = values.workflow.find(s =>
        s.name.toLowerCase().includes("financing type")
      );
      const firstFinancingType = financingTypeStep?.config?.types?.[0];
      const productName = firstFinancingType?.title || "Product Workflow";
      const productCategory = firstFinancingType?.category || "Financing Product";
      const productImage = firstFinancingType?.image_url || null;

      const payload = {
        data: {
          category: productCategory,
          name: productName,
          description: firstFinancingType?.description || null,
          image_url: productImage,
          workflow: values.workflow,
        },
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
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={createProduct.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createProduct.isPending}>
                {createProduct.isPending ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
