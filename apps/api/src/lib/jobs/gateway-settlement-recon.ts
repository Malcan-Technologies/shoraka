import {
  CurlecGatewayAccount,
  GatewayReconExceptionType,
  GatewayReconRunStatus,
  OpsAlertSeverity,
  OpsAlertType,
  PrismaClient,
} from "@prisma/client";
import { getCurlecGatewayAccountConfigStatus } from "../../config/curlec";
import { createCurlecClient } from "../../modules/payment/curlec-client";
import type { CurlecSettlementReconItem } from "../../modules/payment/curlec-schemas";
import { myrDecimalToSen, senToMyrDecimal } from "../../modules/payment/money";
import { AppError } from "../http/error-handler";
import { logger } from "../logger";
import { prisma as defaultPrisma } from "../prisma";
import { withAdvisoryLock } from "./with-advisory-lock";
import { raiseOpsAlert } from "../../modules/ops-alerts/service";

const CRON_CORRELATION_ID = "cron:gateway-settlement-recon";
const RECON_PAGE_SIZE = 100;
const RECON_LOCK_KEY_BASE = 9_201_000;

export type GatewaySettlementReconResult = {
  runId: string;
  runDate: string;
  gatewayAccount: CurlecGatewayAccount;
  status: GatewayReconRunStatus;
  settlementsScanned: number;
  paymentsMatched: number;
  paymentsStamped: number;
  exceptionsCount: number;
};

export type GatewaySettlementReconMultiAccountResult = {
  runDate: string;
  completed: GatewaySettlementReconResult[];
  skippedUnconfigured: Array<{ gatewayAccount: CurlecGatewayAccount; reason: string }>;
  failed: Array<{ gatewayAccount: CurlecGatewayAccount; error: string }>;
};

/** Calendar date parts for a given instant in Malaysia time (UTC+8). */
export function getMytDateParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dateOnly: Date;
} {
  const mytMs = date.getTime() + 8 * 60 * 60 * 1000;
  const myt = new Date(mytMs);
  const year = myt.getUTCFullYear();
  const month = myt.getUTCMonth() + 1;
  const day = myt.getUTCDate();
  return {
    year,
    month,
    day,
    dateOnly: new Date(Date.UTC(year, myt.getUTCMonth(), day)),
  };
}

/** Yesterday's calendar date in MYT as UTC midnight for DB @db.Date storage. */
export function getYesterdayMytDateOnly(reference: Date = new Date()): Date {
  const mytMs = reference.getTime() + 8 * 60 * 60 * 1000;
  const myt = new Date(mytMs);
  myt.setUTCDate(myt.getUTCDate() - 1);
  return new Date(Date.UTC(myt.getUTCFullYear(), myt.getUTCMonth(), myt.getUTCDate()));
}

function isSettledPaymentLine(item: CurlecSettlementReconItem): boolean {
  const entityType = item.entity_type ?? item.type ?? "";
  if (entityType !== "payment") {
    return false;
  }
  return item.settled === true && Boolean(item.payment_id?.trim());
}

function reconItemAmountSen(item: CurlecSettlementReconItem): number {
  return item.amount;
}

function gatewayFeeSen(item: CurlecSettlementReconItem): number {
  return (item.fee ?? 0) + (item.tax ?? 0);
}

/**
 * Fetches the settled recon line items for a MYT calendar date.
 * Injectable so dev tooling and tests can supply canned data (Curlec test mode
 * never produces real settlements). Production always uses the default.
 */
export type ReconItemsFetcher = (
  gatewayAccount: CurlecGatewayAccount,
  year: number,
  month: number,
  day: number
) => Promise<CurlecSettlementReconItem[]>;

async function fetchAllReconItemsForDate(
  gatewayAccount: CurlecGatewayAccount,
  year: number,
  month: number,
  day: number
): Promise<CurlecSettlementReconItem[]> {
  const client = createCurlecClient({ gatewayAccount });
  const items: CurlecSettlementReconItem[] = [];
  let skip = 0;

  while (true) {
    const page = await client.fetchSettlementRecon({
      year,
      month,
      day,
      count: RECON_PAGE_SIZE,
      skip,
    });
    items.push(...page.items);
    if (page.items.length < RECON_PAGE_SIZE) {
      break;
    }
    skip += RECON_PAGE_SIZE;
  }

  return items;
}

