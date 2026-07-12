import { z } from "zod";
import {
  CurlecGatewayAccount,
  GatewayReconExceptionType,
  GatewayReconRunStatus,
} from "@prisma/client";

export const reconRunIdParamSchema = z.object({
  id: z.string().min(1),
});

export const reconExceptionIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listReconRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  gatewayAccount: z.nativeEnum(CurlecGatewayAccount).optional(),
  status: z.nativeEnum(GatewayReconRunStatus).optional(),
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
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
  gatewayAccount: z.nativeEnum(CurlecGatewayAccount).optional(),
  type: z.nativeEnum(GatewayReconExceptionType).optional(),
});

export type ListReconExceptionsQuery = z.infer<typeof listReconExceptionsQuerySchema>;

export const triggerReconRunSchema = z.object({
  runDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "runDate must be YYYY-MM-DD")
    .optional(),
  gatewayAccount: z.nativeEnum(CurlecGatewayAccount).optional(),
});

export const resolveReconExceptionSchema = z.object({
  reason: z.string().min(1).max(2000),
});

export { GatewayReconRunStatus, GatewayReconExceptionType };
