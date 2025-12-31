import { z } from "zod";
import { isValidPhoneNumber } from "libphonenumber-js";

export const createOrganizationSchema = z.object({
  type: z.enum(["PERSONAL", "COMPANY"]),
  name: z.string().min(1).max(255).optional(),
  registrationNumber: z.string().max(100).optional(),
});

export const completeOnboardingSchema = z.object({
  organizationId: z.string().cuid(),
  portalType: z.enum(["investor", "issuer"]),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["DIRECTOR", "MEMBER"]),
});

export const organizationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const memberIdParamSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
});

export const portalTypeSchema = z.enum(["investor", "issuer"]);

// Bank account field schema - matches RegTank format
export const bankAccountFieldSchema = z.object({
  cn: z.boolean(),
  fieldName: z.string(),
  fieldType: z.string(),
  fieldValue: z.string(),
});

// Bank account details schema - matches RegTank format
export const bankAccountDetailsSchema = z.object({
  content: z.array(bankAccountFieldSchema),
  displayArea: z.string(),
});

// Update organization profile schema (for editable fields only)
export const updateOrganizationProfileSchema = z.object({
  phoneNumber: z
    .string()
    .refine((val) => !val || isValidPhoneNumber(val), {
      message: "Invalid phone number format",
    })
    .optional()
    .nullable(),
  address: z.string().max(500).optional().nullable(),
  bankAccountDetails: bankAccountDetailsSchema.optional().nullable(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type PortalType = z.infer<typeof portalTypeSchema>;
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;
export type BankAccountDetails = z.infer<typeof bankAccountDetailsSchema>;

