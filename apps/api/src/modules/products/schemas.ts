import { z } from "zod";

// Date range values (matches @cashsouk/config date-ranges.ts)
export const dateRangeValues = ["24h", "7d", "30d", "all"] as const;
export type DateRangeValue = (typeof dateRangeValues)[number];

// Product log event types (audit trail for product lifecycle events)
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

// Query params for products list (admin)
export const getProductsListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().optional(),
});

export type GetProductsListQuery = z.infer<typeof getProductsListQuerySchema>;

// Body for POST /v1/products (create). Version defaults to 1; not accepted from client.
export const createProductBodySchema = z.object({
  workflow: z.array(z.unknown()).min(1),
});

export type CreateProductBody = z.infer<typeof createProductBodySchema>;

// Body for PATCH /v1/products/:id. Version is auto-incremented on every update; not accepted from client.
export const updateProductBodySchema = z.object({
  workflow: z.array(z.unknown()).optional(),
});

export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;

// Body for POST /v1/products/upload-image-url (admin). Returns presigned URL + s3Key. Path: products/{productId}/{date}-{version}-{cuid}.{ext}
export const productImageUploadUrlBodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((v) => v.startsWith("image/"), {
    message: "Only image types are allowed",
  }),
  productId: z.string().min(1),
  version: z.number().int().positive(),
});

export type ProductImageUploadUrlBody = z.infer<typeof productImageUploadUrlBodySchema>;

const ALLOWED_DOCUMENT_TEMPLATE_TYPES = ["application/pdf"];

const MAX_TEMPLATE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Body for POST /v1/products/upload-document-template-url (admin). Returns presigned URL + s3Key. Path: products/{productId}/{date}-{version}-{cuid}.{ext}
export const productDocumentTemplateUploadUrlBodySchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine((v) => ALLOWED_DOCUMENT_TEMPLATE_TYPES.includes(v), {
    message: "Only PDF is allowed for document templates",
  }),
  fileSize: z.number().max(MAX_TEMPLATE_SIZE_BYTES, "Template must be 5MB or less").optional(),
  productId: z.string().min(1),
  version: z.number().int().positive(),
});

export type ProductDocumentTemplateUploadUrlBody = z.infer<typeof productDocumentTemplateUploadUrlBodySchema>;
