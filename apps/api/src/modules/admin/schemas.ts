import { z } from "zod";
import { UserRole, AdminRole } from "@prisma/client";

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

export const updateUserProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;

export const updateUserIdSchema = z.object({
  userId: z.string().regex(/^[A-Z]{5}$/, "User ID must be exactly 5 uppercase letters (A-Z)"),
});

export type UpdateUserIdInput = z.infer<typeof updateUserIdSchema>;

// Access logs query schema
export const getAccessLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().optional(),
  eventType: z.string().optional(),
  eventTypes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  status: z.enum(["success", "failed"]).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  userId: z.string().optional(),
});

export type GetAccessLogsQuery = z.infer<typeof getAccessLogsQuerySchema>;

export const exportAccessLogsQuerySchema = getAccessLogsQuerySchema.extend({
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportAccessLogsQuery = z.infer<typeof exportAccessLogsQuerySchema>;

// Admin management schemas
export const getAdminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  roleDescription: z.nativeEnum(AdminRole).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export type GetAdminUsersQuery = z.infer<typeof getAdminUsersQuerySchema>;

export const updateAdminRoleSchema = z.object({
  roleDescription: z.nativeEnum(AdminRole),
});

export type UpdateAdminRoleInput = z.infer<typeof updateAdminRoleSchema>;

export const inviteAdminSchema = z.object({
  email: z
    .preprocess(
      (val) => (val === "" || val === null || val === undefined ? undefined : val),
      z.string().email("Please enter a valid email address").optional()
    ),
  roleDescription: z.nativeEnum(AdminRole),
});

export type InviteAdminInput = z.infer<typeof inviteAdminSchema>;

export const acceptInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const getSecurityLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().optional(),
  eventType: z.string().optional(),
  eventTypes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  userId: z.string().optional(),
});

export type GetSecurityLogsQuery = z.infer<typeof getSecurityLogsQuerySchema>;
