import { z } from "zod";

/**
 * Activity categories
 */
export const activityCategorySchema = z.enum(["organization"]);
export type ActivityCategory = z.infer<typeof activityCategorySchema>;
export const activityDomainSchema = z.enum(["onboarding", "application", "note"]);
export type ActivityDomain = z.infer<typeof activityDomainSchema>;

/**
 * Schema for fetching activities with filtering and pagination
 */
export const getActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  categories: z.array(activityCategorySchema).optional(),
  domains: z.array(activityDomainSchema).optional(),
  eventType: z.string().optional(),
  eventTypes: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).optional(),
  organizationId: z.string().optional(),
  portalType: z.enum(["investor", "issuer"]).optional(),
});

/**
 * Schema for activity response (Unified format)
 */
export const activityResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  category: activityCategorySchema,
  domain: activityDomainSchema,
  event_type: z.string(), // Displayed as "Event"
  activity: z.string(),   // Backward-compatible alias for title
  title: z.string(),
  description: z.string(),
  metadata: z.any().optional(),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  device_info: z.string().nullable().optional(),
  created_at: z.date(),   // Displayed as "Time"
  source_table: z.string(),
  references: z
    .object({
      applicationId: z.string().optional(),
      applicationReference: z.string().optional(),
      contractId: z.string().optional(),
      contractNumber: z.string().optional(),
      invoiceId: z.string().optional(),
      invoiceNumber: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type GetActivitiesQuery = z.infer<typeof getActivitiesQuerySchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
