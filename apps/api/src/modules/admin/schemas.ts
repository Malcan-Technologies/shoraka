import { z } from "zod";
import { UserRole } from "@prisma/client";

// User listing query schema
export const getUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  kycVerified: z.coerce.boolean().optional(),
  investorOnboarded: z.coerce.boolean().optional(),
  issuerOnboarded: z.coerce.boolean().optional(),
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;

// User update schemas
export const updateUserRolesSchema = z.object({
  roles: z.array(z.nativeEnum(UserRole)).min(1),
});

export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;

export const updateUserKycSchema = z.object({
  kycVerified: z.boolean(),
});

export type UpdateUserKycInput = z.infer<typeof updateUserKycSchema>;

export const updateUserOnboardingSchema = z.object({
  investorOnboarded: z.boolean().optional(),
  issuerOnboarded: z.boolean().optional(),
});

export type UpdateUserOnboardingInput = z.infer<typeof updateUserOnboardingSchema>;

// Access logs query schema
export const getAccessLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().optional(),
  eventType: z.string().optional(),
  status: z.enum(["success", "failed"]).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  userId: z.string().optional(),
});

export type GetAccessLogsQuery = z.infer<typeof getAccessLogsQuerySchema>;

export const exportAccessLogsQuerySchema = getAccessLogsQuerySchema.extend({
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportAccessLogsQuery = z.infer<typeof exportAccessLogsQuerySchema>;

