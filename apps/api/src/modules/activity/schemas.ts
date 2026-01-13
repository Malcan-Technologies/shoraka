import { z } from "zod";
import { ActivityType } from "@prisma/client";

/**
 * Schema for fetching activities with filtering and pagination
 */
export const getActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  type: z.nativeEnum(ActivityType).optional(),
  types: z.array(z.nativeEnum(ActivityType)).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Schema for activity response
 */
export const activityResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  activity_type: z.nativeEnum(ActivityType),
  title: z.string(),
  description: z.string().nullable(),
  metadata: z.any().nullable(),
  ip_address: z.string().nullable(),
  user_agent: z.string().nullable(),
  device_info: z.string().nullable(),
  created_at: z.date(),
});

/**
 * Schema for creating an activity (internal use)
 */
export const createActivitySchema = z.object({
  user_id: z.string(),
  activity_type: z.nativeEnum(ActivityType),
  title: z.string(),
  description: z.string().optional(),
  metadata: z.any().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
  device_info: z.string().optional(),
});

export type GetActivitiesQuery = z.infer<typeof getActivitiesQuerySchema>;
export type ActivityResponse = z.infer<typeof activityResponseSchema>;
export type CreateActivityInput = z.infer<typeof createActivitySchema>;
