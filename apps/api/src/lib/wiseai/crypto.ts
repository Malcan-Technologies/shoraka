/**
 * WiseAI Web SDK helpers for session credentials and encrypted eKYC payloads.
 */

import * as crypto from "crypto";

export interface WiseAiEncryption {
  alg: string;
  mode: string;
  padding: string;
  iv: string;
  key: string;
}

export interface WiseAiSessionCredentials {
  token: string;
  encryption: WiseAiEncryption;
  expired?: number;
  created?: number;
  ttl?: number;
}

export function decryptWiseAiEkycPayload(
  encryptedData: string,
  encryption: WiseAiEncryption
): unknown {
  const key = Buffer.from(encryption.key, "base64");
  const iv = Buffer.from(encryption.iv, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as unknown;
}

/**
 * SigningCloud returns the WiseAI console base URL in `getToken.url`.
 * We exchange the short-lived bearer token for session credentials here.
 */
export async function fetchWiseAiSessionCredentials(
  wiseConsoleBaseUrl: string,
  bearerToken: string
): Promise<WiseAiSessionCredentials | null> {
  const base = wiseConsoleBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/sdk/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
  });

  const body = (await response.json()) as {
    status?: string;
    data?: WiseAiSessionCredentials;
  };

  if (body.status !== "success" || !body.data?.token || !body.data.encryption) {
    return null;
  }

  return body.data;
}
