import { z } from "zod";
import { GatewayPaymentPurpose, GatewayPaymentReceiptStatus } from "@prisma/client";

export const listGatewayPaymentReceiptsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  receiptNumber: z.string().trim().min(1).optional(),
  payer: z.string().trim().min(1).optional(),
  purpose: z.nativeEnum(GatewayPaymentPurpose).optional(),
  status: z.nativeEnum(GatewayPaymentReceiptStatus).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type ListGatewayPaymentReceiptsQuery = z.infer<
  typeof listGatewayPaymentReceiptsQuerySchema
>;

export const gatewayPaymentReceiptIdParamSchema = z.object({
  id: z.string().min(1),
});

export const gatewayPaymentIdForReceiptParamSchema = z.object({
  id: z.string().min(1),
});
