import { z } from "zod";
import {
  isValidProfilePhone,
  storedProfilePhone,
  validateIssuerAddressForm,
} from "@cashsouk/types";

export const createOrganizationSchema = z.object({
  type: z.enum(["PERSONAL", "COMPANY"]),
  name: z.string().min(1).max(255).optional(),
  registrationNumber: z.string().max(100).optional(),
  /** When true, create a new COMPANY even if this user already owns an incomplete same-name company. */
  allowDuplicateIncomplete: z.boolean().optional(),
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

export const patchCtosPartyEmailSchema = z.object({
  partyKey: z.string().min(1),
  email: z.string().email(),
});

export const sendDirectorOnboardingSchema = z.object({
  partyKey: z.string().min(1),
});

export const recoverUnresolvedIdentitySchema = z.object({
  eodRequestId: z.string().min(1),
  email: z.string().email().optional(),
  role: z.enum(["DIRECTOR", "SHAREHOLDER"]),
  governmentId: z.string().min(6).max(32),
});

export type RecoverUnresolvedIdentityInput = z.infer<typeof recoverUnresolvedIdentitySchema>;

export type SendDirectorOnboardingInput = z.infer<typeof sendDirectorOnboardingSchema>;

export const memberIdParamSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().regex(/^[A-Z]{5}$/, "Invalid user ID format"),
});

export const portalTypeSchema = z.enum(["investor", "issuer"]);

// Bank account field schema - matches RegTank format (fieldValue may be omitted; coerced to string)
export const bankAccountFieldSchema = z.object({
  cn: z.boolean(),
  fieldName: z.string(),
  fieldType: z.string(),
  fieldValue: z.union([z.string(), z.undefined()]).transform((v) => v ?? ""),
});

// Bank account number: digits only, length in range when provided
const bankAccountNumberRegex = /^\d*$/;
const BANK_ACCOUNT_MIN_LENGTH = 10;
const BANK_ACCOUNT_MAX_LENGTH = 18;

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
  )
  .refine(
    (val) => {
      const accountField = val.content.find((f) => f.fieldName === "Bank account number");
      const v = accountField?.fieldValue?.trim() ?? "";
      if (!v) return true;
      const len = v.length;
      return len >= BANK_ACCOUNT_MIN_LENGTH && len <= BANK_ACCOUNT_MAX_LENGTH;
    },
    {
      message: `Bank account number must be between ${BANK_ACCOUNT_MIN_LENGTH} and ${BANK_ACCOUNT_MAX_LENGTH} digits`,
    }
  );

const contactPersonSchema = z.object({
  name: z.string().max(255).optional().nullable(),
  position: z.string().max(255).optional().nullable(),
  email: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Enter a valid e-mail address.",
    }),
  contact: z
    .string()
    .refine((val) => !val || isValidProfilePhone(val), {
      message: "Enter a valid contact number.",
    })
    .optional()
    .nullable()
    .transform((val) => (val == null || val === "" ? val : (storedProfilePhone(val) as typeof val))),
});

// Update organization profile schema (for editable fields only)
export const updateOrganizationProfileSchema = z.object({
  phoneNumber: z
    .string()
    .refine((val) => !val || isValidProfilePhone(val), {
      message: "Enter a valid phone number.",
    })
    .optional()
    .nullable()
    .transform((val) => (val == null || val === "" ? val : (storedProfilePhone(val) as typeof val))),
  address: z.string().max(500).optional().nullable(),
  bankAccountDetails: bankAccountDetailsSchema.optional().nullable(),
  contactPerson: contactPersonSchema.optional().nullable(),
});

// Invite member schema (email is optional for link-based invitations)
export const inviteMemberSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
  partyProfileId: z.string().cuid().optional(),
});

export const generateMemberInviteLinkSchema = z.object({
  email: z.string().email().optional(),
  role: z.enum(["ORGANIZATION_ADMIN", "ORGANIZATION_MEMBER"]),
  partyProfileId: z.string().cuid().optional(),
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

export const addressSchema = z.object({
  line1: z.string().optional().nullable(),
  line2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  postalCode: z.string().max(32).optional().nullable(),
  state: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
});

function isComrepProfileAddressValid(
  addr: z.infer<typeof addressSchema> | null | undefined,
  kind: "registered" | "business"
): boolean {
  if (!addr || typeof addr !== "object") return false;
  const issues = validateIssuerAddressForm(
    kind === "registered"
      ? {
          registeredLine1: addr.line1,
          registeredState: addr.state,
          registeredPostalCode: addr.postalCode,
          businessLine1: "ok",
          businessState: "Selangor",
          businessPostalCode: "40000",
        }
      : {
          registeredLine1: "ok",
          registeredState: "Selangor",
          registeredPostalCode: "40000",
          businessLine1: addr.line1,
          businessState: addr.state,
          businessPostalCode: addr.postalCode,
        }
  );
  return issues.length === 0;
}

export const aboutYourBusinessSchema = z.object({
  whatDoesCompanyDo: z.string().max(1000).optional().nullable(),
  mainCustomers: z.string().max(400).optional().nullable(),
  singleCustomerOver50Revenue: z.boolean().optional().nullable(),
  accountingSoftware: z.string().max(200).optional().nullable(),
});

// Corporate info update schema
export const updateCorporateInfoSchema = z
  .object({
    tinNumber: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    entityType: z.string().optional().nullable(),
    businessName: z.string().optional().nullable(),
    website: z.string().max(500).optional().nullable(),
    annualRevenue: z.string().max(100).optional().nullable(),
    numberOfEmployees: z.number().int().nonnegative().optional().nullable(),
    ssmRegisterNumber: z.string().optional().nullable(),
    businessAddress: addressSchema.optional().nullable(),
    registeredAddress: addressSchema.optional().nullable(),
    aboutYourBusiness: aboutYourBusinessSchema.optional().nullable(),
  })
  .refine(
    (val) => {
      if (val.businessAddress !== undefined && val.businessAddress !== null) {
        return isComrepProfileAddressValid(val.businessAddress, "business");
      }
      return true;
    },
    { message: "Business Address, State, and Postcode are required unless the state is Outside Malaysia.", path: ["businessAddress"] }
  )
  .refine(
    (val) => {
      if (val.registeredAddress !== undefined && val.registeredAddress !== null) {
        return isComrepProfileAddressValid(val.registeredAddress, "registered");
      }
      return true;
    },
    { message: "Registered Address, State, and Postcode are required unless the state is Outside Malaysia.", path: ["registeredAddress"] }
  );

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
export type PatchCtosPartyEmailInput = z.infer<typeof patchCtosPartyEmailSchema>;
export type PortalType = z.infer<typeof portalTypeSchema>;
export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;
export type BankAccountDetails = z.infer<typeof bankAccountDetailsSchema>;

