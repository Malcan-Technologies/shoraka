import { z } from "zod";

export const applicationProcessingFeeParamsSchema = z.object({
  applicationId: z.string().min(1),
});

export const applicationProcessingFeeIdParamsSchema = z.object({
  applicationId: z.string().min(1),
  feePaymentId: z.string().min(1),
});

export type ApplicationProcessingFeeParams = z.infer<typeof applicationProcessingFeeParamsSchema>;
