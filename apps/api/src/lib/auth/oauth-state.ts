import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { getEnv } from "../../config/env";

/**
 * OAuth state data that needs to be preserved across the OAuth flow
 * This is encrypted and embedded in the OAuth state parameter to avoid Safari ITP cookie blocking
 */
export interface OAuthState {
  nonce: string;
  state: string; // The original OAuth state for CSRF protection
  requestedRole: string;
  signup?: boolean;
  timestamp: number; // To enforce expiration
  stateId: string; // Unique ID for replay attack prevention
}

const ALGORITHM = "aes-256-gcm";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes (Cognito flow should complete in < 5 min)

// In-memory cache for used state IDs (prevents replay attacks)
// In production with multiple containers, consider Redis for this
const usedStateIds = new Set<string>();

// Clean up expired state IDs every 5 minutes
setInterval(
  () => {
    usedStateIds.clear();
  },
  5 * 60 * 1000
);

/**
 * Generate a unique state ID for replay attack prevention
 */
function generateStateId(): string {
  return createHash("sha256").update(randomBytes(32)).digest("hex").substring(0, 16);
}

/**
 * Encrypt OAuth state data into a URL-safe string
 * Uses AES-256-GCM for authenticated encryption
 */
export function encryptOAuthState(data: OAuthState): string {
  const env = getEnv();
  const key = Buffer.from(env.SESSION_SECRET.padEnd(32, "0").substring(0, 32)); // Ensure 32 bytes
  const iv = randomBytes(16); // 16 bytes IV for AES

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const jsonData = JSON.stringify(data);
  let encrypted = cipher.update(jsonData, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  // Combine IV + auth tag + encrypted data
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]);

  // Return URL-safe base64
  return combined.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decrypt OAuth state data from the URL-safe string
 * Throws error if decryption fails, data is expired, or state was already used
 */
export function decryptOAuthState(encryptedState: string): OAuthState {
  const env = getEnv();
  const key = Buffer.from(env.SESSION_SECRET.padEnd(32, "0").substring(0, 32)); // Ensure 32 bytes

  // Convert URL-safe base64 back to normal base64
  const base64 = encryptedState.replace(/-/g, "+").replace(/_/g, "/");
  const combined = Buffer.from(base64, "base64");

  // Extract IV (16 bytes) + auth tag (16 bytes) + encrypted data
  const iv = combined.subarray(0, 16);
  const authTag = combined.subarray(16, 32);
  const encrypted = combined.subarray(32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  const data = JSON.parse(decrypted) as OAuthState;

  // Check if state is expired
  const now = Date.now();
  if (now - data.timestamp > STATE_TTL_MS) {
    throw new Error("OAuth state expired");
  }

  // Check if state was already used (replay attack prevention)
  if (usedStateIds.has(data.stateId)) {
    throw new Error("OAuth state already used (possible replay attack)");
  }

  // Mark state as used
  usedStateIds.add(data.stateId);

  return data;
}

/**
 * Create a new OAuth state with generated stateId
 */
export function createOAuthState(params: Omit<OAuthState, "stateId">): OAuthState {
  return {
    ...params,
    stateId: generateStateId(),
  };
}
