import { z } from "zod";

export const listOpsAlertsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(["OPEN", "ACKNOWLEDGED", "RESOLVED", "CLOSED"]).optional(),
  type: z
    .enum([
      "STUCK_PAYMENT",
      "RECON_MISMATCH",
      "RECEIPT_FAILURE",
      "WEBHOOK_FAILURE",
      "SIGNING_EXPIRY",
      "PROVIDER_FAILURE",
      "REPEATED_JOB_FAILURE",
      "MISSING_LEGAL_EVIDENCE",
      "GATEWAY_LEDGER_MISMATCH",
    ])
    .optional(),
  severity: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).optional(),
  search: z.string().optional(),
});

export type ListOpsAlertsQuery = z.infer<typeof listOpsAlertsQuerySchema>;
