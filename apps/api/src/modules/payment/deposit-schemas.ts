import { z } from "zod";

export const createInvestorDepositSchema = z.object({
  investorOrganizationId: z.string().min(1),
  amount: z.number().positive(),
  depositIntentId: z.string().uuid(),
});

export const investorDepositIdParamSchema = z.object({
  id: z.string().min(1),
});

export const gatewayPaymentIdParamSchema = z.object({
  gatewayPaymentId: z.string().min(1),
});

export const gatewayPaymentReceiptModeQuerySchema = z.object({
  mode: z.enum(["view", "download"]).default("view"),
});

export type CreateInvestorDepositInput = z.infer<typeof createInvestorDepositSchema>;
