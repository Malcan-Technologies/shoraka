/**
 * Step 3 — SigningCloud submitResult
 *
 * Run from apps/api:
 *   npx tsx _sandbox/ekyc-flow/03-submit-result.ts
 *
 * Requires SC_BASE_URL, SC_API_KEY, SC_API_SECRET in apps/api/.env
 * (same as query-users.ts — NOT the WiseAI sdk `url` from getToken).
 *
 * Docs: https://docs.signingcloud.com/s/api-integration/doc/submit-ekyc-result
 */

import * as fs from "node:fs";
import * as path from "node:path";
import "dotenv/config";
import {
  decryptSigningCloudResponse,
  encryptPayload,
  assertSigningCloudSuccess,
  type SigningCloudEncryptedResponse,
} from "../../src/lib/signingcloud/crypto";
import {
  getSigningCloudAccessToken,
  type SigningCloudEnvConfig,
} from "../../src/modules/signingcloud/signingcloud-api";
import { requireSigningCloudConfig } from "./lib/signingcloud-request";

// ============ CONFIG — fill in before running ============
const CONFIG = {
  email: "khai.kit@truestack.my",
  /** Session token from step 1 getToken / eKYC lab. */
  ekycToken: "4b3ac978-295d-43c0-9b29-8d5d9289a8f5",
  /**
   * WiseAI encryptedData from SDK capture.
   * Paste directly, or set a file path (e.g. "./encrypted-result.txt").
   */
  ekycResult:
    "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",

  name: "KAU KHAI KIT",
  icNumber: "040812101787",
  country: "MYS",
  /** "mykad" or "PASSPORT" */
  ekycDocType: "mykad",
};

function resolveSessionConfig() {
  const email = CONFIG.email.trim() || process.env.SC_SIGNER_EMAIL?.trim() || "";

  if (!email) throw new Error("Set CONFIG.email.");
  if (!CONFIG.ekycToken.trim()) throw new Error("Set CONFIG.ekycToken from step 1.");
  if (!CONFIG.ekycDocType.trim()) throw new Error("Set CONFIG.ekycDocType.");

  return {
    email,
    ekycToken: CONFIG.ekycToken.trim(),
    name: CONFIG.name.trim().toUpperCase(),
    icNumber: CONFIG.icNumber.trim(),
    country: CONFIG.country.trim() || "MYS",
    ekycDocType: CONFIG.ekycDocType.trim(),
  };
}

function readEkycResult(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Set CONFIG.ekycResult to encryptedData or a file path.");
  }

  const candidatePath = path.resolve(trimmed);
  if (fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile()) {
    return fs.readFileSync(candidatePath, "utf8").trim();
  }

  return trimmed;
}

async function submitEkycResult(
  cfg: SigningCloudEnvConfig,
  accessToken: string,
  params: {
    email: string;
    ekycToken: string;
    ekycResult: string;
    name: string;
    icNumber: string;
    country: string;
    ekycDocType: string;
  }
): Promise<unknown> {
  const rawPayload = {
    ekycResult: params.ekycResult,
    email: params.email,
    name: params.name,
    icNumber: params.icNumber,
    country: params.country,
    ekycDocType: params.ekycDocType,
    token: params.ekycToken,
  };

  console.log("\n=== submitResult — request plain ===");
  console.log(
    JSON.stringify(
      {
        ...rawPayload,
        ekycResult: `${params.ekycResult.slice(0, 48)}… (${params.ekycResult.length} chars)`,
      },
      null,
      2
    )
  );

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), cfg.apiSecret);
  const formBody = new URLSearchParams({
    accesstoken: accessToken,
    data,
    mac,
  });

  const response = await fetch(`${cfg.baseUrl}/signserver/v1/user/ekyc/submitResult`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });

  const body = (await response.json()) as
    | (SigningCloudEncryptedResponse & Record<string, unknown>)
    | Record<string, unknown>;

  console.log("\n=== submitResult — response raw ===");
  console.log(JSON.stringify(body, null, 2));

  if ("result" in body && typeof body.result === "number" && body.result !== 0) {
    throw new Error(`SigningCloud submitResult failed: ${JSON.stringify(body)}`);
  }

  if (
    "data" in body &&
    "mac" in body &&
    typeof body.data === "string" &&
    typeof body.mac === "string"
  ) {
    const encryptedBody = body as SigningCloudEncryptedResponse;
    assertSigningCloudSuccess(encryptedBody);
    const decrypted = decryptSigningCloudResponse(encryptedBody, cfg.apiSecret);
    console.log("\n=== submitResult — response decrypted ===");
    console.log(JSON.stringify(decrypted, null, 2));
    return decrypted;
  }

  return body;
}

async function main() {
  const cfg = requireSigningCloudConfig();
  const session = resolveSessionConfig();
  const ekycResult = readEkycResult(CONFIG.ekycResult);

  // Always fetch a fresh SigningCloud access token (ignores stale SC_ACCESS_TOKEN in .env).
  const accessToken = await getSigningCloudAccessToken(cfg);
  console.log(`Using SC_BASE_URL: ${cfg.baseUrl}`);
  console.log(`Fetched access token (${accessToken.length} chars)`);

  const response = await submitEkycResult(cfg, accessToken, {
    email: session.email,
    ekycToken: session.ekycToken,
    ekycResult,
    name: session.name,
    icNumber: session.icNumber,
    country: session.country,
    ekycDocType: session.ekycDocType,
  });

  console.log("\nDone.");
  return response;
  }

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
