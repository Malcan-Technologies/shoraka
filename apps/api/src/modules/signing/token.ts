import * as crypto from "crypto";

/** Opaque token sent in signing emails (plaintext only in transit). */
export function generateSigningAccessToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** SHA-256 hash stored in signing_recipients.access_token_hash. */
export function hashSigningAccessToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}
