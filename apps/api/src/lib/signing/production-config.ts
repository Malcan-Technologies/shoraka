/**
 * Fail fast in production when signing integrations are misconfigured.
 */
export function assertSigningProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const webhookSecret = process.env.SC_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error("SC_WEBHOOK_SECRET is required in production");
  }
}
