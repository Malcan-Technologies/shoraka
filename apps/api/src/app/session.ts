import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";

declare module "express-session" {
  interface SessionData {
    nonce?: string;
    state?: string;
    requestedRole?: string;
    signup?: boolean;
  }
}

const PgSession = pgSession(session);
let pgPool: Pool | null = null;

function getPgPool(): Pool {
  if (pgPool) {
    return pgPool;
  }

  const env = getEnv();
  
  pgPool = new Pool({
    connectionString: env.DATABASE_URL,
    // Optimize for session operations
    max: 10, // Maximum pool size (sessions don't need many connections)
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Timeout connection attempts after 2 seconds
  });

  pgPool.on("error", (err: Error) => {
    logger.error({ error: err }, "PostgreSQL pool error");
  });

  pgPool.on("connect", () => {
    logger.info("PostgreSQL session pool connected");
  });

  logger.info("PostgreSQL connection pool initialized for sessions");

  return pgPool;
}

export async function createSessionMiddleware() {
  const env = getEnv();
  const pool = getPgPool();

  const sessionConfig: session.SessionOptions = {
    store: new PgSession({
      pool: pool,
      tableName: "session", // Table name for storing sessions
      createTableIfMissing: true, // Auto-create table on first run
      ttl: 15 * 60, // 15 minutes in seconds
      pruneSessionInterval: 60, // Clean expired sessions every 60 seconds
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: "cashsouk.sid",
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes (matching Cognito token expiry)
      domain: env.COOKIE_DOMAIN, // e.g., ".cashsouk.com" for cross-subdomain
    },
  };

  logger.info("Session store configured with PostgreSQL");
  return session(sessionConfig);
}

