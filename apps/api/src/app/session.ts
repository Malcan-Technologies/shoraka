import session from "express-session";
import { getEnv } from "../config/env";

declare module "express-session" {
  interface SessionData {
    nonce?: string;
    state?: string;
    requestedRole?: string;
    signup?: boolean;
  }
}

export function createSessionMiddleware() {
  const env = getEnv();

  return session({
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "cashsouk.sid",
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: env.NODE_ENV === "production" ? "lax" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes (matching Cognito token expiry)
    },
  });
}

