import { z } from "zod";

// Date range values (matches @cashsouk/config date-ranges.ts)
export const dateRangeValues = ["24h", "7d", "30d", "all"] as const;
export type DateRangeValue = (typeof dateRangeValues)[number];

// Workflow step schema
const workflowStepSchema = z.object({
  id: z.string(),
  name: z.string(),
  config: z.record(z.unknown()).optional(),
});

// Create product input schema - workflow is an array of steps
export const createProductSchema = z.object({
  workflow: z.array(workflowStepSchema),
});

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

// Product log event types
export const productEventTypes = [
  "PRODUCT_CREATED",
  "PRODUCT_UPDATED",
  "PRODUCT_DELETED",
] as const;

export type ProductEventType = (typeof productEventTypes)[number];

// Query params for product logs
export const getProductLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(15),
  search: z.string().optional(),
  eventType: z.enum(productEventTypes).optional(),
  dateRange: z.enum(dateRangeValues).default("all"),
});

export type GetProductLogsQuery = z.infer<typeof getProductLogsQuerySchema>;

// Export query params for product logs
export const exportProductLogsQuerySchema = z.object({
  search: z.string().optional(),
  eventType: z.enum(productEventTypes).optional(),
  eventTypes: z.array(z.enum(productEventTypes)).optional(),
  dateRange: z.enum(dateRangeValues).default("all"),
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportProductLogsQuery = z.infer<typeof exportProductLogsQuerySchema>;

// Product image upload URL request schema
export const requestProductImageUploadUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive(),
  financingTypeName: z.string().min(1), // Financing type name for folder structure
});

export type RequestProductImageUploadUrlInput = z.infer<
  typeof requestProductImageUploadUrlSchema
>;

// Product image download URL request schema
export const requestProductImageDownloadUrlSchema = z.object({
  s3Key: z.string().min(1),
});

export type RequestProductImageDownloadUrlInput = z.infer<
  typeof requestProductImageDownloadUrlSchema
>;

// Product image replace URL request schema (uses existing S3 key)
export const requestProductImageReplaceUrlSchema = z.object({
  s3Key: z.string().min(1), // Existing S3 key to replace
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().int().positive(),
});

export type RequestProductImageReplaceUrlInput = z.infer<
  typeof requestProductImageReplaceUrlSchema
>;

// Type exports
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
