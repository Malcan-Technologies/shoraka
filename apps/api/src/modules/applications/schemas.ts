import { z } from "zod";

// Application status enum
export const applicationStatusSchema = z.enum(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"]);

// Create draft application input
export const createDraftApplicationSchema = z.object({
  // No fields needed - productId will be stored in financing_type step
});

// Update application input (for step data)
export const updateApplicationSchema = z.object({
  productId: z.string().cuid().optional(),
  data: z.record(z.unknown()).optional(), // Step data (financing type, terms, etc.)
});

// Submit application input
export const submitApplicationSchema = z.object({
  // No fields needed - submission validates all required data
});

// Application ID parameter
export const applicationIdParamSchema = z.object({
  id: z.string().cuid(),
});

// Step validation query
export const validateStepQuerySchema = z.object({
  step: z.coerce.number().int().min(1).max(7),
});

export type CreateDraftApplicationInput = z.infer<typeof createDraftApplicationSchema>;
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;
export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
