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

function readNestedEntity(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  const entity = (value as { entity?: unknown }).entity;
  if (entity && typeof entity === "object" && !Array.isArray(entity)) {
    return entity as Record<string, unknown>;
  }
  return null;
}

/** Extract order/payment ids from deposit capture webhooks (payment.captured or order.paid). */
export function extractDepositCaptureRefs(
  payload: CurlecWebhookPayload
): { orderId: string; paymentId?: string } | null {
  if (payload.event === "payment.captured") {
    const entity = readNestedEntity(payload.payload?.payment);
    const orderId = entity?.order_id;
    const paymentId = entity?.id;
    if (typeof orderId === "string" && typeof paymentId === "string") {
      return { orderId, paymentId };
    }
  }

  if (payload.event === "order.paid") {
    const entity = readNestedEntity(payload.payload?.order);
    const orderId = entity?.id;
    if (typeof orderId === "string") {
      return { orderId };
    }
  }

  return null;
}
