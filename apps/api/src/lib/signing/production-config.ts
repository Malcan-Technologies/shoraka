/**
 * Fail fast in production when signing integrations are misconfigured.
 */
export function assertSigningProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const webhookSecret = process.env.SIGNINGCLOUD_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("SIGNINGCLOUD_WEBHOOK_SECRET is required in production");
  }
}
