import { z } from "zod";

const regtankEnvSchema = z.object({
  REGTANK_OAUTH_URL: z.string().url().optional(),
  REGTANK_API_BASE_URL: z.string().url().optional(),
  REGTANK_ONBOARDING_PROXY_URL: z.string().optional(),
  REGTANK_CLIENT_ID: z.string().optional(),
  REGTANK_CLIENT_SECRET: z.string().optional(),
  REGTANK_WEBHOOK_SECRET: z.string().optional(),
  REGTANK_REDIRECT_URL_INVESTOR: z.string().url().optional(),
  REGTANK_REDIRECT_URL_ISSUER: z.string().url().optional(),
});

export type RegTankConfig = {
  oauthUrl: string;
  apiBaseUrl: string;
  onboardingProxyUrl: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  redirectUrlInvestor: string;
  redirectUrlIssuer: string;
  environment: "sandbox" | "production";
};

let cachedConfig: RegTankConfig | null = null;

/**
 * Get RegTank configuration from environment variables
 * Supports both sandbox and production environments
 */
export function getRegTankConfig(): RegTankConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const env = regtankEnvSchema.parse(process.env);
  const nodeEnv = process.env.NODE_ENV || "development";

  // Determine environment (sandbox for development/test, production otherwise)
  const environment: "sandbox" | "production" =
    nodeEnv === "production" ? "production" : "sandbox";

  // Default to sandbox URLs if not provided
  const config: RegTankConfig = {
    oauthUrl:
      env.REGTANK_OAUTH_URL ||
      "https://crm-server.regtank.com/oauth2/token",
    apiBaseUrl:
      env.REGTANK_API_BASE_URL ||
      "https://shoraka-trial-server.regtank.com",
    onboardingProxyUrl:
      env.REGTANK_ONBOARDING_PROXY_URL ||
      "https://shoraka-trial-onboarding-proxy.regtank.com",
    clientId:
      env.REGTANK_CLIENT_ID ||
      "6c3eb4f4-3402-45a3-8707-a365059e7581",
    clientSecret:
      env.REGTANK_CLIENT_SECRET ||
      "88b2d5fe7d5ac366f0d7b59f67bf9ee4",
    webhookSecret: env.REGTANK_WEBHOOK_SECRET || "",
    redirectUrlInvestor:
      env.REGTANK_REDIRECT_URL_INVESTOR ||
      "https://investor.cashsouk.com/regtank-callback",
    redirectUrlIssuer:
      env.REGTANK_REDIRECT_URL_ISSUER ||
      "https://issuer.cashsouk.com/regtank-callback",
    environment,
  };

  // Validate required fields
  if (!config.clientId || !config.clientSecret) {
    throw new Error(
      "RegTank client credentials are required. Set REGTANK_CLIENT_ID and REGTANK_CLIENT_SECRET environment variables."
    );
  }

  cachedConfig = config;
  return config;
}



