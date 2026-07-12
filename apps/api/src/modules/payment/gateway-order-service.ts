import {
  CurlecGatewayAccount,
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";
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
    nameCheckResult: payment.name_check_result,
    payerName: payment.payer_name,
    createdAt: payment.created_at.toISOString(),
    updatedAt: payment.updated_at.toISOString(),
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

  const receipt = `${params.receiptPrefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const curlecClient = createCurlecClient({ gatewayAccount });
  const order = await curlecClient.createOrder({
    amountSen: myrToSen(params.amount),
    currency: "MYR",
    receipt,
    notes: {
      purpose: params.purpose,
      ...params.notes,
    },
  });

  const payment = await db.gatewayPayment.create({
    data: {
      purpose: params.purpose,
      organization_type: params.organizationType,
      gatewayAccount,
      investor_organization_id: params.investorOrganizationId,
      issuer_organization_id: params.issuerOrganizationId,
      application_id: params.applicationId,
      amount: new Prisma.Decimal(params.amount.toFixed(6)),
      currency: "MYR",
      status: GatewayPaymentStatus.CREATED,
      curlec_order_id: order.id,
      idempotency_key: params.idempotencyKey ?? `curlec:order:${order.id}`,
      metadata: {
        actorUserId: actor.userId,
        receipt,
      },
    },
  });

  logger.info(
    {
      purpose: params.purpose,
      gatewayAccount,
      gatewayPaymentId: payment.id,
      curlecOrderId: order.id,
    },
    "Gateway order created"
  );

  return mapGatewayPaymentResponse(payment);
}
