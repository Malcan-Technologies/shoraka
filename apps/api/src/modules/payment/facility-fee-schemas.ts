import { z } from "zod";

export const facilityFeePaymentParamsSchema = z.object({
  contractId: z.string().min(1),
});

export const facilityFeePaymentIdParamsSchema = z.object({
  contractId: z.string().min(1),
  paymentId: z.string().min(1),
});
