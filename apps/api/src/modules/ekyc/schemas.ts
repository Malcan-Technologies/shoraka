import { z } from "zod";

export const sessionBodySchema = z.object({
  issuerOrganizationId: z.string().cuid(),
  icNumber: z.string().min(1).max(32),
  force: z.boolean().optional().default(false),
  confirmedName: z.string().min(1).max(200),
});

export const failBodySchema = z.object({
  token: z.string().min(1),
  reason: z.string().min(1).max(500),
  code: z.string().max(64).optional(),
});

export const statusQuerySchema = z.object({
  token: z.string().min(1),
});

export const identityPreviewBodySchema = z.object({
  issuerOrganizationId: z.string().cuid(),
  icNumber: z.string().min(1).max(32),
});

export const completeBodySchema = z.object({
  token: z.string().min(1),
  result: z.unknown(),
});
