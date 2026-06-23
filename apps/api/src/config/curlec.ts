import { z } from "zod";

const curlecEnvSchema = z.object({
  CURLEC_KEY_ID: z.string().optional(),
  CURLEC_KEY_SECRET: z.string().optional(),
  CURLEC_WEBHOOK_SECRET: z.string().optional(),
  CURLEC_API_BASE_URL: z.string().url().optional(),
});

export type CurlecConfig = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  apiBaseUrl: string;
  environment: "sandbox" | "production";
};

let cachedConfig: CurlecConfig | null = null;

/** Clear cached config — for tests only. */
export function resetCurlecConfigCache(): void {
  cachedConfig = null;
}

/**
 * Curlec (Razorpay Malaysia) credentials and API base URL.
 * Server-only — never expose keySecret or webhookSecret to clients.
 */
export function getCurlecConfig(): CurlecConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = curlecEnvSchema.parse(process.env);
  const nodeEnv = process.env.NODE_ENV || "development";
  const environment: "sandbox" | "production" =
    nodeEnv === "production" ? "production" : "sandbox";

  const keyId = env.CURLEC_KEY_ID?.trim() ?? "";
  const keySecret = env.CURLEC_KEY_SECRET?.trim() ?? "";

  if (!keyId || !keySecret) {
    throw new Error(
      "Curlec API credentials are required. Set CURLEC_KEY_ID and CURLEC_KEY_SECRET environment variables."
    );
  }

  cachedConfig = {
    keyId,
    keySecret,
    webhookSecret: env.CURLEC_WEBHOOK_SECRET?.trim() ?? "",
    apiBaseUrl: env.CURLEC_API_BASE_URL ?? "https://api.razorpay.com",
    environment,
  };

  return cachedConfig;
}
