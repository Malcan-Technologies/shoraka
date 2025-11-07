import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "15m";

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

