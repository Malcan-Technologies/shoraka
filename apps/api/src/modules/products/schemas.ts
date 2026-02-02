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
