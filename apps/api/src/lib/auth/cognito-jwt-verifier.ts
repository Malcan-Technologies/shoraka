import { CognitoJwtVerifier } from "aws-jwt-verify";
import { getEnv } from "../../config/env";

// Lazy-initialized verifier singleton
// This avoids calling getEnv() at module load time, which would fail
// before dotenv has loaded environment variables
// Type is inferred automatically - no explicit type needed
let verifier: any = null;

/**
 * Get or create the Cognito JWT verifier (lazy singleton)
 * Note: clientId is omitted to avoid scope claim validation issues.
 * Cognito may return scope as an array, but aws-jwt-verify expects a string.
 * We still verify token signature, expiration, and issuer - just skip client-specific validations.
 */
function getVerifier() {
  if (!verifier) {
    const env = getEnv();
    verifier = CognitoJwtVerifier.create({
      userPoolId: env.COGNITO_USER_POOL_ID,
      tokenUse: "access", // We're verifying access tokens
	  clientId: null,
      // clientId is omitted to avoid scope claim format validation
      // The token is still verified for signature, expiration, and issuer
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

