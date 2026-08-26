import {
  ContractStatus,
  GatewayOrganizationType,
  GatewayPayment,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { resolveFacilityFeeBalance, resolveFacilityFeeUpfront, roundNoteMoney } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";
import { lockContractRow } from "../../lib/refresh-contract-facility";
import { prisma as defaultPrisma } from "../../lib/prisma";
import type { ActorContext } from "./deposit-service";
import { createGatewayOrder, mapGatewayPaymentResponse } from "./gateway-order-service";
import { syncGatewayPaymentFromCurlec } from "./webhook-service";

function decimalToNumber(value: Prisma.Decimal): number {
  return value.toNumber();
}

async function assertContractAccess(
  db: PrismaClient,
  actor: ActorContext,
  contractId: string
) {
  const contract = await db.contract.findFirst({
    where: {
      id: contractId,
      issuer_organization: {
        OR: [{ owner_user_id: actor.userId }, { members: { some: { user_id: actor.userId } } }],
      },
    },
    select: {
      id: true,
      status: true,
      issuer_organization_id: true,
      contract_details: true,
    },
  });

  if (!contract) {
    throw new AppError(403, "CONTRACT_FORBIDDEN", "Facility not accessible");
  }

  return contract;
}

async function getFacilityFeeGatewayTxnMaxAmount(db: PrismaClient | Prisma.TransactionClient) {
  const settings = await db.platformFinanceSetting.upsert({
    where: { key: "DEFAULT" },
    update: {},
    create: { key: "DEFAULT" },
  });

  return decimalToNumber(settings.facility_fee_gateway_txn_max_amount);
}

function mapFacilityFeePaymentResponse(
  payment: GatewayPayment,
  totals: {
    upfrontAmount: number;
    paidAmount: number;
    outstanding: number;
    perTxnMaxAmount: number;
  }
) {
  return {
    ...mapGatewayPaymentResponse(payment),
    contractId: payment.contract_id,
    upfrontAmount: totals.upfrontAmount,
    paidAmount: totals.paidAmount,
    outstanding: totals.outstanding,
    perTxnMaxAmount: totals.perTxnMaxAmount,
  };
}

function resolveContractFeeTotals(details: unknown) {
  const balance = resolveFacilityFeeBalance(details);
  const upfront = resolveFacilityFeeUpfront(details);
  return {
    upfrontAmount: upfront.upfrontAmount,
    paidAmount: balance.paid,
    outstanding: upfront.outstanding,
  };
}

async function findReusableFacilityFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  contractId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.FACILITY_FEE,
      contract_id: contractId,
      status: { in: [GatewayPaymentStatus.CREATED, GatewayPaymentStatus.PAID] },
    },
    orderBy: { created_at: "desc" },
  });
}

async function findBlockingFacilityFeePayment(
  db: PrismaClient | Prisma.TransactionClient,
  contractId: string
) {
  return db.gatewayPayment.findFirst({
    where: {
      purpose: GatewayPaymentPurpose.FACILITY_FEE,
      contract_id: contractId,
      status: {
        in: [GatewayPaymentStatus.HELD, GatewayPaymentStatus.REFUND_INITIATED],
      },
    },
    orderBy: { created_at: "desc" },
  });
}

export async function createFacilityFeePayment(
  actor: ActorContext,
  contractId: string,
  db: PrismaClient = defaultPrisma
) {
  await assertContractAccess(db, actor, contractId);
  const perTxnMaxAmount = await getFacilityFeeGatewayTxnMaxAmount(db);

  return db.$transaction(async (tx) => {
    await lockContractRow(tx, contractId);
    const locked = await tx.contract.findUnique({
      where: { id: contractId },
      select: { status: true, contract_details: true, issuer_organization_id: true },
    });
    if (!locked) {
      throw new AppError(404, "NOT_FOUND", "Facility not found");
    }
    if (locked.status !== ContractStatus.APPROVED) {
      throw new AppError(400, "INVALID_STATE", "Facility fee can be paid after the offer is accepted");
    }

    const totals = resolveContractFeeTotals(locked.contract_details);
    const responseTotals = { ...totals, perTxnMaxAmount };

    if (totals.outstanding <= 0) {
      throw new AppError(
        409,
        "FACILITY_FEE_UPFRONT_SETTLED",
        "No outstanding upfront facility fee is due",
        {
          outstanding: 0,
          upfrontAmount: totals.upfrontAmount,
          paidAmount: totals.paidAmount,
        }
      );
    }

    const blocking = await findBlockingFacilityFeePayment(tx, contractId);
    if (blocking) {
      throw new AppError(
        409,
        "FACILITY_FEE_CAPTURE_MISMATCH_HELD",
        blocking.status === GatewayPaymentStatus.REFUND_INITIATED
          ? "A mismatched facility fee refund is still pending. Do not create another payment order."
          : "A captured facility fee payment needs attention. Do not create another payment order.",
        { gatewayPaymentId: blocking.id, status: blocking.status }
      );
    }

    const existing = await findReusableFacilityFeePayment(tx, contractId);
    if (existing) {
      return mapFacilityFeePaymentResponse(existing, responseTotals);
    }

    const amount = roundNoteMoney(Math.min(totals.outstanding, perTxnMaxAmount));
    if (amount <= 0) {
      throw new AppError(
        409,
        "FACILITY_FEE_UPFRONT_SETTLED",
        "No outstanding upfront facility fee is due",
        {
          outstanding: totals.outstanding,
          upfrontAmount: totals.upfrontAmount,
          paidAmount: totals.paidAmount,
        }
      );
    }

    const priorCount = await tx.gatewayPayment.count({
      where: { purpose: GatewayPaymentPurpose.FACILITY_FEE, contract_id: contractId },
    });
    const created = await createGatewayOrder(
      actor,
      {
        purpose: GatewayPaymentPurpose.FACILITY_FEE,
        organizationType: GatewayOrganizationType.ISSUER,
        amount,
        receiptPrefix: "ff",
        notes: {
          contractId,
          issuerOrganizationId: locked.issuer_organization_id,
        },
        issuerOrganizationId: locked.issuer_organization_id,
        contractId,
        idempotencyKey: `contract:${contractId}:facility-fee:${priorCount + 1}`,
      },
      tx
    );

    const stored = await tx.gatewayPayment.findUniqueOrThrow({ where: { id: created.id } });
    return mapFacilityFeePaymentResponse(stored, responseTotals);
  });
}

export async function getFacilityFeePayment(
  actor: ActorContext,
  contractId: string,
  paymentId: string,
  db: PrismaClient = defaultPrisma
) {
  const contract = await assertContractAccess(db, actor, contractId);
  const perTxnMaxAmount = await getFacilityFeeGatewayTxnMaxAmount(db);

  const payment = await db.gatewayPayment.findFirst({
    where: {
      id: paymentId,
      contract_id: contractId,
      purpose: GatewayPaymentPurpose.FACILITY_FEE,
    },
  });

  if (!payment) {
    throw new AppError(404, "FACILITY_FEE_NOT_FOUND", "Facility fee payment not found");
  }

  const synced = await syncGatewayPaymentFromCurlec(payment, db);
  const refreshed = await db.contract.findUnique({
    where: { id: contractId },
    select: { contract_details: true },
  });
  const totals = resolveContractFeeTotals(refreshed?.contract_details ?? contract.contract_details);

  return mapFacilityFeePaymentResponse(synced, {
    ...totals,
    perTxnMaxAmount,
  });
}
