import { z } from "zod";
import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
} from "@prisma/client";

export const gatewayPaymentIdParamSchema = z.object({
  id: z.string().min(1),
});

export const listGatewayPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(GatewayPaymentStatus).optional(),
  purpose: z.nativeEnum(GatewayPaymentPurpose).optional(),
  organizationType: z.nativeEnum(GatewayOrganizationType).optional(),
  filter: z.enum(["needs_attention", "review", "refunding", "refunded", "completed"]).optional(),
  search: z.string().trim().optional(),
});

export type ListGatewayPaymentsQuery = z.infer<typeof listGatewayPaymentsQuerySchema>;

export const gatewayPaymentReasonSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});
