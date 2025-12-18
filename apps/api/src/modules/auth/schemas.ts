import { z } from "zod";
import { UserRole } from "@prisma/client";

/**
 * Schema for sync-user endpoint
 * Called after OAuth callback to sync Cognito user with database
 */
export const syncUserSchema = z.object({
  cognitoSub: z.string().min(1, "Cognito sub is required"),
  email: z.string().email("Invalid email format"),
  roles: z.array(z.nativeEnum(UserRole)).min(1, "At least one role is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
});

export type SyncUserInput = z.infer<typeof syncUserSchema>;

/**
 * Schema for add-role endpoint
 * Adds an additional role to existing user
 */
export const addRoleSchema = z.object({
  role: z.nativeEnum(UserRole, {
    errorMap: () => ({ message: "Invalid role. Must be INVESTOR, ISSUER, or ADMIN" }),
  }),
});

export type AddRoleInput = z.infer<typeof addRoleSchema>;

/**
 * Schema for check-onboarding endpoint
 */
export const checkOnboardingSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export type CheckOnboardingInput = z.infer<typeof checkOnboardingSchema>;

/**
 * Schema for complete-onboarding endpoint
 */
export const completeOnboardingSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;

/**
 * Schema for cancel-onboarding endpoint
 */
export const cancelOnboardingSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  reason: z.string().optional(),
});

export type CancelOnboardingInput = z.infer<typeof cancelOnboardingSchema>;

/**
 * Schema for switch-role endpoint
 */
export const switchRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
});

export type SwitchRoleInput = z.infer<typeof switchRoleSchema>;

/**
 * Schema for admin create-user endpoint
 */
export const createAdminUserSchema = z.object({
  email: z.string().email("Invalid email format"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  tempPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export type CreateAdminUserInput = z.infer<typeof createAdminUserSchema>;

/**
 * Schema for start-onboarding endpoint
 * Logs when user lands on onboarding page
 */
export const startOnboardingSchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
});

export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;

/**
 * Schema for update-profile endpoint
 * Allows users to update their own profile information
 */
export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Schema for change-password endpoint
 * Allows authenticated users to change their own password via Cognito
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Schema for verify-email endpoint
 * Verifies email with code (for unverified emails after email change)
 */
export const verifyEmailSchema = z.object({
  code: z.string().min(1, "Verification code is required"),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * Schema for resend-signup-code endpoint (public)
 * Resends confirmation code to unconfirmed users
 */
export const resendSignupCodeSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export type ResendSignupCodeInput = z.infer<typeof resendSignupCodeSchema>;

/**
 * Schema for confirm-signup endpoint (public)
 * Confirms signup with verification code
 */
export const confirmSignupSchema = z.object({
  email: z.string().email("Invalid email format"),
  code: z.string().min(1, "Verification code is required"),
});

export type ConfirmSignupInput = z.infer<typeof confirmSignupSchema>;
