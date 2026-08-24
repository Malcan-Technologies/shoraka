import {
  ContractStatus,
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  NoteLedgerDirection,
  OrganizationType,
  Prisma,
  PrismaClient,
  UserRole,
} from "@prisma/client";
import { createFacilityFeePayment, getFacilityFeePayment } from "./facility-fee-payment-service";
import { createCurlecClient } from "./curlec-client";
import { processFacilityFeeCapture } from "./webhook-service";

jest.mock("./curlec-client", () => {
  let orderCounter = 0;
  let lastOrderSen = 500000;
  return {
    createCurlecClient: jest.fn(() => ({
      createOrder: jest.fn(async (input: { amountSen?: number }) => {
        orderCounter += 1;
        lastOrderSen = input.amountSen ?? lastOrderSen;
        return {
          id: `order_test_ff_${orderCounter}`,
          amount: lastOrderSen,
          currency: "MYR",
          status: "created",
        };
      }),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: lastOrderSen,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment: jest.fn(async () => ({
        id: `rfnd_test_${Date.now()}`,
        amount: lastOrderSen,
        currency: "MYR",
        status: "processed",
      })),
    })),
  };
});

jest.mock("../../config/curlec", () => {
  const keyByAccount: Record<string, string> = {
    OPERATING: "rzp_test_operating_key",
    INVESTOR_POOL: "rzp_test_pool_key",
  };
  return {
    getCurlecConfig: jest.fn((gatewayAccount: string = "OPERATING") => ({
      gatewayAccount,
      keyId: keyByAccount[gatewayAccount] ?? "rzp_test_unknown_key",
      keySecret: "secret",
      webhookSecret: "whsec",
      apiBaseUrl: "https://api.razorpay.com",
      environment: "sandbox" as const,
    })),
  };
});

jest.mock("./receipt/receipt-service", () => {
  const actual = jest.requireActual("./receipt/receipt-service") as Record<string, unknown>;
  return {
    ...actual,
    scheduleGatewayPaymentReceipt: jest.fn(),
  };
});

