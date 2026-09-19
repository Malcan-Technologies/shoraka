import {
  SHORAKA_PROVIDER_STATUSES,
  ShorakaStpService,
  normalizeProviderStatus,
} from "../../modules/shoraka-stp/shoraka-stp-service";
import { prisma } from "../prisma";
import { logger } from "../logger";
import { withAdvisoryLock, advisoryLockKeyFromId } from "./with-advisory-lock";

const DEFAULT_POLL_STATUSES = [
  SHORAKA_PROVIDER_STATUSES.ACTIVE,
  SHORAKA_PROVIDER_STATUSES.PENDING_SELL,
] as const;
type PollableShorakaStatus = (typeof DEFAULT_POLL_STATUSES)[number];

const POLL_JOB_LOCK_WINDOW_MS = 5 * 60 * 1000; // same as cron cadence; avoids tight loops
const SHORAKA_POLL_BATCH_LIMIT = 100;

function nowMinusMs(ms: number): Date {
  return new Date(Date.now() - ms);
}

export type ShorakaTawarruqStatusPollerResult = {
  scanned: number;
  updated: number;
  skippedLocked: number;
  errors: number;
  errorDetails: Array<{ withdrawalInstructionId: string; error: string }>;
};

function isPollableStatus(status: string | null | undefined): status is PollableShorakaStatus {
  const normalized = normalizeProviderStatus(status);
  return DEFAULT_POLL_STATUSES.includes(normalized as PollableShorakaStatus);
}

export async function runShorakaTawarruqStatusPollerJob(
  shorakaStpService: ShorakaStpService,
  opts?: {
    pollStatuses?: readonly PollableShorakaStatus[];
    batchLimit?: number;
  }
): Promise<ShorakaTawarruqStatusPollerResult> {
  const pollStatuses = opts?.pollStatuses ?? DEFAULT_POLL_STATUSES;
  const batchLimit = opts?.batchLimit ?? SHORAKA_POLL_BATCH_LIMIT;

  const cutoff = nowMinusMs(POLL_JOB_LOCK_WINDOW_MS);

  const result: ShorakaTawarruqStatusPollerResult = {
    scanned: 0,
    updated: 0,
    skippedLocked: 0,
    errors: 0,
    errorDetails: [],
  };

  // Select orders that are still in provider in-progress states.
  // These will naturally stop being returned once a webhook/poll updates the status to
  // terminal states (Completed/Cancelled/Take Delivery) because we only query Active/Pending Sell.
  const candidateOrders = await prisma.shorakaTradeOrder.findMany({
    where: {
      provider_order_id: { not: null },
      AND: [
        {
          OR: [
            ...pollStatuses.map((s) => ({
              status: { equals: s, mode: "insensitive" as const },
            })),
          ],
        },
        {
          OR: [{ status_last_checked_at: null }, { status_last_checked_at: { lte: cutoff } }],
        },
      ],
    },
    select: {
      withdrawal_instruction_id: true,
      status: true,
      status_last_checked_at: true,
      provider_order_id: true,
    },
    orderBy: { status_last_checked_at: "asc" },
    take: batchLimit,
  });

  result.scanned = candidateOrders.length;

  for (const row of candidateOrders) {
    const withdrawalInstructionId = row.withdrawal_instruction_id;
    if (!withdrawalInstructionId) continue;
    if (!isPollableStatus(row.status)) continue;

    // Ensure that if multiple job instances run concurrently (or a webhook arrives),
    // we don't issue overlapping provider queries for the same withdrawal.
    const lockKey = advisoryLockKeyFromId(`shoraka:${withdrawalInstructionId}`);

    try {
      const outcome = await withAdvisoryLock(lockKey, async () => {
        // Re-check inside the lock (cheap + prevents unnecessary provider calls).
        const fresh = await prisma.shorakaTradeOrder.findUnique({
          where: { withdrawal_instruction_id: withdrawalInstructionId },
          select: { status: true },
        });
        if (!fresh?.status || !isPollableStatus(fresh.status)) return "skipped-terminal";

        await shorakaStpService.queryStatusForWithdrawal(withdrawalInstructionId);
        return "updated";
      });

      if (outcome === "updated") result.updated += 1;
      else if (outcome === null) result.skippedLocked += 1;
    } catch (error) {
      result.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      result.errorDetails.push({ withdrawalInstructionId, error: message });
      logger.error(
        { withdrawalInstructionId, error: message },
        "Shoraka Tawarruq status poll failed for withdrawal"
      );
    }
  }

  logger.info(
    {
      scanned: result.scanned,
      updated: result.updated,
      skippedLocked: result.skippedLocked,
      errors: result.errors,
    },
    "Shoraka Tawarruq status poller completed"
  );

  return result;
}

