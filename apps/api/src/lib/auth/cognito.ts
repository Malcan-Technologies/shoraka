import { CognitoJwtVerifier } from "aws-jwt-verify";
import { UserRole } from "@prisma/client";

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || "";
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID || "";

// Create verifier for ID tokens
const idTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: COGNITO_CLIENT_ID,
});

// Create verifier for access tokens
const accessTokenVerifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: "access",
  clientId: COGNITO_CLIENT_ID,
});

export interface CognitoTokenPayload {
  sub: string; // Cognito user UUID
  email: string;
  email_verified: boolean;
  cognito_username: string;
  roles?: UserRole[]; // Parsed from custom:roles attribute
  "custom:roles"?: string; // Raw custom attribute (comma-separated)
  iss: string; // Token issuer
  aud: string; // Audience (client ID)
  token_use: "id" | "access";
  auth_time: number;
  exp: number;
  iat: number;
}

/**
 * Verify Cognito ID token and extract payload
 * Validates token signature, expiration, issuer, and audience
 */
export async function verifyCognitoToken(token: string): Promise<CognitoTokenPayload> {
  try {
    // Try as ID token first (contains user info like email)
    const payload = await idTokenVerifier.verify(token);
    return payload as unknown as CognitoTokenPayload;
  } catch (idError) {
    try {
      // Fall back to access token verification
      const payload = await accessTokenVerifier.verify(token);
      return payload as unknown as CognitoTokenPayload;
    } catch (accessError) {
      throw new Error("Invalid or expired Cognito token");
    }
  }
}

/**
 * Extract and parse Cognito token payload
 * Parses custom:roles from comma-separated string to UserRole array
 */
export function extractCognitoPayload(payload: CognitoTokenPayload): {
  sub: string;
  email: string;
  emailVerified: boolean;
  username: string;
  roles: UserRole[];
} {
  // Parse roles from custom:roles attribute
  const rolesString = payload["custom:roles"] || "";
  const roles = rolesString
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r && Object.values(UserRole).includes(r as UserRole)) as UserRole[];

  return {
    sub: payload.sub,
    email: payload.email || "",
    emailVerified: payload.email_verified || false,
    username: payload.cognito_username || payload.email || "",
    roles: roles.length > 0 ? roles : [],
  };
}

/**
 * Verify token and extract payload in one call
 */
export async function verifyCognitoAndExtract(token: string): Promise<{
  sub: string;
  email: string;
  emailVerified: boolean;
  username: string;
  roles: UserRole[];
  rawPayload: CognitoTokenPayload;
}> {
  const rawPayload = await verifyCognitoToken(token);
  const extracted = extractCognitoPayload(rawPayload);
  
  return {
    ...extracted,
    rawPayload,
  };
}

/**
 * Format roles array to comma-separated string for Cognito custom attribute
 */
export function formatRolesForCognito(roles: UserRole[]): string {
  return roles.join(",");
}

/**
 * Parse roles from Cognito custom attribute string
 */
export function parseRolesFromCognito(rolesString: string): UserRole[] {
  if (!rolesString) return [];
  
  return rolesString
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r && Object.values(UserRole).includes(r as UserRole)) as UserRole[];
}

