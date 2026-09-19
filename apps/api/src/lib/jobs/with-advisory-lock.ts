import { createHash } from "crypto";
import { Pool, type PoolClient } from "pg";
import { logger } from "../logger";
import { getRdsPgSslConfig, stripPgSslParamsFromConnectionString } from "../pg/rds-pg-ssl";

/** Stable lock keys — one per background job type. */
export const JOB_LOCK_KEYS = {
  GATEWAY_STUCK_ORDER_POLLER: 9_001_001,
  GATEWAY_SETTLEMENT_RECON: 9_001_002,
  SIGNING_ENVELOPE_EXPIRY: 9_001_003,
  ACCEPTANCE_SIGNING_EXPIRY: 9_001_004,
  SIGNING_RECONCILE: 9_001_005,
  GATEWAY_RECEIPT_RETRY: 9_001_006,
  INVESTMENT_NOTE_CERTIFICATE_RETRY: 9_001_007,
  SETTLEMENT_HIBAH_RECEIPT_RETRY: 9_001_008,
  INVESTMENT_SETTLEMENT_CONFIRMATION_RETRY: 9_001_009,
  SIGNING_ENVELOPE_SEND: 9_001_010,
  NOTE_SERVICING_STATUS: 9_001_011,
  SHORAKA_TAWARRUQ_STATUS_POLLER: 9_001_012,
} as const;

type AdvisoryLockClient = Pick<PoolClient, "query"> & {
  release: (destroy?: boolean) => void;
};
type AdvisoryLockPool = {
  connect: () => Promise<AdvisoryLockClient>;
};

const advisoryLockPool = new Pool({
  connectionString: process.env.DATABASE_URL
    ? stripPgSslParamsFromConnectionString(process.env.DATABASE_URL)
    : process.env.DATABASE_URL,
  ssl: getRdsPgSslConfig(process.env.NODE_ENV === "production"),
});

/** Test/process cleanup helper for advisory lock pool. */
export async function closeAdvisoryLockPool(): Promise<void> {
  await advisoryLockPool.end();
}

/**
 * Run fn only when this process holds a Postgres advisory lock (single-execution across Fargate tasks).
 * Returns null when another instance already holds the lock.
 */
export async function withAdvisoryLock<T>(
  lockKey: number,
  fn: () => Promise<T>,
  pool: AdvisoryLockPool = advisoryLockPool
): Promise<T | null> {
  const client = await pool.connect();
  let destroyClient = false;
  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS acquired",
      [lockKey]
    );
    const acquired = lockResult.rows[0]?.acquired === true;

    if (!acquired) {
      logger.info({ lockKey }, "Advisory lock not acquired — skipping job run");
      return null;
    }

    let callbackError: unknown;
    let result: T | undefined;
    try {
      result = await fn();
    } catch (error) {
      callbackError = error;
    }
    try {
      await client.query("SELECT pg_advisory_unlock($1)", [lockKey]);
    } catch (unlockError) {
      destroyClient = true;
      logger.error(
        {
          lockKey,
          error: unlockError instanceof Error ? unlockError.message : String(unlockError),
        },
        "Failed to release advisory lock"
      );
      if (!callbackError) callbackError = unlockError;
    }
    if (callbackError) throw callbackError;
    return result as T;
  } finally {
    client.release(destroyClient);
  }
}

export function advisoryLockKeyFromId(id: string): number {
  return createHash("sha256").update(id).digest().readInt32BE(0);
}

/**
 * Two-key advisory lock so per-envelope send work is exclusive across API tasks.
 */
export async function withAdvisoryLockPair<T>(
  key1: number,
  key2: number,
  fn: () => Promise<T>,
  pool: AdvisoryLockPool = advisoryLockPool
): Promise<T | null> {
  const client = await pool.connect();
  let destroyClient = false;
  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock($1, $2) AS acquired",
      [key1, key2]
    );
    const acquired = lockResult.rows[0]?.acquired === true;

    if (!acquired) {
      logger.info({ key1, key2 }, "Advisory lock pair not acquired — skipping");
      return null;
    }

    let callbackError: unknown;
    let result: T | undefined;
    try {
      result = await fn();
    } catch (error) {
      callbackError = error;
    }
    try {
      await client.query("SELECT pg_advisory_unlock($1, $2)", [key1, key2]);
    } catch (unlockError) {
      destroyClient = true;
      logger.error(
        {
          key1,
          key2,
          error: unlockError instanceof Error ? unlockError.message : String(unlockError),
        },
        "Failed to release advisory lock pair"
      );
      if (!callbackError) callbackError = unlockError;
    }
    if (callbackError) throw callbackError;
    return result as T;
  } finally {
    client.release(destroyClient);
  }
}
