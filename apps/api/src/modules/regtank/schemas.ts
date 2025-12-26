import { z } from "zod";

export const startOnboardingSchema = z.object({
  organizationId: z.string().cuid(),
  portalType: z.enum(["investor", "issuer"]),
});

export const organizationIdParamSchema = z.object({
  organizationId: z.string().cuid(),
});

export const setOnboardingSettingsSchema = z.object({
  formId: z.coerce.number().int().positive(),
  livenessConfidence: z.coerce.number().int().min(0).max(100),
  approveMode: z.coerce.boolean(),
  kycApprovalTarget: z.enum(["ACURIS", "DOWJONES"]).optional(),
  enabledRegistrationEmail: z.coerce.boolean().optional(),
  redirectUrl: z.string().url().optional(),
});

export const startCorporateOnboardingSchema = z.object({
  organizationId: z.string().cuid(),
  portalType: z.enum(["investor", "issuer"]),
  formName: z.string().min(1, "Form name is required"),
  companyName: z.string().min(1, "Company name is required"),
  formId: z.coerce.number().int().positive().optional(),
});

export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;
export type SetOnboardingSettingsInput = z.infer<typeof setOnboardingSettingsSchema>;
export type StartCorporateOnboardingInput = z.infer<typeof startCorporateOnboardingSchema>;



