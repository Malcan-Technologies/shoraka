import { z } from "zod";
import { UserRole, AdminRole, ApplicationStatus, ContractStatus, ReviewSection } from "@prisma/client";

// Helper for parsing boolean query params (handles "true"/"false" strings properly)
const booleanQueryParam = z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((val) => {
    if (val === undefined || val === null) return undefined;
    if (typeof val === "boolean") return val;
    if (val === "true") return true;
    if (val === "false") return false;
    return undefined;
  });

// User listing query schema
export const getUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  investorOnboarded: booleanQueryParam,
  issuerOnboarded: booleanQueryParam,
});

export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;

// User update schemas
export const updateUserRolesSchema = z.object({
  roles: z.array(z.nativeEnum(UserRole)),
});

export type UpdateUserRolesInput = z.infer<typeof updateUserRolesSchema>;

export const updateUserOnboardingSchema = z.object({
  investorOnboarded: z.boolean().optional(),
  issuerOnboarded: z.boolean().optional(),
});

export type UpdateUserOnboardingInput = z.infer<typeof updateUserOnboardingSchema>;

export const resetOnboardingSchema = z.object({
  portal: z.enum(["investor", "issuer"]),
});

export type ResetOnboardingInput = z.infer<typeof resetOnboardingSchema>;

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
  email: z.preprocess(
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

export const exportSecurityLogsQuerySchema = getSecurityLogsQuerySchema.extend({
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportSecurityLogsQuery = z.infer<typeof exportSecurityLogsQuerySchema>;

// Pending invitations schema
export const getPendingInvitationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  roleDescription: z.nativeEnum(AdminRole).optional(),
});

export type GetPendingInvitationsQuery = z.infer<typeof getPendingInvitationsQuerySchema>;

export const resendInvitationSchema = z.object({
  invitationId: z.string().cuid(),
});

export type ResendInvitationInput = z.infer<typeof resendInvitationSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().cuid(),
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

// Onboarding logs query schema
export const getOnboardingLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(15),
  search: z.string().optional(),
  eventType: z.string().optional(),
  eventTypes: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",") : undefined)),
  role: z.nativeEnum(UserRole).optional(),
  dateRange: z.enum(["24h", "7d", "30d", "all"]).default("all"),
  userId: z.string().optional(),
  organizationId: z.string().optional(),
});

export type GetOnboardingLogsQuery = z.infer<typeof getOnboardingLogsQuerySchema>;

export const exportOnboardingLogsQuerySchema = getOnboardingLogsQuerySchema.extend({
  format: z.enum(["csv", "json"]).default("json"),
});

export type ExportOnboardingLogsQuery = z.infer<typeof exportOnboardingLogsQuerySchema>;

// Organizations query schema
export const getOrganizationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  portal: z.enum(["investor", "issuer"]).optional(),
  type: z.enum(["PERSONAL", "COMPANY"]).optional(),
  onboardingStatus: z
    .enum(["PENDING", "IN_PROGRESS", "PENDING_APPROVAL", "PENDING_AML", "COMPLETED"])
    .optional(),
});

export type GetOrganizationsQuery = z.infer<typeof getOrganizationsQuerySchema>;

// Update sophisticated investor status schema
export const updateSophisticatedStatusSchema = z.object({
  isSophisticatedInvestor: z.boolean(),
  reason: z.string().min(1, "Reason is required"),
});

export type UpdateSophisticatedStatusBody = z.infer<typeof updateSophisticatedStatusSchema>;

// Onboarding Applications query schema (Admin Approval Queue)
export const onboardingApprovalStatusEnum = z.enum([
  "PENDING_ONBOARDING",
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_SSM_REVIEW",
  "PENDING_FINAL_APPROVAL",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]);

// Filter status includes PENDING_ALL which represents all admin-actionable pending statuses
export const onboardingApprovalStatusFilterEnum = z.enum([
  "PENDING_ALL",
  "PENDING_ONBOARDING",
  "PENDING_APPROVAL",
  "PENDING_AML",
  "PENDING_SSM_REVIEW",
  "PENDING_FINAL_APPROVAL",
  "COMPLETED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
]);

export const getOnboardingApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  portal: z.enum(["investor", "issuer"]).optional(),
  type: z.enum(["PERSONAL", "COMPANY"]).optional(),
  status: onboardingApprovalStatusFilterEnum.optional(),
});

export type GetOnboardingApplicationsQuery = z.infer<typeof getOnboardingApplicationsQuerySchema>;

