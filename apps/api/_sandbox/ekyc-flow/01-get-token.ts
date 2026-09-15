/**
 * Step 1 — SigningCloud getToken
 *
 * Run from apps/api:
 *   npx tsx _sandbox/ekyc-flow/01-get-token.ts
 *
 * Docs: https://docs.signingcloud.com/s/api-integration/doc/get-token-tyDZu02F8D
 */

import * as crypto from "node:crypto";
import { config as loadEnv } from "dotenv";

loadEnv();

// ============ CONFIG — fill in before running ============
const CONFIG = {
  baseUrl: "https://stg-env.signingcloud.com",
  apiSecret: "FE234D43457BD3525BB3D0DAFFD94306E30C2E56",
  apiKey: "FCED73AC7B87B0B6B45E",
  /** Leave empty to fetch a fresh token from SigningCloud. */
  accessToken: "",
  signerEmail: "p2p.dev@shorakagroup.com",
};

interface SigningCloudEncryptedResponse {
  result: number;
  message: string;
  data: string;
  mac: string;
}

function encryptPayload(jsonStr: string, secret: string): { data: string; mac: string } {
  const aesKey = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-ecb", aesKey, Buffer.alloc(0));
  let encrypted = cipher.update(jsonStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  const mac = crypto.createHash("sha256").update(encrypted + secret).digest("hex");
  return { data: encrypted, mac };
}

function decryptSigningCloudResponse<T>(response: SigningCloudEncryptedResponse, apiSecret: string): T {
  const { data, mac } = response;
  const calculatedMac = crypto.createHash("sha256").update(data + apiSecret).digest("hex");
  if (calculatedMac !== mac) {
    throw new Error("MAC validation failed");
  }

  const aesKey = crypto.createHash("sha256").update(apiSecret).digest();
  const decipher = crypto.createDecipheriv("aes-256-ecb", aesKey, Buffer.alloc(0));
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return JSON.parse(decrypted) as T;
}

function resolveConfig() {
  const baseUrl = CONFIG.baseUrl.trim() || process.env.SC_BASE_URL?.trim() || "";
  const apiSecret = CONFIG.apiSecret.trim() || process.env.SC_API_SECRET?.trim() || "";
  const apiKey = CONFIG.apiKey.trim() || process.env.SC_API_KEY?.trim() || "";
  const accessToken = CONFIG.accessToken.trim() || process.env.SC_ACCESS_TOKEN?.trim() || "";
  const signerEmail =
    CONFIG.signerEmail.trim() || process.env.SC_SIGNER_EMAIL?.trim() || "";

  if (!baseUrl || !apiSecret || !apiKey) {
    throw new Error("Set CONFIG.baseUrl, CONFIG.apiSecret, and CONFIG.apiKey.");
  }
  if (!signerEmail) {
    throw new Error("Set CONFIG.signerEmail.");
  }

  return { baseUrl, apiSecret, apiKey, accessToken, signerEmail };
}

async function fetchAccessToken(baseUrl: string, apiKey: string, apiSecret: string): Promise<string> {
  const response = await fetch(
    `${baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(apiKey)}`
  );
  const body = (await response.json()) as SigningCloudEncryptedResponse;
  console.log("response", body);
  if (body.result !== 0 || !body.data || !body.mac) {
    throw new Error(`SigningCloud accesstoken failed: ${JSON.stringify(body)}`);
  }

  const decrypted = decryptSigningCloudResponse<{ at?: string }>(body, apiSecret);
  if (!decrypted.at) {
    throw new Error("SigningCloud accesstoken response missing `at`");
  }
  return decrypted.at;
}

async function getEkycToken(params: {
  baseUrl: string;
  apiSecret: string;
  accessToken: string;
  email: string;
}): Promise<{ url: string; token: string }> {
  const { data, mac } = encryptPayload(JSON.stringify({ email: params.email }), params.apiSecret);
  const query = new URLSearchParams({
    accesstoken: params.accessToken,
    data,
    mac,
  });

  const response = await fetch(
    `${params.baseUrl}/signserver/v1/user/ekyc/getToken?${query.toString()}`,
    { method: "GET" }
  );
  const body = (await response.json()) as {
    result: number;
    message?: string;
    url?: string;
    token?: string;
  };

  if (body.result !== 0 || !body.url || !body.token) {
    throw new Error(`SigningCloud getToken failed: ${JSON.stringify(body)}`);
  }

  return { url: body.url, token: body.token };
}

async function main() {
  const { baseUrl, apiSecret, apiKey, signerEmail } = resolveConfig();
  const token = (await fetchAccessToken(baseUrl, apiKey, apiSecret));
  console.log("token", token);

  console.log(`Requesting eKYC token for: ${signerEmail}\n`);

  const session = await getEkycToken({
    baseUrl,
    apiSecret,
    accessToken: token,
    email: signerEmail,
  });

  console.log("getToken response:");
  console.log(JSON.stringify(session, null, 2));

  const hostedUrl = `${session.url.replace(/\/$/, "")}/?token=${session.token}`;
  console.log("\n--- Next step ---");
  console.log("Copy `url` into _sandbox/ekyc-flow/02-initiate-session.ts CONFIG.wiseConsoleUrl");
  console.log("Copy `token` into _sandbox/ekyc-flow/02-initiate-session.ts CONFIG.sessionToken");
  console.log("(same `token` is also used in step 3 CONFIG.ekycToken)");
  console.log("\nHosted test URL:");
  console.log(hostedUrl);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
