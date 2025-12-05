import { sign, verify, SignOptions } from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import { getEnv } from "../../config/env";
import { randomBytes } from "crypto";

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

/**
 * Parse time string (e.g., "15m", "7d", "2h") to milliseconds
 * Supports: s (seconds), m (minutes), h (hours), d (days)
 */
export function parseTimeToMs(timeString: string): number {
  const match = timeString.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeString}. Expected format: <number><unit> (e.g., "15m", "7d")`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1000, // seconds to milliseconds
    m: 60 * 1000, // minutes to milliseconds
    h: 60 * 60 * 1000, // hours to milliseconds
    d: 24 * 60 * 60 * 1000, // days to milliseconds
  };

  return value * multipliers[unit];
}

export interface JwtPayload {
  userId: string;
  email: string;
  roles: UserRole[];
  activeRole: UserRole;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenType: "refresh";
  jti: string; // Unique token ID for rotation tracking
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

/**
 * Sign an access token (short-lived, 15 minutes)
 */
export function signToken(payload: JwtPayload): string {
  const env = getEnv();
  return sign(payload, env.JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as SignOptions);
}

/**
 * Verify an access token
 */
export function verifyToken(token: string): JwtPayload {
  const env = getEnv();
  return verify(token, env.JWT_SECRET) as JwtPayload;
}

/**
 * Generate a refresh token (long-lived, 7 days)
 * Includes a unique JTI for rotation tracking
 */
export function generateRefreshToken(userId: string): string {
  const env = getEnv();
  const jti = randomBytes(32).toString("hex"); // Unique token ID
  
  const payload: RefreshTokenPayload = {
    userId,
    tokenType: "refresh",
    jti,
  };
  
  return sign(payload, env.JWT_REFRESH_SECRET || env.JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
  } as SignOptions);
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  const env = getEnv();
  return verify(token, env.JWT_REFRESH_SECRET || env.JWT_SECRET) as RefreshTokenPayload;
}

/**
 * Generate a complete token pair (access + refresh)
 * Returns both tokens and their expiration dates
 */
export function generateTokenPair(
  userId: string,
  email: string,
  roles: UserRole[],
  activeRole: UserRole
): TokenPair {
  const accessPayload: JwtPayload = {
    userId,
    email,
    roles,
    activeRole,
  };
  
  const accessToken = signToken(accessPayload);
  const refreshToken = generateRefreshToken(userId);
  
  // Calculate expiration dates using environment variables
  const now = Date.now();
  const accessTokenExpiresAt = new Date(now + parseTimeToMs(JWT_EXPIRES_IN));
  const refreshTokenExpiresAt = new Date(now + parseTimeToMs(REFRESH_TOKEN_EXPIRES_IN));
  
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt,
    refreshTokenExpiresAt,
  };
}