// Admin Applications query schema
const applicationStatusesQueryParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const rawValues = Array.isArray(value) ? value : [value];
    const normalized = rawValues
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (normalized.length === 0) return undefined;
    return normalized.map((entry) => ApplicationStatus[entry as keyof typeof ApplicationStatus]);
  })
  .refine(
    (statuses) => !statuses || statuses.every((status) => status !== undefined),
    "Invalid application status in statuses filter"
  )
  .transform((statuses) => statuses as ApplicationStatus[] | undefined);

const contractStatusesQueryParam = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const rawValues = Array.isArray(value) ? value : [value];
    const normalized = rawValues
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (normalized.length === 0) return undefined;
    return normalized.map((entry) => ContractStatus[entry as keyof typeof ContractStatus]);
  })
  .refine(
    (statuses) => !statuses || statuses.every((status) => status !== undefined),
    "Invalid contract status in statuses filter"
  )
  .transform((statuses) => statuses as ContractStatus[] | undefined);

export const getAdminApplicationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(ApplicationStatus).optional(),
  statuses: applicationStatusesQueryParam,
  productId: z.string().optional(),
});

export const getAdminContractsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  statuses: contractStatusesQueryParam,
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum([
    ApplicationStatus.UNDER_REVIEW,
    ApplicationStatus.APPROVED,
    ApplicationStatus.REJECTED,
  ]),
});

export type GetAdminApplicationsQuery = z.infer<typeof getAdminApplicationsQuerySchema>;
export type GetAdminContractsQuery = z.infer<typeof getAdminContractsQuerySchema>;

export const reviewSectionSchema = z.nativeEnum(ReviewSection);

export const reviewSectionApproveSchema = z.object({
  remark: z.string().optional(),
});

export const reviewSectionRejectSchema = z.object({
  remark: z.string().min(1, "Remark is required for rejection"),
});
export const reviewSectionRequestAmendmentSchema = z.object({
  remark: z.string().min(1, "Remark is required for amendment request"),
});
export const sectionCommentSchema = z.object({
  comment: z.string().min(1, "Comment is required"),
});

export const reviewItemActionSchema = z.object({
  itemType: z.enum(["invoice", "document"]),
  itemId: z.string().min(1),
});
export const guarantorAmlParamSchema = z.object({
  guarantorId: z.string().min(1),
});
export const reviewItemApproveSchema = reviewItemActionSchema.extend({
  remark: z.string().optional(),
});
export const reviewItemRejectSchema = reviewItemActionSchema.extend({
  remark: z.string().min(1, "Remark is required for rejection"),
});
export const reviewItemRequestAmendmentSchema = reviewItemActionSchema.extend({
  remark: z.string().min(1, "Remark is required for amendment request"),
});

export const sendContractOfferSchema = z.object({
  offeredFacility: z.coerce.number().positive("Offered facility must be greater than 0"),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const sendInvoiceOfferSchema = z.object({
  offeredAmount: z.coerce.number().positive("Offered amount must be greater than 0"),
  offeredRatioPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  offeredProfitRatePercent: z.coerce.number().min(0).max(100).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const addPendingAmendmentSchema = z
  .object({
    scope: z.enum(["section", "item"]),
    scopeKey: z.string().min(1).optional(),
    remark: z.string().min(1, "Remark is required"),
    itemType: z.enum(["invoice", "document"]).optional(),
    itemId: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scope === "section") return !!data.scopeKey;
      return !!(data.itemType && data.itemId);
    },
    { message: "scopeKey required for section; itemType and itemId required for item" }
  );

export const updatePendingAmendmentSchema = z.object({
  remark: z.string().min(1, "Remark is required"),
});

export const createCtosSubjectReportSchema = z.object({
  subjectRef: z.string().min(1).max(80),
  subjectKind: z.enum(["INDIVIDUAL", "CORPORATE"]),
  /** When set, CTOS enquiry uses these fields only (org JSON resolution skipped). Admin CTOS table uses org report name + id. */
  enquiryOverride: z
    .object({
      displayName: z.string().min(1).max(500),
      idNumber: z.string().min(1).max(80),
    })
    .optional(),
});

export type CreateCtosSubjectReportInput = z.infer<typeof createCtosSubjectReportSchema>;

export const resubmitComparisonQuerySchema = z.object({
  reviewCycle: z.coerce.number().int().min(2, "reviewCycle must be at least 2"),
});

export type ResubmitComparisonQuery = z.infer<typeof resubmitComparisonQuerySchema>;
