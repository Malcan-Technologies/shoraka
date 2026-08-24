import { z } from "zod";

export const excessLateChargePaymentParamsSchema = z.object({
  noteId: z.string().min(1),
});

export const excessLateChargePaymentIdParamsSchema = z.object({
  noteId: z.string().min(1),
  paymentId: z.string().min(1),
});
