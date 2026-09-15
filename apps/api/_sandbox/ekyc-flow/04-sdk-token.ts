/**
 * Optional — WiseAI POST /sdk/token
 *
 * Fetches session credentials (SDK token + encryption keys) from the WiseAI console.
 * Not used by the production flow — for investigating SigningCloud/WiseAI tenant config.
 * Useful for comparing what /sdk/token returns vs your tenant encryption config.
 *
 * Run from apps/api:
 *   npx tsx _sandbox/ekyc-flow/04-sdk-token.ts
 */

import { config as loadEnv } from "dotenv";

loadEnv();

// ============ CONFIG — fill in before running ============
const CONFIG = {
  /** WiseAI console base URL — the `url` from step 1, or https://wiseconsole-demo.wiseai.tech */
  wiseConsoleUrl: "https://wiseconsole-demo.wiseai.tech",

  /**
   * Bearer token for Authorization header.
   * Try the `token` from step 1 getToken first; fallback to SC_API_KEY if empty.
   */
  bearerToken: "FE234D43457BD3525BB3D0DAFFD94306E30C2E56",
};

interface WiseAiEncryption {
  alg: string;
  mode: string;
  padding: string;
  iv: string;
  key: string;
}

interface WiseAiSdkTokenResponse {
  status?: string;
  code?: string;
  message?: string;
  data?: {
    token?: string;
    encryption?: WiseAiEncryption;
    expired?: number;
    created?: number;
    ttl?: number;
  };
}

function resolveBearerToken(): string {
  const fromConfig = CONFIG.bearerToken.trim();
  if (fromConfig) return fromConfig;

  const apiKey = process.env.SC_API_KEY?.trim();
  if (apiKey) return apiKey;

  throw new Error("Set CONFIG.bearerToken or SC_API_KEY in .env.");
}

async function postSdkToken(wiseConsoleUrl: string, bearerToken: string): Promise<WiseAiSdkTokenResponse> {
  const base = wiseConsoleUrl.replace(/\/$/, "");
  const url = `${base}/sdk/token`;

  console.log(`POST ${url}`);
  console.log(`Authorization: Bearer ${bearerToken.slice(0, 8)}…\n`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  const body = (await response.json()) as WiseAiSdkTokenResponse;

  console.log(`HTTP ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok || body.status !== "success" || !body.data?.encryption) {
    const detail = body.message || body.code || `HTTP ${response.status}`;
    throw new Error(`WiseAI /sdk/token failed: ${detail}`);
  }

  return body;
}

async function main() {
  const wiseConsoleUrl = CONFIG.wiseConsoleUrl.trim();
  if (!wiseConsoleUrl) {
    throw new Error("Set CONFIG.wiseConsoleUrl.");
  }

  const bearerToken = resolveBearerToken();
  const body = await postSdkToken(wiseConsoleUrl, bearerToken);

  const { token, encryption, expired, created, ttl } = body.data ?? {};

  console.log("\n--- Encryption keys ---");
  if (encryption) {
    console.log(JSON.stringify(encryption, null, 2));
  }

  if (token) {
    console.log("\nWiseAI session token (separate from SigningCloud getToken):");
    console.log(token);
  }

  if (expired !== undefined || created !== undefined || ttl !== undefined) {
    console.log("\nSession timing:", { created, expired, ttl });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
