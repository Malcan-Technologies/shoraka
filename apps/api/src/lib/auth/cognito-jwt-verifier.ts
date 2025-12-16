import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { CognitoJwtVerifierSingleUserPool } from "aws-jwt-verify/cognito-verifier";
import { getEnv } from "../../config/env";

// Lazy-initialized verifier singleton
// This avoids calling getEnv() at module load time, which would fail
// before dotenv has loaded environment variables
let verifier: CognitoJwtVerifierSingleUserPool<{
  userPoolId: string;
  tokenUse: "access";
  clientId: string;
}> | null = null;

/**
 * Get or create the Cognito JWT verifier (lazy singleton)
 */
function getVerifier() {
  if (!verifier) {
    const env = getEnv();
    verifier = CognitoJwtVerifier.create({
      userPoolId: env.COGNITO_USER_POOL_ID,
      tokenUse: "access", // We're verifying access tokens
      clientId: env.COGNITO_CLIENT_ID,
    });
  }
  return verifier;
}

/**
 * Verify a Cognito access token
 * Returns the decoded and verified token payload
 * Throws an error if the token is invalid, expired, or has wrong signature
 * 
 * @param token - The JWT access token to verify
 * @returns The verified token payload containing sub, iss, exp, iat, etc.
 */
export async function verifyCognitoAccessToken(token: string) {
  try {
    const payload = await getVerifier().verify(token);
    return payload;
  } catch (error) {
    // Re-throw with more context
    throw new Error(
      `Token verification failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Hydrate the verifier by pre-loading the JWKS
 * This is optional but recommended to reduce latency on first request
 * Call this during application startup
 */
export async function hydrateVerifier() {
  try {
    await getVerifier().hydrate();
    console.log("✅ Cognito JWT verifier hydrated successfully");
  } catch (error) {
    console.error(
      "⚠️  Failed to hydrate Cognito JWT verifier:",
      error instanceof Error ? error.message : String(error)
    );
    // Don't throw - the verifier will lazy-load JWKS on first verification
  }
}

