import {
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";
import { getCurlecConfig } from "../../config/curlec";
import { prisma as defaultPrisma } from "../../lib/prisma";
import { createCurlecClient } from "./curlec-client";
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
};

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

export function mapGatewayPaymentResponse(payment: GatewayPayment) {
  return {
    id: payment.id,
    status: payment.status,
    purpose: payment.purpose,
    amount: decimalToNumber(payment.amount),
    currency: payment.currency,
    curlecOrderId: payment.curlec_order_id,
    curlecKeyId: getCurlecConfig().keyId,
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
  db: PrismaClient = defaultPrisma
) {
  const receipt = `${params.receiptPrefix}_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const curlecClient = createCurlecClient();
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
      investor_organization_id: params.investorOrganizationId,
      issuer_organization_id: params.issuerOrganizationId,
      application_id: params.applicationId,
      amount: new Prisma.Decimal(params.amount.toFixed(6)),
      currency: "MYR",
      status: GatewayPaymentStatus.CREATED,
      curlec_order_id: order.id,
      idempotency_key: `curlec:order:${order.id}`,
      metadata: {
        actorUserId: actor.userId,
        receipt,
      },
    },
  });

  return mapGatewayPaymentResponse(payment);
}
