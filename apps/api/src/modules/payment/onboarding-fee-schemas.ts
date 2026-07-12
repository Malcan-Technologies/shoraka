import { z } from "zod";

export const createIssuerOnboardingFeeSchema = z.object({
  issuerOrganizationId: z.string().min(1),
});

export const issuerOnboardingFeeIdParamSchema = z.object({
  id: z.string().min(1),
});

export const issuerOnboardingFeeStatusParamSchema = z.object({
  issuerOrganizationId: z.string().min(1),
});

export type CreateIssuerOnboardingFeeInput = z.infer<typeof createIssuerOnboardingFeeSchema>;
export type IssuerOnboardingFeeStatusParam = z.infer<typeof issuerOnboardingFeeStatusParamSchema>;
