import crypto from "crypto";

/** HMAC-SHA256 hex digest for Curlec/Razorpay webhook raw body. */
export function computeCurlecWebhookSignature(
  rawBody: string,
  webhookSecret: string
): string {
  return crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
}

/**
 * Verify X-Razorpay-Signature against the raw request body.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyCurlecWebhookSignature(
  rawBody: string,
  receivedSignature: string,
  webhookSecret: string
): boolean {
  if (!webhookSecret || !receivedSignature) {
    return false;
  }

  const expected = computeCurlecWebhookSignature(rawBody, webhookSecret);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch {
    // Length mismatch or invalid hex — treat as invalid signature.
    return false;
  }
}
