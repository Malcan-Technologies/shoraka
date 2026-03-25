/**
 * SigningCloud API crypto: AES-256-ECB + SHA256 MAC (request/response envelopes).
 */

import * as crypto from "crypto";

export interface SigningCloudEncryptedResponse {
  result: number;
  message: string;
  data: string;
  mac: string;
}

export function decryptSigningCloudResponse<T = unknown>(
  response: SigningCloudEncryptedResponse,
  apiSecret: string
): T {
  const { data, mac } = response;

  const stringToHash = data + apiSecret;
  const calculatedMac = crypto.createHash("sha256").update(stringToHash).digest("hex");
  if (calculatedMac !== mac) {
    throw new Error("MAC validation failed");
  }

  const aesKey = crypto.createHash("sha256").update(apiSecret).digest();
  const decipher = crypto.createDecipheriv("aes-256-ecb", aesKey, Buffer.alloc(0));
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted) as T;
}

export function encryptPayload(jsonStr: string, secret: string): { data: string; mac: string } {
  const aesKey = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-ecb", aesKey, Buffer.alloc(0));
  let encrypted = cipher.update(jsonStr, "utf8", "hex");
  encrypted += cipher.final("hex");
  const mac = crypto.createHash("sha256").update(encrypted + secret).digest("hex");
  return { data: encrypted, mac };
}

export function assertSigningCloudSuccess(body: SigningCloudEncryptedResponse): void {
  if (body.result !== 0 || !body.data || !body.mac) {
    throw new Error(`SigningCloud error: ${body.message || "unknown"} (result=${body.result})`);
  }
}
