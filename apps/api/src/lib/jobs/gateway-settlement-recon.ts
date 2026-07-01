import {
  GatewayReconExceptionType,
  GatewayReconRunStatus,
  PrismaClient,
} from "@prisma/client";
import { prisma as defaultPrisma } from "../prisma";
import { logger } from "../logger";
import { createCurlecClient } from "../../modules/payment/curlec-client";
import type { CurlecSettlementReconItem } from "../../modules/payment/curlec-schemas";
import { myrDecimalToSen, senToMyrDecimal } from "../../modules/payment/money";

const CRON_CORRELATION_ID = "cron:gateway-settlement-recon";
const RECON_PAGE_SIZE = 100;

export type GatewaySettlementReconResult = {
  runId: string;
  runDate: string;
  status: GatewayReconRunStatus;
  settlementsScanned: number;
  paymentsMatched: number;
  paymentsStamped: number;
  exceptionsCount: number;
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
  year: number,
  month: number,
  day: number
) => Promise<CurlecSettlementReconItem[]>;

async function fetchAllReconItemsForDate(
  year: number,
  month: number,
  day: number
): Promise<CurlecSettlementReconItem[]> {
  const client = createCurlecClient();
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

export async function runGatewaySettlementReconJob(
  input: { runDate?: Date; triggeredBy?: string } = {},
  db: PrismaClient = defaultPrisma,
  fetchReconItems: ReconItemsFetcher = fetchAllReconItemsForDate
): Promise<GatewaySettlementReconResult> {
  const runDate = input.runDate ?? getYesterdayMytDateOnly();
  const triggeredBy = input.triggeredBy ?? "CRON";
  const { year, month, day } = getMytDateParts(runDate);

  let run = await db.gatewayReconRun.upsert({
    where: { run_date: runDate },
    create: {
      run_date: runDate,
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
    const allItems = await fetchReconItems(year, month, day);
    const paymentLines = allItems.filter(isSettledPaymentLine);
    settlementsScanned = paymentLines.length;

    for (const line of paymentLines) {
      const curlecPaymentId = line.payment_id!.trim();
      const curlecAmountSen = reconItemAmountSen(line);

      const gatewayPayment = await db.gatewayPayment.findUnique({
        where: { curlec_payment_id: curlecPaymentId },
      });

      if (!gatewayPayment) {
        await db.gatewayReconException.create({
          data: {
            recon_run_id: run.id,
            type: GatewayReconExceptionType.ORPHAN_CURLEC_PAYMENT,
            curlec_payment_id: curlecPaymentId,
            curlec_settlement_id: line.settlement_id ?? null,
            actual_amount: senToMyrDecimal(curlecAmountSen),
            detail: "Curlec settled payment not found in gateway_payments",
          },
        });
        exceptionsCount += 1;
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
        continue;
      }

      const settledAt =
        line.created_at != null ? new Date(line.created_at * 1000) : new Date();

      await db.gatewayPayment.update({
        where: { id: gatewayPayment.id },
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
      { runId: run.id, error: message, correlationId: CRON_CORRELATION_ID },
      "Gateway settlement recon failed"
    );
    throw error;
  }

  return {
    runId: run.id,
    runDate: runDate.toISOString().slice(0, 10),
    status: run.status,
    settlementsScanned,
    paymentsMatched,
    paymentsStamped,
    exceptionsCount,
  };
}
