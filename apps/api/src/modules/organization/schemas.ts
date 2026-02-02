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
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
});

export const organizationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export const memberIdParamSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().regex(/^[A-Z]{5}$/, "Invalid user ID format"),
});

export const portalTypeSchema = z.enum(["investor", "issuer"]);

// Bank account field schema - matches RegTank format
export const bankAccountFieldSchema = z.object({
  cn: z.boolean(),
  fieldName: z.string(),
  fieldType: z.string(),
  fieldValue: z.string(),
});

// Bank account number: digits only
const bankAccountNumberRegex = /^\d*$/;

// Bank account details schema - matches RegTank format
export const bankAccountDetailsSchema = z
  .object({
    content: z.array(bankAccountFieldSchema),
    displayArea: z.string(),
  })
  .refine(
    (val) => {
      const accountField = val.content.find((f) => f.fieldName === "Bank account number");
      if (!accountField?.fieldValue) return true;
      return bankAccountNumberRegex.test(accountField.fieldValue);
    },
    { message: "Bank account number must contain only digits" }
  );

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

// Invite member schema (email is optional for link-based invitations)
export const inviteMemberSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
});

// Generate invitation link schema (same as invite, but explicitly for link generation)
export const generateMemberInviteLinkSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
});

// Accept invitation schema
export const acceptOrganizationInvitationSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

// Remove member schema
export const removeMemberSchema = z.object({
  userId: z.string().cuid(),
});

// Leave organization schema
export const leaveOrganizationSchema = z.object({
  organizationId: z.string().cuid(),
});

// Promote/Demote member schema
export const changeMemberRoleSchema = z.object({
  userId: z.string().regex(/^[A-Z]{5}$/, "Invalid user ID format"),
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
});

// Transfer ownership schema
export const transferOwnershipSchema = z.object({
  newOwnerId: z.string().regex(/^[A-Z]{5}$/, "Invalid user ID format"),
});

// Postal code: digits only
const postalCodeRegex = /^\d*$/;

// Address schema for structured addresses
export const addressSchema = z.object({
  line1: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z
    .string()
    .optional()
    .nullable()
    .refine((val) => !val || postalCodeRegex.test(val), {
      message: "Postal code must contain only numbers",
    }),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
});

// Corporate info update schema
export const updateCorporateInfoSchema = z.object({
  tinNumber: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  entityType: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  numberOfEmployees: z.number().int().positive().optional().nullable(),
  ssmRegisterNumber: z.string().optional().nullable(),
  businessAddress: addressSchema.optional().nullable(),
  registeredAddress: addressSchema.optional().nullable(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type AcceptOrganizationInvitationInput = z.infer<typeof acceptOrganizationInvitationSchema>;
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
export type LeaveOrganizationInput = z.infer<typeof leaveOrganizationSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type TransferOwnershipInput = z.infer<typeof transferOwnershipSchema>;
export type UpdateCorporateInfoInput = z.infer<typeof updateCorporateInfoSchema>;
export type PortalType = z.infer<typeof portalTypeSchema>;
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;
export type BankAccountDetails = z.infer<typeof bankAccountDetailsSchema>;