function formatRunDate(runDate: Date): string {
  return runDate.toISOString().slice(0, 10);
}

function hashLockScope(scope: string): number {
  let hash = 0;
  for (let i = 0; i < scope.length; i += 1) {
    hash = (hash * 31 + scope.charCodeAt(i)) >>> 0;
  }
  return hash % 100_000;
}

export function getGatewaySettlementReconLockKey(
  runDate: Date,
  gatewayAccount: CurlecGatewayAccount
): number {
  const scope = `${formatRunDate(runDate)}:${gatewayAccount}`;
  return RECON_LOCK_KEY_BASE + hashLockScope(scope);
}

async function runGatewaySettlementReconForAccount(
  input: { runDate: Date; triggeredBy: string; gatewayAccount: CurlecGatewayAccount },
  db: PrismaClient = defaultPrisma,
  fetchReconItems: ReconItemsFetcher = fetchAllReconItemsForDate
): Promise<GatewaySettlementReconResult> {
  const { runDate, triggeredBy, gatewayAccount } = input;
  const { year, month, day } = getMytDateParts(runDate);

  let run = await db.gatewayReconRun.upsert({
    where: {
      run_date_gatewayAccount: {
        run_date: runDate,
        gatewayAccount,
      },
    },
    create: {
      run_date: runDate,
      gatewayAccount,
      status: GatewayReconRunStatus.RUNNING,
      triggered_by: triggeredBy,
      started_at: new Date(),
    },
    update: {
      status: GatewayReconRunStatus.RUNNING,
      triggered_by: triggeredBy,
      started_at: new Date(),
      completed_at: null,
      error: null,
      settlements_scanned: 0,
      payments_matched: 0,
      payments_stamped: 0,
      exceptions_count: 0,
    },
  });

  await db.gatewayReconException.deleteMany({ where: { recon_run_id: run.id } });

  let settlementsScanned = 0;
  let paymentsMatched = 0;
  let paymentsStamped = 0;
  let exceptionsCount = 0;

  try {
    const allItems = await fetchReconItems(gatewayAccount, year, month, day);
    const paymentLines = allItems.filter(isSettledPaymentLine);
    settlementsScanned = paymentLines.length;

    for (const line of paymentLines) {
      const curlecPaymentId = line.payment_id!.trim();
      const curlecAmountSen = reconItemAmountSen(line);

      const gatewayPayment = await db.gatewayPayment.findFirst({
        where: { curlec_payment_id: curlecPaymentId, gatewayAccount },
      });

      if (!gatewayPayment) {
        const crossAccountMatch = await db.gatewayPayment.findFirst({
          where: {
            curlec_payment_id: curlecPaymentId,
            gatewayAccount: { not: gatewayAccount },
          },
          select: { id: true, gatewayAccount: true },
        });

        await db.gatewayReconException.create({
          data: {
            recon_run_id: run.id,
            type: GatewayReconExceptionType.ORPHAN_CURLEC_PAYMENT,
            curlec_payment_id: curlecPaymentId,
            curlec_settlement_id: line.settlement_id ?? null,
            actual_amount: senToMyrDecimal(curlecAmountSen),
            detail: crossAccountMatch
              ? `Payment ID is linked to another Curlec account (${crossAccountMatch.gatewayAccount}). No payment was updated.`
              : "Curlec settled payment not found in gateway_payments for account",
          },
        });
        exceptionsCount += 1;
        await raiseOpsAlert({
          type: OpsAlertType.RECON_MISMATCH,
          severity: OpsAlertSeverity.HIGH,
          dedupeKey: `recon-mismatch:${run.id}:${curlecPaymentId}`,
          title: "Settlement recon orphan Curlec payment",
          summary: `Curlec payment ${curlecPaymentId} has no matching gateway payment`,
          entityType: "gateway_recon_run",
          entityId: run.id,
          details: { curlecPaymentId, gatewayAccount },
        });
        continue;
      }

      paymentsMatched += 1;
      const expectedSen = myrDecimalToSen(gatewayPayment.amount);

      if (expectedSen !== curlecAmountSen) {
        await db.gatewayReconException.create({
          data: {
            recon_run_id: run.id,
            type: GatewayReconExceptionType.AMOUNT_MISMATCH,
            gateway_payment_id: gatewayPayment.id,
            curlec_payment_id: curlecPaymentId,
            curlec_settlement_id: line.settlement_id ?? null,
            expected_amount: gatewayPayment.amount,
            actual_amount: senToMyrDecimal(curlecAmountSen),
            detail: `Expected ${expectedSen} sen, Curlec reported ${curlecAmountSen} sen`,
          },
        });
        exceptionsCount += 1;
        await raiseOpsAlert({
          type: OpsAlertType.RECON_MISMATCH,
          severity: OpsAlertSeverity.HIGH,
          dedupeKey: `recon-mismatch:${run.id}:${gatewayPayment.id}`,
          title: "Settlement recon amount mismatch",
          summary: `Expected ${expectedSen} sen, Curlec reported ${curlecAmountSen} sen`,
          entityType: "gateway_payment",
          entityId: gatewayPayment.id,
          details: { curlecPaymentId, gatewayAccount },
        });
        continue;
      }

      const settledAt =
        line.created_at != null ? new Date(line.created_at * 1000) : new Date();

      await db.gatewayPayment.updateMany({
        where: { id: gatewayPayment.id, gatewayAccount },
        data: {
          settlement_id: line.settlement_id ?? gatewayPayment.settlement_id,
          settled_at: settledAt,
          gateway_fee_amount: senToMyrDecimal(gatewayFeeSen(line)),
        },
      });
      paymentsStamped += 1;
    }

    run = await db.gatewayReconRun.update({
      where: { id: run.id },
      data: {
        status: GatewayReconRunStatus.COMPLETED,
        settlements_scanned: settlementsScanned,
        payments_matched: paymentsMatched,
        payments_stamped: paymentsStamped,
        exceptions_count: exceptionsCount,
        completed_at: new Date(),
      },
    });

    logger.info(
      {
        runId: run.id,
        runDate: runDate.toISOString(),
        gatewayAccount,
        settlementsScanned,
        paymentsMatched,
        paymentsStamped,
        exceptionsCount,
        correlationId: CRON_CORRELATION_ID,
      },
      "Gateway settlement recon completed"
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    run = await db.gatewayReconRun.update({
      where: { id: run.id },
      data: {
        status: GatewayReconRunStatus.FAILED,
        error: message,
        completed_at: new Date(),
        settlements_scanned: settlementsScanned,
        payments_matched: paymentsMatched,
        payments_stamped: paymentsStamped,
        exceptions_count: exceptionsCount,
      },
    });
    logger.error(
      {
        runId: run.id,
        runDate: runDate.toISOString(),
        gatewayAccount,
        error: message,
        correlationId: CRON_CORRELATION_ID,
      },
      "Gateway settlement recon failed"
    );
    await raiseOpsAlert({
      type: OpsAlertType.RECON_MISMATCH,
      severity: OpsAlertSeverity.CRITICAL,
      dedupeKey: `recon-run-failed:${run.id}`,
      title: "Settlement recon run failed",
      summary: message,
      entityType: "gateway_recon_run",
      entityId: run.id,
      details: { gatewayAccount },
    });
    throw error;
  }

  return {
    runId: run.id,
    runDate: runDate.toISOString().slice(0, 10),
    gatewayAccount,
    status: run.status,
    settlementsScanned,
    paymentsMatched,
    paymentsStamped,
    exceptionsCount,
  };
}

export async function runGatewaySettlementReconJob(
  input: {
    runDate?: Date;
    triggeredBy?: string;
    gatewayAccount?: CurlecGatewayAccount;
    skipIfLocked?: boolean;
  } = {},
  db: PrismaClient = defaultPrisma,
  fetchReconItems: ReconItemsFetcher = fetchAllReconItemsForDate
): Promise<GatewaySettlementReconResult | null> {
  const runDate = input.runDate ?? getYesterdayMytDateOnly();
  const triggeredBy = input.triggeredBy ?? "CRON";
  if (!input.gatewayAccount) {
    throw new AppError(
      400,
      "GATEWAY_ACCOUNT_REQUIRED",
      "gatewayAccount is required for settlement reconciliation (OPERATING or INVESTOR_POOL)"
    );
  }
  const gatewayAccount = input.gatewayAccount;
  const accountConfigStatus = getCurlecGatewayAccountConfigStatus(gatewayAccount);
  if (!accountConfigStatus.configured) {
    throw new AppError(
      400,
      "CURLEC_GATEWAY_ACCOUNT_UNCONFIGURED",
      `Curlec ${gatewayAccount} credentials are incomplete. Missing: ${accountConfigStatus.missingEnvNames.join(", ")}`
    );
  }

  const lockKey = getGatewaySettlementReconLockKey(runDate, gatewayAccount);
  const result = await withAdvisoryLock(lockKey, async () =>
    runGatewaySettlementReconForAccount({ runDate, triggeredBy, gatewayAccount }, db, fetchReconItems)
  );

  if (result) {
    return result;
  }

  logger.info(
    {
      runDate: formatRunDate(runDate),
      gatewayAccount,
      lockKey,
      correlationId: CRON_CORRELATION_ID,
    },
    "Gateway settlement recon skipped because lock not acquired"
  );

  if (input.skipIfLocked) {
    return null;
  }

  throw new AppError(
    409,
    "RECON_LOCK_NOT_ACQUIRED",
    `Reconciliation already running for ${gatewayAccount} on ${formatRunDate(runDate)}`
  );
}

export async function runGatewaySettlementReconForConfiguredAccounts(
  input: { runDate?: Date; triggeredBy?: string } = {},
  db: PrismaClient = defaultPrisma,
  fetchReconItems: ReconItemsFetcher = fetchAllReconItemsForDate
): Promise<GatewaySettlementReconMultiAccountResult> {
  const runDate = input.runDate ?? getYesterdayMytDateOnly();
  const triggeredBy = input.triggeredBy ?? "CRON";
  const completed: GatewaySettlementReconResult[] = [];
  const skippedUnconfigured: Array<{ gatewayAccount: CurlecGatewayAccount; reason: string }> = [];
  const failed: Array<{ gatewayAccount: CurlecGatewayAccount; error: string }> = [];

  for (const gatewayAccount of Object.values(CurlecGatewayAccount)) {
    const status = getCurlecGatewayAccountConfigStatus(gatewayAccount);
    if (!status.configured) {
      if (status.isPartial) {
        const error = `Curlec ${gatewayAccount} credentials are incomplete. Missing: ${status.missingEnvNames.join(", ")}`;
        failed.push({ gatewayAccount, error });
        logger.error(
          {
            runDate: formatRunDate(runDate),
            gatewayAccount,
            missingEnvNames: status.missingEnvNames,
            correlationId: CRON_CORRELATION_ID,
          },
          "Skipping gateway settlement recon due to partial account configuration"
        );
      } else {
        const reason = "account not configured";
        skippedUnconfigured.push({ gatewayAccount, reason });
        logger.info(
          {
            runDate: formatRunDate(runDate),
            gatewayAccount,
            reason,
            correlationId: CRON_CORRELATION_ID,
          },
          "Skipping gateway settlement recon for unconfigured account"
        );
      }
      continue;
    }

    try {
      const result = await runGatewaySettlementReconJob(
        {
          runDate,
          triggeredBy,
          gatewayAccount,
          skipIfLocked: true,
        },
        db,
        fetchReconItems
      );

      if (!result) {
        failed.push({
          gatewayAccount,
          error: `Reconciliation lock not acquired for ${gatewayAccount} on ${formatRunDate(runDate)}`,
        });
        continue;
      }

      completed.push(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed.push({ gatewayAccount, error: message });
      logger.error(
        {
          runDate: formatRunDate(runDate),
          gatewayAccount,
          error: message,
          correlationId: CRON_CORRELATION_ID,
        },
        "Gateway settlement recon failed for account"
      );
    }
  }

  return {
    runDate: formatRunDate(runDate),
    completed,
    skippedUnconfigured,
    failed,
  };
}
