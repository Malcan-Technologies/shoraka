import { z } from "zod";

export const sessionBodySchema = z.object({
  issuerOrganizationId: z.string().cuid(),
  force: z.boolean().optional().default(false),
});

export const failBodySchema = z.object({
  token: z.string().min(1),
  reason: z.string().min(1).max(500),
  code: z.string().max(64).optional(),
});

export const statusQuerySchema = z.object({
  token: z.string().min(1),
});

export const identityPreviewQuerySchema = z.object({
  issuerOrganizationId: z.string().cuid(),
});

export const completeBodySchema = z
  .object({
    token: z.string().min(1),
    result: z.unknown(),
    confirmedName: z.string().min(1).max(200).optional(),
    confirmedIcNumber: z.string().min(1).max(32).optional(),
  })
  .superRefine((value, ctx) => {
    const hasName = Boolean(value.confirmedName?.trim());
    const hasIc = Boolean(value.confirmedIcNumber?.trim());
    if (hasName !== hasIc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "confirmedName and confirmedIcNumber must both be provided together",
        path: ["confirmedName"],
      });
    }
  });
