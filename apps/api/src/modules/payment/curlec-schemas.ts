import { z } from "zod";

export const curlecOrderSchema = z.object({
  id: z.string(),
  entity: z.literal("order").optional(),
  amount: z.number().int().nonnegative(),
  amount_due: z.number().int().nonnegative().optional(),
  amount_paid: z.number().int().nonnegative().optional(),
  currency: z.string(),
  receipt: z.string().nullable().optional(),
  status: z.string(),
  notes: z.record(z.string()).optional(),
  created_at: z.number().optional(),
});

export type CurlecOrder = z.infer<typeof curlecOrderSchema>;

export const curlecPaymentSchema = z.object({
  id: z.string(),
  entity: z.literal("payment").optional(),
  amount: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.string(),
  method: z.string().nullable().optional(),
  order_id: z.string().nullable().optional(),
  bank: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  contact: z.string().nullable().optional(),
  fee: z.number().int().nonnegative().optional(),
  tax: z.number().int().nonnegative().optional(),
  acquirer_data: z.record(z.unknown()).optional(),
  notes: z.record(z.string()).optional(),
  created_at: z.number().optional(),
});

export type CurlecPayment = z.infer<typeof curlecPaymentSchema>;

export const curlecOrderPaymentsSchema = z.object({
  entity: z.literal("collection").optional(),
  count: z.number().optional(),
  items: z.array(curlecPaymentSchema),
});

export const curlecSettlementSchema = z.object({
  id: z.string(),
  entity: z.literal("settlement").optional(),
  amount: z.number().int(),
  status: z.string(),
  fees: z.number().int().optional(),
  tax: z.number().int().optional(),
  created_at: z.number().optional(),
});

export type CurlecSettlement = z.infer<typeof curlecSettlementSchema>;

export const curlecSettlementListSchema = z.object({
  entity: z.literal("collection").optional(),
  count: z.number().optional(),
  items: z.array(curlecSettlementSchema),
});

export type CurlecSettlementList = z.infer<typeof curlecSettlementListSchema>;

export const createCurlecOrderInputSchema = z.object({
  amountSen: z.number().int().positive(),
  currency: z.literal("MYR").default("MYR"),
  receipt: z.string().min(1).max(40),
  notes: z.record(z.string()).optional(),
});

export type CreateCurlecOrderInput = z.infer<typeof createCurlecOrderInputSchema>;

/** Best-effort payer display name from payment payload (FPX often has no holder name). */
export function extractPayerNameFromPayment(payment: CurlecPayment): string | null {
  const acquirer = payment.acquirer_data;
  if (acquirer && typeof acquirer === "object") {
    for (const key of ["account_holder_name", "payer_name", "name", "buyer_name"]) {
      const value = acquirer[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return null;
}

/** FPX bank code when present (e.g. MB2U). */
export function extractBankCodeFromPayment(payment: CurlecPayment): string | null {
  if (payment.bank?.trim()) {
    return payment.bank.trim();
  }

  const acquirer = payment.acquirer_data;
  if (acquirer && typeof acquirer === "object") {
    const bankCode = acquirer.bank_code;
    if (typeof bankCode === "string" && bankCode.trim()) {
      return bankCode.trim();
    }
  }

  return null;
}
