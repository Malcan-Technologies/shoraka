import { z } from "zod";

const curlecEnvSchema = z.object({
  CURLEC_OPERATING_KEY_ID: z.string().optional(),
  CURLEC_OPERATING_KEY_SECRET: z.string().optional(),
  CURLEC_OPERATING_WEBHOOK_SECRET: z.string().optional(),
  CURLEC_INVESTOR_POOL_KEY_ID: z.string().optional(),
  CURLEC_INVESTOR_POOL_KEY_SECRET: z.string().optional(),
  CURLEC_INVESTOR_POOL_WEBHOOK_SECRET: z.string().optional(),
  CURLEC_API_BASE_URL: z.string().url().optional(),
});

export const CURLEC_GATEWAY_ACCOUNTS = ["OPERATING", "INVESTOR_POOL"] as const;

export type CurlecGatewayAccount = (typeof CURLEC_GATEWAY_ACCOUNTS)[number];

export type CurlecConfig = {
  gatewayAccount: CurlecGatewayAccount;
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  apiBaseUrl: string;
  environment: "sandbox" | "production";
};

export type CurlecGatewayAccountConfigStatus = {
  gatewayAccount: CurlecGatewayAccount;
  configured: boolean;
  isPartial: boolean;
  missingEnvNames: string[];
};

const cachedConfigs = new Map<CurlecGatewayAccount, CurlecConfig>();

/** Clear cached config — for tests only. */
export function resetCurlecConfigCache(): void {
  cachedConfigs.clear();
}

function isCurlecGatewayAccount(value: string): value is CurlecGatewayAccount {
  return (CURLEC_GATEWAY_ACCOUNTS as readonly string[]).includes(value);
}

function resolveCredentialFields(account: CurlecGatewayAccount): {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  keyIdEnvName: string;
  keySecretEnvName: string;
  webhookSecretEnvName: string;
} {
  const env = curlecEnvSchema.parse(process.env);

  if (account === "OPERATING") {
    return {
      keyId: env.CURLEC_OPERATING_KEY_ID?.trim() ?? "",
      keySecret: env.CURLEC_OPERATING_KEY_SECRET?.trim() ?? "",
      webhookSecret: env.CURLEC_OPERATING_WEBHOOK_SECRET?.trim() ?? "",
      keyIdEnvName: "CURLEC_OPERATING_KEY_ID",
      keySecretEnvName: "CURLEC_OPERATING_KEY_SECRET",
      webhookSecretEnvName: "CURLEC_OPERATING_WEBHOOK_SECRET",
    };
  }

  return {
    keyId: env.CURLEC_INVESTOR_POOL_KEY_ID?.trim() ?? "",
    keySecret: env.CURLEC_INVESTOR_POOL_KEY_SECRET?.trim() ?? "",
    webhookSecret: env.CURLEC_INVESTOR_POOL_WEBHOOK_SECRET?.trim() ?? "",
    keyIdEnvName: "CURLEC_INVESTOR_POOL_KEY_ID",
    keySecretEnvName: "CURLEC_INVESTOR_POOL_KEY_SECRET",
    webhookSecretEnvName: "CURLEC_INVESTOR_POOL_WEBHOOK_SECRET",
  };
}

function assertCredentialsPresent(
  account: CurlecGatewayAccount,
  credentials: {
    keyId: string;
    keySecret: string;
    webhookSecret: string;
    keyIdEnvName: string;
    keySecretEnvName: string;
    webhookSecretEnvName: string;
  }
): asserts credentials is {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  keyIdEnvName: string;
  keySecretEnvName: string;
  webhookSecretEnvName: string;
} {
  const missing: string[] = [];
  if (!credentials.keyId) missing.push(credentials.keyIdEnvName);
  if (!credentials.keySecret) missing.push(credentials.keySecretEnvName);
  if (!credentials.webhookSecret) missing.push(credentials.webhookSecretEnvName);

  if (missing.length > 0) {
    throw new Error(
      `Curlec ${account} credentials are required. Missing: ${missing.join(", ")}.`
    );
  }
}

function getMissingCredentialEnvNames(credentials: {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  keyIdEnvName: string;
  keySecretEnvName: string;
  webhookSecretEnvName: string;
}): string[] {
  const missing: string[] = [];
  if (!credentials.keyId) missing.push(credentials.keyIdEnvName);
  if (!credentials.keySecret) missing.push(credentials.keySecretEnvName);
  if (!credentials.webhookSecret) missing.push(credentials.webhookSecretEnvName);
  return missing;
}

export function getCurlecGatewayAccountConfigStatus(
  gatewayAccount: CurlecGatewayAccount
): CurlecGatewayAccountConfigStatus {
  const credentials = resolveCredentialFields(gatewayAccount);
  const missingEnvNames = getMissingCredentialEnvNames(credentials);
  const presentCount =
    Number(Boolean(credentials.keyId)) +
    Number(Boolean(credentials.keySecret)) +
    Number(Boolean(credentials.webhookSecret));

  return {
    gatewayAccount,
    configured: missingEnvNames.length === 0,
    isPartial: presentCount > 0 && missingEnvNames.length > 0,
    missingEnvNames,
  };
}

export function getConfiguredCurlecGatewayAccounts(): CurlecGatewayAccount[] {
  return CURLEC_GATEWAY_ACCOUNTS.filter(
    (gatewayAccount) => getCurlecGatewayAccountConfigStatus(gatewayAccount).configured
  );
}

/**
 * Curlec (Razorpay Malaysia) credentials and API base URL.
 * Server-only — never expose keySecret or webhookSecret to clients.
 * Requires an explicit gateway account (OPERATING or INVESTOR_POOL).
 */
export function getCurlecConfig(gatewayAccount: CurlecGatewayAccount): CurlecConfig {
  if (!isCurlecGatewayAccount(gatewayAccount)) {
    throw new Error(
      `Unsupported Curlec gateway account: ${String(gatewayAccount)}. Expected OPERATING or INVESTOR_POOL.`
    );
  }

  const cached = cachedConfigs.get(gatewayAccount);
  if (cached) {
    return cached;
  }

  const env = curlecEnvSchema.parse(process.env);
  const credentials = resolveCredentialFields(gatewayAccount);
  assertCredentialsPresent(gatewayAccount, credentials);

  const nodeEnv = process.env.NODE_ENV || "development";
  const environment: "sandbox" | "production" =
    nodeEnv === "production" ? "production" : "sandbox";

  const config: CurlecConfig = {
    gatewayAccount,
    keyId: credentials.keyId,
    keySecret: credentials.keySecret,
    webhookSecret: credentials.webhookSecret,
    apiBaseUrl: env.CURLEC_API_BASE_URL ?? "https://api.razorpay.com",
    environment,
  };

  cachedConfigs.set(gatewayAccount, config);
  return config;
}
