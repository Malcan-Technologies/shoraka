import session from "express-session";
import pgSession from "connect-pg-simple";
import { Pool } from "pg";
import { getEnv } from "../config/env";
import { logger } from "../lib/logger";
import fs from "fs";
import type { TLSSocketOptions } from "tls";

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

  // AWS RDS requires SSL with CA certificate for secure connections
  let sslConfig: TLSSocketOptions | boolean | undefined = undefined;

  if (env.NODE_ENV === "production") {
    const rdsCertPath = "/app/rds-ca-cert.pem";

    if (fs.existsSync(rdsCertPath)) {
      // Load AWS RDS CA certificate for proper SSL verification
      const caCert = fs.readFileSync(rdsCertPath, "utf8");
      sslConfig = {
        ca: caCert,
        rejectUnauthorized: true, // Verify the server certificate
      };
      logger.info("AWS RDS CA certificate loaded for SSL connection");
    } else {
      // Fallback: Force SSL but skip cert verification
      logger.warn("RDS CA certificate not found at /app/rds-ca-cert.pem - using insecure SSL");
      sslConfig = {
        rejectUnauthorized: false,
      };
    }
  }

  pgPool = new Pool({
    connectionString: env.DATABASE_URL,
    // Optimize for session operations
    max: 10, // Maximum pool size (sessions don't need many connections)
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 2000, // Timeout connection attempts after 2 seconds
    ssl: sslConfig,
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
      // Must use HTTPS in production, but development can use HTTP
      secure: env.NODE_ENV === "production",
      // sameSite "none" required for OAuth redirects through Cognito (both dev and prod)
      // This allows cookies to be sent on cross-site redirects from amazoncognito.com
      sameSite: env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 15 * 60 * 1000, // 15 minutes (matching Cognito token expiry)
      // In production, don't set domain - use exact host matching for better Safari compatibility
      // Setting domain would require __Host- prefix which has strict requirements
      domain: undefined,
      // Path must be / for session to work across all routes
      path: "/",
    },
  };

  logger.info("Session store configured with PostgreSQL");
  return session(sessionConfig);
}
