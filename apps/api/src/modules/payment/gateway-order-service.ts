import {
  CurlecGatewayAccount,
  GatewayOrganizationType,
  GatewayOrderAttemptStatus,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { createHash } from "crypto";
import { getCurlecConfig } from "../../config/curlec";
import { AppError } from "../../lib/http/error-handler";
import { logger } from "../../lib/logger";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { createCurlecClient } from "./curlec-client";
import { resolveGatewayAccountForPurpose } from "./gateway-account";
import { myrToSen } from "./money";
import type { ActorContext } from "./deposit-service";

export type CreateGatewayOrderParams = {
  purpose: GatewayPaymentPurpose;
  organizationType: GatewayOrganizationType;
  amount: number;
  receiptPrefix: string;
  notes: Record<string, string>;
  investorOrganizationId?: string;
  issuerOrganizationId?: string;
  applicationId?: string;
  contractId?: string;
  noteId?: string;
  settlementId?: string;
  idempotencyKey?: string;
  gatewayAccount?: CurlecGatewayAccount;
};

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function mapGatewayPaymentResponse(payment: GatewayPayment) {
  let curlecKeyId: string;
  try {
    curlecKeyId = getCurlecConfig(payment.gatewayAccount).keyId;
  } catch {
    throw new AppError(
      500,
      "CURLEC_ACCOUNT_CONFIG_ERROR",
      `Curlec credentials are not configured for gateway account ${payment.gatewayAccount}`
    );
  }

  return {
    id: payment.id,
    status: payment.status,
    purpose: payment.purpose,
    gatewayAccount: payment.gatewayAccount,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    curlecOrderId: payment.curlec_order_id,
    curlecKeyId,
    investorOrganizationId: payment.investor_organization_id,
    issuerOrganizationId: payment.issuer_organization_id,
    applicationId: payment.application_id,
    contractId: payment.contract_id,
    noteId: payment.note_id,
    nameCheckResult: payment.name_check_result,
    payerName: payment.payer_name,
    createdAt: payment.created_at.toISOString(),
    updatedAt: payment.updated_at.toISOString(),
  };
}

/**
 * Deterministic scope for one logical order attempt.
 * Deposits: deposit intent idempotency key (different intents never merge).
 * Issuer fees: org or application id (active-order reuse still happens before this).
 */
function resolveOrderAttemptScopeKey(params: CreateGatewayOrderParams): string {
  if (params.idempotencyKey) return params.idempotencyKey;
  if (params.purpose === GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE && params.applicationId) {
    return `application:${params.applicationId}`;
  }
  if (params.purpose === GatewayPaymentPurpose.FACILITY_FEE && params.contractId) {
    return `contract:${params.contractId}:facility-fee`;
  }
  if (params.purpose === GatewayPaymentPurpose.EXCESS_LATE_CHARGES && params.noteId) {
    return params.idempotencyKey ?? `note:${params.noteId}:excess-late-charges`;
  }
  if (params.purpose === GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE && params.issuerOrganizationId) {
    return `issuer-org:${params.issuerOrganizationId}`;
  }
  if (params.investorOrganizationId) {
    return `investor-org:${params.investorOrganizationId}`;
  }
  throw new AppError(
    500,
    "GATEWAY_ORDER_SCOPE_MISSING",
    "Cannot resolve a stable scope key for this gateway order attempt"
  );
}

function buildDeterministicReceipt(receiptPrefix: string, scopeKey: string): string {
  const digest = createHash("sha256").update(scopeKey).digest("hex").slice(0, 24);
  return `${receiptPrefix}_${digest}`;
}

/**
 * Failure window closed here: Curlec createOrder succeeds, then local
 * GatewayPayment insert fails. Without a durable attempt checkpoint, retry
 * creates another remote order. Attempt rows are written via defaultPrisma
 * (outside the caller's transaction) so they survive TX rollback.
 */
async function reserveOrRecoverCurlecOrder(
  params: CreateGatewayOrderParams,
  gatewayAccount: CurlecGatewayAccount,
  scopeKey: string
): Promise<{ attemptId: string; curlecOrderId: string; receipt: string; recovered: boolean }> {
  const attemptWhere = {
    gatewayAccount_purpose_scope_key: {
      gatewayAccount,
      purpose: params.purpose,
      scope_key: scopeKey,
    },
  };

  const existing = await defaultPrisma.gatewayOrderAttempt.findUnique({ where: attemptWhere });

  if (
    existing &&
    existing.curlec_order_id &&
    (existing.status === GatewayOrderAttemptStatus.REMOTE_CREATED ||
      existing.status === GatewayOrderAttemptStatus.PENDING)
  ) {
    logger.warn(
      {
        purpose: params.purpose,
        gatewayAccount,
        scopeKey,
        curlecOrderId: existing.curlec_order_id,
      },
      "Recovering orphaned Curlec order attempt instead of creating another remote order"
    );
    return {
      attemptId: existing.id,
      curlecOrderId: existing.curlec_order_id,
      receipt: existing.receipt,
      recovered: true,
    };
  }

  const receipt = buildDeterministicReceipt(params.receiptPrefix, scopeKey);

  const attempt = await defaultPrisma.gatewayOrderAttempt.upsert({
    where: attemptWhere,
    create: {
      gatewayAccount,
      purpose: params.purpose,
      scope_key: scopeKey,
      idempotency_key: params.idempotencyKey ?? null,
      receipt,
      amount: new Prisma.Decimal(params.amount.toFixed(6)),
      currency: "MYR",
      status: GatewayOrderAttemptStatus.PENDING,
    },
    update:
      existing?.status === GatewayOrderAttemptStatus.RESOLVED ||
      existing?.status === GatewayOrderAttemptStatus.FAILED
        ? {
            receipt,
            curlec_order_id: null,
            amount: new Prisma.Decimal(params.amount.toFixed(6)),
            currency: "MYR",
            status: GatewayOrderAttemptStatus.PENDING,
            last_error_code: null,
            idempotency_key: params.idempotencyKey ?? null,
          }
        : {
            receipt: existing?.receipt ?? receipt,
            amount: new Prisma.Decimal(params.amount.toFixed(6)),
          },
  });

  if (attempt.curlec_order_id && attempt.status === GatewayOrderAttemptStatus.REMOTE_CREATED) {
    return {
      attemptId: attempt.id,
      curlecOrderId: attempt.curlec_order_id,
      receipt: attempt.receipt,
      recovered: true,
    };
  }

  const curlecClient = createCurlecClient({ gatewayAccount });
  const order = await curlecClient.createOrder({
    amountSen: myrToSen(params.amount),
    currency: "MYR",
    receipt: attempt.receipt,
    notes: {
      purpose: params.purpose,
      ...params.notes,
    },
  });

  await defaultPrisma.gatewayOrderAttempt.update({
    where: { id: attempt.id },
    data: {
      curlec_order_id: order.id,
      status: GatewayOrderAttemptStatus.REMOTE_CREATED,
    },
  });

  return {
    attemptId: attempt.id,
    curlecOrderId: order.id,
    receipt: attempt.receipt,
    recovered: false,
  };
}

export async function createGatewayOrder(
  actor: ActorContext,
  params: CreateGatewayOrderParams,
  db: PrismaClient | Prisma.TransactionClient = defaultPrisma
) {
  const gatewayAccount = params.gatewayAccount ?? resolveGatewayAccountForPurpose(params.purpose);

  try {
    getCurlecConfig(gatewayAccount);
  } catch {
    throw new AppError(
      500,
      "CURLEC_ACCOUNT_CONFIG_ERROR",
      `Curlec credentials are not configured for gateway account ${gatewayAccount}`
    );
  }

  const scopeKey = resolveOrderAttemptScopeKey(params);
  const { attemptId, curlecOrderId, receipt, recovered } = await reserveOrRecoverCurlecOrder(
    params,
    gatewayAccount,
    scopeKey
  );

  let payment: GatewayPayment;
  try {
    payment = await db.gatewayPayment.create({
      data: {
        purpose: params.purpose,
        organization_type: params.organizationType,
        gatewayAccount,
        investor_organization_id: params.investorOrganizationId,
        issuer_organization_id: params.issuerOrganizationId,
        application_id: params.applicationId,
        contract_id: params.contractId,
        note_id: params.noteId,
        settlement_id: params.settlementId,
        amount: new Prisma.Decimal(params.amount.toFixed(6)),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: curlecOrderId,
        idempotency_key: params.idempotencyKey ?? `curlec:order:${curlecOrderId}`,
        metadata: {
          actorUserId: actor.userId,
          receipt,
        },
      },
    });
  } catch (error) {
    if (recovered && error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existingPayment = await db.gatewayPayment.findFirst({
        where: { gatewayAccount, curlec_order_id: curlecOrderId },
      });
      if (existingPayment) {
        await defaultPrisma.gatewayOrderAttempt.update({
          where: { id: attemptId },
          data: { status: GatewayOrderAttemptStatus.RESOLVED },
        });
        return mapGatewayPaymentResponse(existingPayment);
      }
    }

    await defaultPrisma.gatewayOrderAttempt.update({
      where: { id: attemptId },
      data: {
        status: GatewayOrderAttemptStatus.REMOTE_CREATED,
        last_error_code: "GATEWAY_ORDER_PERSIST_FAILED",
      },
    });

    logger.error(
      {
        purpose: params.purpose,
        gatewayAccount,
        curlecOrderId,
        recovered,
        receipt,
        idempotencyKey: params.idempotencyKey ?? null,
        error: error instanceof Error ? error.message : String(error),
      },
      "Gateway order created remotely but local payment persistence failed"
    );
    throw new AppError(
      500,
      "GATEWAY_ORDER_PERSIST_FAILED",
      "Gateway order was created but local payment persistence failed. Please retry with the same intent."
    );
  }

  await defaultPrisma.gatewayOrderAttempt.update({
    where: { id: attemptId },
    data: { status: GatewayOrderAttemptStatus.RESOLVED, last_error_code: null },
  });

  logger.info(
    {
      purpose: params.purpose,
      gatewayAccount,
      gatewayPaymentId: payment.id,
      curlecOrderId,
      recovered,
    },
    "Gateway order created"
  );

  return mapGatewayPaymentResponse(payment);
}
