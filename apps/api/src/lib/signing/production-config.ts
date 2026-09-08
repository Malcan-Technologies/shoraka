/**
 * Fail fast in production when signing integrations are misconfigured.
 */
export function assertSigningProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") return;

  const required = [
    "SC_BASE_URL",
    "SC_API_KEY",
    "SC_API_SECRET",
    "SC_WEBHOOK_SECRET",
    "API_PUBLIC_URL",
    "ISSUER_URL",
  ] as const;

  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new Error(`Signing production config missing: ${missing.join(", ")}`);
  }
}
