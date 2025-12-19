import { z } from "zod";

export const startOnboardingSchema = z.object({
  organizationId: z.string().cuid(),
  portalType: z.enum(["investor", "issuer"]),
});

export const organizationIdParamSchema = z.object({
  organizationId: z.string().cuid(),
});

export type StartOnboardingInput = z.infer<typeof startOnboardingSchema>;