const prisma = new PrismaClient();
const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("facility fee gateway payments", () => {
  let migrated = false;
  let userId = "";
  let otherUserId = "";
  let orgId = "";
  let contractId = "";
  const createdPaymentIds: string[] = [];
  const createdContractIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdEventIds: string[] = [];

  const contractDetails = {
    approved_facility: 1_000_000,
    facility_fee_rate_percent: 1,
    facility_fee_total_amount: 10_000,
    facility_fee_paid_amount: 0,
    facility_fee_upfront_amount: 8_000,
    facility_enabled: true,
  };

  async function seedCaptureWebhookEvent(eventId: string, orderId: string, paymentId: string) {
    createdEventIds.push(eventId);
    await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: eventId,
        event_type: "payment.captured",
        gatewayAccount: "OPERATING",
        payload: {
          event: "payment.captured",
          payload: { payment: { entity: { id: paymentId, order_id: orderId } } },
        },
        signature_valid: true,
      },
    });
  }

  async function capturePayment(payment: { id: string; curlec_order_id: string }) {
    const paymentId = `pay_ff_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const eventId = `evt_ff_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    await seedCaptureWebhookEvent(eventId, payment.curlec_order_id, paymentId);
    await processFacilityFeeCapture(
      {
        orderId: payment.curlec_order_id,
        paymentId,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );
  }

  beforeAll(async () => {
    try {
      await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
      await prisma.$queryRaw`SELECT facility_fee_gateway_txn_max_amount FROM platform_finance_settings LIMIT 1`;
      migrated = true;
    } catch {
      migrated = false;
    }

    if (!migrated) return;

    const suffix = `${Date.now()}`.slice(-4);
    const user = await prisma.user.create({
      data: {
        user_id: `F${suffix}`.slice(0, 5),
        email: `facility-fee-${Date.now()}@example.com`,
        cognito_sub: `sub-ff-${Date.now()}`,
        cognito_username: `ff-${Date.now()}`,
        first_name: "Facility",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    userId = user.user_id;
    createdUserIds.push(userId);

    const other = await prisma.user.create({
      data: {
        user_id: `O${suffix}`.slice(0, 5),
        email: `facility-fee-other-${Date.now()}@example.com`,
        cognito_sub: `sub-ff-other-${Date.now()}`,
        cognito_username: `ff-other-${Date.now()}`,
        first_name: "Other",
        last_name: "Issuer",
        roles: [UserRole.ISSUER],
        issuer_account: ["COMPANY"],
      },
    });
    otherUserId = other.user_id;
    createdUserIds.push(otherUserId);

    const org = await prisma.issuerOrganization.create({
      data: {
        owner_user_id: userId,
        type: OrganizationType.COMPANY,
        name: "Facility Fee Corp",
      },
    });
    orgId = org.id;
    createdOrgIds.push(orgId);

    const contract = await prisma.contract.create({
      data: {
        issuer_organization_id: orgId,
        status: ContractStatus.APPROVED,
        contract_details: contractDetails,
      },
    });
    contractId = contract.id;
    createdContractIds.push(contractId);

    await prisma.platformFinanceSetting.upsert({
      where: { key: "DEFAULT" },
      update: {
        facility_fee_gateway_txn_max_amount: new Prisma.Decimal("5000.000000"),
      },
      create: {
        key: "DEFAULT",
        facility_fee_gateway_txn_max_amount: new Prisma.Decimal("5000.000000"),
      },
    });
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({ where: { event_id: { in: createdEventIds } } });
    }
    if (createdPaymentIds.length > 0) {
      await prisma.noteLedgerEntry.deleteMany({
        where: { gateway_payment_id: { in: createdPaymentIds } },
      });
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdContractIds.length > 0) {
      await prisma.gatewayOrderAttempt.deleteMany({
        where: {
          purpose: GatewayPaymentPurpose.FACILITY_FEE,
          OR: createdContractIds.map((id) => ({ scope_key: { startsWith: `contract:${id}` } })),
        },
      });
      await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    }
    if (createdOrgIds.length > 0) {
      await prisma.issuerOrganization.deleteMany({ where: { id: { in: createdOrgIds } } });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { user_id: { in: createdUserIds } } });
    }
    await prisma.$disconnect();
  });

  it("clamps the first order to the configured per-transaction max", async () => {
    if (!migrated) return;

    const result = await createFacilityFeePayment({ userId }, contractId, prisma);
    createdPaymentIds.push(result.id);

    expect(result.status).toBe(GatewayPaymentStatus.CREATED);
    expect(result.amount).toBe(5_000);
    expect(result.purpose).toBe(GatewayPaymentPurpose.FACILITY_FEE);
    expect(result.contractId).toBe(contractId);
    expect(result.gatewayAccount).toBe("OPERATING");
    expect(result.outstanding).toBe(8_000);
    expect(result.upfrontAmount).toBe(8_000);
    expect(result.perTxnMaxAmount).toBe(5_000);

    const stored = await prisma.gatewayPayment.findUnique({ where: { id: result.id } });
    expect(stored?.purpose).toBe(GatewayPaymentPurpose.FACILITY_FEE);
    expect(stored?.organization_type).toBe(GatewayOrganizationType.ISSUER);
    expect(stored?.contract_id).toBe(contractId);
  });

  it("reuses an active CREATED order instead of opening another", async () => {
    if (!migrated) return;

    const first = await createFacilityFeePayment({ userId }, contractId, prisma);
    const second = await createFacilityFeePayment({ userId }, contractId, prisma);
    createdPaymentIds.push(first.id);

    expect(second.id).toBe(first.id);
    const count = await prisma.gatewayPayment.count({
      where: { contract_id: contractId, purpose: GatewayPaymentPurpose.FACILITY_FEE },
    });
    expect(count).toBe(1);
  });

  it("blocks IDOR on create and lookup", async () => {
    if (!migrated) return;

    const created = await createFacilityFeePayment({ userId }, contractId, prisma);
    createdPaymentIds.push(created.id);

    await expect(createFacilityFeePayment({ userId: otherUserId }, contractId, prisma)).rejects.toMatchObject(
      { code: "CONTRACT_FORBIDDEN" }
    );
    await expect(
      getFacilityFeePayment({ userId: otherUserId }, contractId, created.id, prisma)
    ).rejects.toMatchObject({ code: "CONTRACT_FORBIDDEN" });
  });

  it("captures under the contract lock, posts ledger once, and allows the next order", async () => {
    if (!migrated) return;

    const first = await createFacilityFeePayment({ userId }, contractId, prisma);
    createdPaymentIds.push(first.id);
    const stored = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: first.id } });
    await capturePayment(stored);

    const completed = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: first.id } });
    expect(completed.status).toBe(GatewayPaymentStatus.COMPLETED);

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    const details = contract.contract_details as { facility_fee_paid_amount?: number };
    expect(details.facility_fee_paid_amount).toBe(5_000);
    expect(details.facility_fee_upfront_amount).toBe(8_000);

    const ledgerCount = await prisma.noteLedgerEntry.count({
      where: { idempotency_key: `gateway-facility-fee:ledger:${first.id}` },
    });
    expect(ledgerCount).toBe(1);
    const ledger = await prisma.noteLedgerEntry.findFirst({
      where: { gateway_payment_id: first.id },
    });
    expect(ledger?.direction).toBe(NoteLedgerDirection.CREDIT);
    expect(ledger?.amount.toNumber()).toBe(5_000);

    const replayEventId = `evt_ff_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(replayEventId, stored.curlec_order_id, `pay_ff_replay_${Date.now()}`);
    await processFacilityFeeCapture(
      {
        orderId: stored.curlec_order_id,
        paymentId: `pay_ff_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );
    expect(
      await prisma.noteLedgerEntry.count({
        where: { idempotency_key: `gateway-facility-fee:ledger:${first.id}` },
      })
    ).toBe(1);

    const second = await createFacilityFeePayment({ userId }, contractId, prisma);
    createdPaymentIds.push(second.id);
    expect(second.id).not.toBe(first.id);
    expect(second.amount).toBe(3_000);
    expect(second.outstanding).toBe(3_000);
    expect(second.paidAmount).toBe(5_000);

    const secondStored = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: second.id } });
    await capturePayment(secondStored);
    const afterSecond = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
    expect((afterSecond.contract_details as { facility_fee_paid_amount?: number }).facility_fee_paid_amount).toBe(
      8_000
    );
  });

  it("returns 409 when outstanding is already zero", async () => {
    if (!migrated) return;

    await expect(createFacilityFeePayment({ userId }, contractId, prisma)).rejects.toMatchObject({
      code: "FACILITY_FEE_UPFRONT_SETTLED",
      statusCode: 409,
    });
  });

  it("does not over-credit paid when a capture would exceed the facility fee total", async () => {
    if (!migrated) return;

    const overflowContract = await prisma.contract.create({
      data: {
        issuer_organization_id: orgId,
        status: ContractStatus.APPROVED,
        contract_details: {
          ...contractDetails,
          facility_fee_paid_amount: 9_500,
          facility_fee_upfront_amount: 8_000,
        },
      },
    });
    createdContractIds.push(overflowContract.id);

    const overflowPayment = await prisma.gatewayPayment.create({
      data: {
        purpose: GatewayPaymentPurpose.FACILITY_FEE,
        organization_type: GatewayOrganizationType.ISSUER,
        gatewayAccount: "OPERATING",
        issuer_organization_id: orgId,
        contract_id: overflowContract.id,
        amount: new Prisma.Decimal("2000.000000"),
        currency: "MYR",
        status: GatewayPaymentStatus.CREATED,
        curlec_order_id: `order_ff_overflow_${Date.now()}`,
        idempotency_key: `ff-overflow-${Date.now()}`,
      },
    });
    createdPaymentIds.push(overflowPayment.id);

    const mockedCreateCurlecClient = createCurlecClient as jest.Mock;
    mockedCreateCurlecClient.mockImplementation(() => ({
      createOrder: jest.fn(),
      fetchPayment: jest.fn(async (paymentId: string) => ({
        id: paymentId,
        amount: 200000,
        currency: "MYR",
        status: "captured",
        method: "fpx",
        order_id: null,
      })),
      fetchOrderPayments: jest.fn(async () => []),
      refundPayment: jest.fn(),
    }));

    const paymentId = `pay_ff_overflow_${Date.now()}`;
    const eventId = `evt_ff_overflow_${Date.now()}`;
    await seedCaptureWebhookEvent(eventId, overflowPayment.curlec_order_id, paymentId);

    await processFacilityFeeCapture(
      {
        orderId: overflowPayment.curlec_order_id,
        paymentId,
        eventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const contract = await prisma.contract.findUniqueOrThrow({ where: { id: overflowContract.id } });
    expect((contract.contract_details as { facility_fee_paid_amount?: number }).facility_fee_paid_amount).toBe(
      9_500
    );
    const payment = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: overflowPayment.id } });
    expect(payment.status).toBe(GatewayPaymentStatus.HELD);
    expect((payment.metadata as { captureMismatch?: { mismatchType?: string } }).captureMismatch).toMatchObject({
      mismatchType: "FACILITY_FEE_CAPTURE_EXCEEDS_TOTAL",
    });
    expect(
      await prisma.noteLedgerEntry.count({
        where: { idempotency_key: `gateway-facility-fee:ledger:${overflowPayment.id}` },
      })
    ).toBe(0);
    const firstEvent = await prisma.gatewayWebhookEvent.findFirstOrThrow({
      where: { event_id: eventId, gatewayAccount: "OPERATING" },
    });
    expect(firstEvent.processed_at).not.toBeNull();

    const replayEventId = `evt_ff_overflow_replay_${Date.now()}`;
    await seedCaptureWebhookEvent(replayEventId, overflowPayment.curlec_order_id, `pay_ff_overflow_replay_${Date.now()}`);
    await processFacilityFeeCapture(
      {
        orderId: overflowPayment.curlec_order_id,
        paymentId: `pay_ff_overflow_replay_${Date.now()}`,
        eventId: replayEventId,
        routeGatewayAccount: "OPERATING",
      },
      prisma
    );

    const replayed = await prisma.gatewayPayment.findUniqueOrThrow({ where: { id: overflowPayment.id } });
    expect(replayed.status).toBe(GatewayPaymentStatus.HELD);
    const replayContract = await prisma.contract.findUniqueOrThrow({ where: { id: overflowContract.id } });
    expect(
      (replayContract.contract_details as { facility_fee_paid_amount?: number }).facility_fee_paid_amount
    ).toBe(9_500);
    expect(
      await prisma.noteLedgerEntry.count({
        where: { idempotency_key: `gateway-facility-fee:ledger:${overflowPayment.id}` },
      })
    ).toBe(0);
    const replayEvent = await prisma.gatewayWebhookEvent.findFirstOrThrow({
      where: { event_id: replayEventId, gatewayAccount: "OPERATING" },
    });
    expect(replayEvent.processed_at).not.toBeNull();
  });
});
