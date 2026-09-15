/**
 * Decrypt a SigningCloud "data" hex string.
 *
 * Usage:
 *   pnpm tsx _sandbox/decrypt-data "<data_hex>"
 *
 * Requires .env: SC_API_SECRET
 */

import dotenv from "dotenv";
dotenv.config();

import { decryptSigningCloudResponse, SigningCloudEncryptedResponse } from "./signingcloud-decrypt";

const apiSecret = process.env.SC_API_SECRET;
if (!apiSecret) throw new Error("SC_API_SECRET is not set");

const data = process.argv[2], mac = process.argv[3];
if (!data) {
  console.error("Usage: pnpm tsx _sandbox/decrypt-data <data_hex>");
  process.exit(1);
}

const decrypted = decryptSigningCloudResponse({ data, mac } as SigningCloudEncryptedResponse, apiSecret);
try {
  console.log(JSON.stringify(decrypted as unknown, null, 2));
} catch {
  console.log(decrypted);
}
