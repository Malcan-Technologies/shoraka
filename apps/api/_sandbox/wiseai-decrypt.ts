/**
 * Decrypt WiseAI Web SDK encrypted eKYC results (AES-256-CBC).
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

/** Request session encryption keys from WiseAI using the SigningCloud-issued token. */
export async function fetchWiseAiSessionCredentials(
  wiseConsoleBaseUrl: string,
  bearerToken: string
): Promise<WiseAiSessionCredentials | null> {
  const base = wiseConsoleBaseUrl.replace(/\/$/, "");
  const res = await fetch(`${base}/sdk/token`, {
    method: "POST",
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  const body = (await res.json()) as {
    status?: string;
    code?: string;
    data?: WiseAiSessionCredentials;
  };

  if (body.status !== "success" || !body.data?.encryption || !body.data.token) {
    return null;
  }

  return body.data;
}
