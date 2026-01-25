import { z } from "zod";

/**
 * Schema for creating a new application
 */
export const createApplicationSchema = z.object({
  productId: z.string().cuid(),
  issuerOrganizationId: z.string().cuid(),
});

/**
 * Schema for updating an application step
 */
export const updateApplicationStepSchema = z.object({
  stepNumber: z.number().int().min(1),
  stepId: z.string(),
  data: z.record(z.unknown()),
});

/**
 * Schema for application ID parameter
 */
export const applicationIdParamSchema = z.object({
  id: z.string().cuid(),
});

export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStepInput = z.infer<typeof updateApplicationStepSchema>;
