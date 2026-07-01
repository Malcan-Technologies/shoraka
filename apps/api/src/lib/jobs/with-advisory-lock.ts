import { prisma } from "../prisma";
import { logger } from "../logger";

/** Stable lock keys — one per background job type. */
export const JOB_LOCK_KEYS = {
  GATEWAY_STUCK_ORDER_POLLER: 9_001_001,
  GATEWAY_SETTLEMENT_RECON: 9_001_002,
} as const;

/**
 * Run fn only when this process holds a Postgres advisory lock (single-execution across Fargate tasks).
 * Returns null when another instance already holds the lock.
 */
export async function withAdvisoryLock<T>(
  lockKey: number,
  fn: () => Promise<T>
): Promise<T | null> {
  const rows = await prisma.$queryRaw<{ pg_try_advisory_lock: boolean }[]>`
    SELECT pg_try_advisory_lock(${lockKey})
  `;
  const acquired = rows[0]?.pg_try_advisory_lock === true;

  if (!acquired) {
    logger.info({ lockKey }, "Advisory lock not acquired — skipping job run");
    return null;
  }

  try {
    return await fn();
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey})`;
  }
}
