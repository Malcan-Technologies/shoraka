import { z } from "zod";

/**
 * Activity categories
 */
export const activityCategorySchema = z.enum(["security", "onboarding", "document"]);
export type ActivityCategory = z.infer<typeof activityCategorySchema>;

/**
 * Schema for fetching activities with filtering and pagination
 */
export const getActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  categories: z.array(activityCategorySchema).optional(),
  eventTypes: z.array(z.string()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Schema for activity response (Unified format)
 */
export const activityResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  category: activityCategorySchema,
  event_type: z.string(), // Displayed as "Event"
  activity: z.string(),   // Displayed as "Activity" (description)
  metadata: z.any().optional(),
  ip_address: z.string().nullable().optional(),
  user_agent: z.string().nullable().optional(),
  device_info: z.string().nullable().optional(),
  created_at: z.date(),   // Displayed as "Time"
  source_table: z.string(),
});

export type GetActivitiesQuery = z.infer<typeof getActivitiesQuerySchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
