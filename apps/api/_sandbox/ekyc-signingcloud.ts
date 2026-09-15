/**
 * SigningCloud eKYC session helpers for sandbox scripts.
 */

import dotenv from "dotenv";
import { decryptSigningCloudResponse, encryptPayload } from "./signingcloud-decrypt";

dotenv.config();

export interface SigningCloudConfig {
  baseUrl: string;
  apiSecret: string;
  apiKey: string;
}

export interface SigningCloudEkycSession {
  url: string;
  token: string;
}

function readSigningCloudConfig(): SigningCloudConfig {
  const baseUrl = process.env.SC_BASE_URL?.trim();
  const apiSecret = process.env.SC_API_SECRET?.trim();
  const apiKey = process.env.SC_API_KEY?.trim();
  if (!baseUrl || !apiSecret || !apiKey) {
    throw new Error("SC_BASE_URL, SC_API_SECRET, and SC_API_KEY must be set");
  }
  return { baseUrl, apiSecret, apiKey };
}

/** Fetch SignServer access token (cached in env via SC_ACCESS_TOKEN or live from API). */
export async function getSigningCloudAccessToken(cfg?: SigningCloudConfig): Promise<string> {
  const fromEnv = process.env.SC_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  const { baseUrl, apiKey, apiSecret } = cfg ?? readSigningCloudConfig();
  const res = await fetch(
    `${baseUrl}/signserver/v1/accesstoken?client_id=${encodeURIComponent(apiKey)}`
  );
  const body = (await res.json()) as { result: number; data?: string; mac?: string; at?: string };
  if (body.result !== 0 || !body.data || !body.mac) {
    throw new Error(`SigningCloud accesstoken failed: ${JSON.stringify(body)}`);
  }
  const decrypted = decryptSigningCloudResponse<{ at?: string }>(
    body as { result: number; message: string; data: string; mac: string },
    apiSecret
  );
  if (!decrypted.at) {
    throw new Error("SigningCloud accesstoken response missing `at`");
  }
  return decrypted.at;
}

/**
 * Acquire WiseAI eKYC session credentials for a user email.
 * Returns plain `{ url, token }` — this endpoint is not MAC-encrypted.
 */
export async function getSigningCloudEkycSession(
  email: string,
  cfg?: SigningCloudConfig
): Promise<SigningCloudEkycSession> {
  const { baseUrl, apiSecret } = cfg ?? readSigningCloudConfig();
  const accessToken = await getSigningCloudAccessToken(cfg);

  const { data, mac } = encryptPayload(JSON.stringify({ email }), apiSecret);
  const params = new URLSearchParams({ accesstoken: accessToken, data, mac });
  const res = await fetch(`${baseUrl}/signserver/v1/user/ekyc/getToken?${params.toString()}`, {
    method: "GET",
  });

  const body = (await res.json()) as {
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

/**
 * Submit WiseAI capture result to SigningCloud (after mobile QR flow).
 * Adjust payload shape if your tenant docs differ.
 */
export async function submitSigningCloudEkycResult(
  params: { email: string; ekycToken: string; result: unknown },
  cfg?: SigningCloudConfig
): Promise<unknown> {
  const { baseUrl, apiSecret } = cfg ?? readSigningCloudConfig();
  const accessToken = await getSigningCloudAccessToken(cfg);

  const rawPayload = {
    email: params.email,
    token: params.ekycToken,
    result: params.result,
  };

  const { data, mac } = encryptPayload(JSON.stringify(rawPayload), apiSecret);
  const form = new URLSearchParams({ accesstoken: accessToken, data, mac });

  const res = await fetch(`${baseUrl}/signserver/v1/user/ekyc/submitResult`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const body = await res.json();
  if (typeof body === "object" && body !== null && "result" in body && (body as { result: number }).result !== 0) {
    throw new Error(`SigningCloud submitResult failed: ${JSON.stringify(body)}`);
  }

  // Some tenants return encrypted { data, mac }
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    "mac" in body &&
    typeof (body as { data: unknown }).data === "string"
  ) {
    return decryptSigningCloudResponse(body as { result: number; message: string; data: string; mac: string }, apiSecret);
  }

  return body;
}
