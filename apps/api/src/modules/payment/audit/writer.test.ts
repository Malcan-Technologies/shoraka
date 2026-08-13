jest.mock("../../../lib/prisma", () => ({
  prisma: {},
}));

jest.mock("../../../lib/audit/snapshot", () => ({
  loadAuditActorSnapshot: jest.fn(),
}));

import type { Prisma } from "@prisma/client";
import { loadAuditActorSnapshot } from "../../../lib/audit/snapshot";
import { writeGatewayPaymentAudit, writePaymentAuditLog, webhookPaymentAuditContext } from "./writer";

const loadSnapshot = loadAuditActorSnapshot as jest.MockedFunction<typeof loadAuditActorSnapshot>;

function txStub(overrides?: { create?: jest.Mock }) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: "ops@example.com",
        first_name: "Ops",
        last_name: "Admin",
      }),
    },
    paymentAuditLog: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: overrides?.create ?? jest.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

const payment = {
  id: "gp_1",
  investor_organization_id: "inv_1",
  issuer_organization_id: null,
  purpose: "INVESTOR_DEPOSIT",
  amount: { toNumber: () => 100 },
  currency: "MYR",
  gatewayAccount: "INVESTOR_POOL",
  curlec_order_id: "order_1",
  curlec_payment_id: "pay_1",
} as const;

describe("writePaymentAuditLog", () => {
  beforeEach(() => {
    loadSnapshot.mockResolvedValue({ name: "Ops Admin", email: "ops@example.com" });
  });

  it("creates an append-only PaymentAuditLog row with required metadata", async () => {
    const create = jest.fn().mockResolvedValue({});
    await writeGatewayPaymentAudit(
      payment,
      {
        eventType: "PAYMENT_CAPTURED",
        context: webhookPaymentAuditContext(),
        idempotencyKey: "payment-audit:captured:gp_1",
        metadata: {
          purpose: "INVESTOR_DEPOSIT",
          amount: 100,
          currency: "MYR",
          provider: "CURLEC",
          gatewayAccount: "INVESTOR_POOL",
          providerPaymentId: "pay_1",
          providerOrderId: "order_1",
          capturedAt: "2026-08-14T00:00:00.000Z",
        },
      },
      txStub({ create })
    );

    expect(create).toHaveBeenCalledTimes(1);
    const data = create.mock.calls[0][0].data;
    expect(data.event_type).toBe("PAYMENT_CAPTURED");
    expect(data.gateway_payment_id).toBe("gp_1");
    expect(data.target_type).toBe("GATEWAY_PAYMENT");
    expect(data.idempotency_key).toBe("payment-audit:captured:gp_1");
    expect(data.metadata).toEqual(
      expect.objectContaining({
        provider: "CURLEC",
        actorEmail: "ops@example.com",
      })
    );
  });

  it("requires gateway_payment_id for GatewayPayment events", async () => {
    const create = jest.fn();
    await expect(
      writePaymentAuditLog(
        {
          eventType: "PAYMENT_INITIATED",
          context: webhookPaymentAuditContext(),
          targetType: "GATEWAY_PAYMENT",
          targetId: "missing",
          metadata: {
            purpose: "INVESTOR_DEPOSIT",
            amount: 100,
            currency: "MYR",
            provider: "CURLEC",
            gatewayAccount: "INVESTOR_POOL",
            providerOrderId: "order_1",
          },
        },
        txStub({ create })
      )
    ).rejects.toThrow(/gateway_payment_id is required/);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects invalid metadata before insert", async () => {
    const create = jest.fn();
    await expect(
      writeGatewayPaymentAudit(
        payment,
        {
          eventType: "PAYMENT_INITIATED",
          context: webhookPaymentAuditContext(),
          idempotencyKey: "payment-audit:initiated:gp_1",
          metadata: { purpose: "INVESTOR_DEPOSIT" },
        },
        txStub({ create })
      )
    ).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });

  it("treats existing idempotency_key as a no-op before insert", async () => {
    const create = jest.fn();
    const db = {
      user: { findUnique: jest.fn() },
      paymentAuditLog: {
        findUnique: jest.fn().mockResolvedValue({ id: "existing" }),
        create,
      },
    } as unknown as Prisma.TransactionClient;
    await writeGatewayPaymentAudit(
      payment,
      {
        eventType: "PAYMENT_CAPTURED",
        context: webhookPaymentAuditContext(),
        idempotencyKey: "payment-audit:captured:gp_1",
        metadata: {
          purpose: "INVESTOR_DEPOSIT",
          amount: 100,
          currency: "MYR",
          provider: "CURLEC",
          gatewayAccount: "INVESTOR_POOL",
          providerPaymentId: "pay_1",
          providerOrderId: "order_1",
          capturedAt: "2026-08-14T00:00:00.000Z",
        },
      },
      db
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("allows withdrawal and recon events without gateway_payment_id", async () => {
    const create = jest.fn().mockResolvedValue({});
    await writePaymentAuditLog(
      {
        eventType: "PAYMENT_RECONCILIATION_EXCEPTION_DETECTED",
        context: webhookPaymentAuditContext(),
        targetType: "RECON_EXCEPTION",
        targetId: "exc_1",
        idempotencyKey: "payment-audit:recon-detected:OPERATING:pay_1:AMOUNT_MISMATCH",
        metadata: {
          exceptionId: "exc_1",
          mismatchType: "AMOUNT_MISMATCH",
          providerReference: "pay_1",
          runId: "run_1",
        },
      },
      txStub({ create })
    );
    expect(create.mock.calls[0][0].data.gateway_payment_id).toBeNull();
  });
});
