import { z } from "zod";

/** Minimal Curlec/Razorpay webhook envelope — we persist the full parsed object. */
export const curlecWebhookPayloadSchema = z
  .object({
    event: z.string().min(1),
    entity: z.string().optional(),
    account_id: z.string().optional(),
    contains: z.array(z.string()).optional(),
    payload: z.record(z.unknown()).optional(),
    created_at: z.number().optional(),
  })
  .passthrough();

export type CurlecWebhookPayload = z.infer<typeof curlecWebhookPayloadSchema>;
