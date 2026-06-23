import { z } from "zod";

export const createInvestorDepositSchema = z.object({
  investorOrganizationId: z.string().min(1),
  amount: z.number().positive(),
});

export const investorDepositIdParamSchema = z.object({
  id: z.string().min(1),
});

export type CreateInvestorDepositInput = z.infer<typeof createInvestorDepositSchema>;
