import { z } from "zod";
import { GatewayReconExceptionType, GatewayReconRunStatus } from "@prisma/client";

export const reconRunIdParamSchema = z.object({
  id: z.string().min(1),
});

export const reconExceptionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listReconRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListReconRunsQuery = z.infer<typeof listReconRunsQuerySchema>;

export const listReconExceptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  resolved: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  runId: z.string().optional(),
  type: z.nativeEnum(GatewayReconExceptionType).optional(),
});

export type ListReconExceptionsQuery = z.infer<typeof listReconExceptionsQuerySchema>;

export const triggerReconRunSchema = z.object({
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
});

export const resolveReconExceptionSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export { GatewayReconRunStatus, GatewayReconExceptionType };
