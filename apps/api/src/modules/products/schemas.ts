import { z } from "zod";

// Workflow step schema
const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  config: z.record(z.unknown()).optional(),
});

// Create product input schema - workflow is an array of steps
export const createProductSchema = z.object({
  workflow: z.array(workflowStepSchema),
});

// Debug: Log schema shape to verify it's loaded correctly
if (process.env.NODE_ENV !== "production") {
  console.log("[Products Schema] createProductSchema expects workflow as array");
}

// Update product input schema
export const updateProductSchema = z.object({
  workflow: z.array(workflowStepSchema).optional(),
});

// Product ID parameter schema
export const productIdParamSchema = z.object({
  id: z.string().cuid(),
});

// Query parameters for listing products
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
});

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;