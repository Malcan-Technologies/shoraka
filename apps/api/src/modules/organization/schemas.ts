import { z } from "zod";

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

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CompleteOnboardingInput = z.infer<typeof completeOnboardingSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type PortalType = z.infer<typeof portalTypeSchema>;

