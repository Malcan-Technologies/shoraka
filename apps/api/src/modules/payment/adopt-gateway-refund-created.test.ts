import {
  GatewayPaymentPurpose,
  GatewayPaymentStatus,
  CurlecGatewayAccount,
} from "@prisma/client";
import {
  adoptGatewayRefundCreated,
  isRecoverableRefundCreationHold,
} from "./refund-service";
import { extractRefundRefs } from "./webhook-schemas";

jest.mock("./gateway-events", () => ({
  recordGatewayPaymentEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("./audit/writer", () => ({
  writeGatewayPaymentAudit: jest.fn().mockResolvedValue(undefined),
  webhookPaymentAuditContext: jest.fn(() => ({
    actorType: "INTEGRATION",
    actorUserId: null,
    source: "WEBHOOK",
    portal: null,
    ipAddress: null,
    userAgent: null,
    correlationId: null,
  })),
  adminPaymentAuditContext: jest.fn(() => ({
    actorType: "ADMIN",
    actorUserId: "admin",
    source: "API",
    portal: "ADMIN",
    ipAddress: null,
    userAgent: null,
    correlationId: null,
  })),
  gatewayPaymentAmount: (payment: { amount: { toNumber(): number } | number }) =>
    typeof payment.amount === "number" ? payment.amount : payment.amount.toNumber(),
  PAYMENT_AUDIT_PROVIDER: "CURLEC",
  PAYMENT_AUDIT_TARGET_TYPE: {
    GATEWAY_PAYMENT: "GATEWAY_PAYMENT",
    WITHDRAWAL: "WITHDRAWAL",
    BALANCE_TRANSACTION: "BALANCE_TRANSACTION",
    RECON_EXCEPTION: "RECON_EXCEPTION",
  },
}));

jest.mock("../../config/curlec", () => ({
  getCurlecConfig: jest.fn(),
}));

function basePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "gp_test",
    purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
    gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL,
    status: GatewayPaymentStatus.HELD,
    refund_reference: null,
    curlec_payment_id: "pay_1",
    metadata: {},
    amount: { toNumber: () => 100 } as never,
    ...overrides,
  };
}

describe("isRecoverableRefundCreationHold", () => {
  it("allows only autoRefundFailed holds", () => {
    expect(isRecoverableRefundCreationHold({ autoRefundFailed: { reason: "AMOUNT_MISMATCH" } })).toBe(
      true
    );
  });

  it("rejects currency mismatch, wallet reversal failure, and unknown holds", () => {
    expect(
      isRecoverableRefundCreationHold({
        captureMismatch: { mismatchType: "CURRENCY_MISMATCH" },
      })
    ).toBe(false);
    expect(
      isRecoverableRefundCreationHold({
        refundConfirmedWalletReversalFailed: { refundId: "rfnd_1" },
      })
    ).toBe(false);
    expect(isRecoverableRefundCreationHold({ refundFailed: { error: "failed" } })).toBe(false);
    expect(
      isRecoverableRefundCreationHold({
        captureMismatch: { mismatchType: "AMOUNT_MISMATCH" },
      })
    ).toBe(false);
    expect(isRecoverableRefundCreationHold({})).toBe(false);
  });

  it("rejects wallet reversal even when autoRefundFailed is also present", () => {
    expect(
      isRecoverableRefundCreationHold({
        autoRefundFailed: { reason: "ADMIN_INITIATED" },
        refundConfirmedWalletReversalFailed: { refundId: "rfnd_1" },
      })
    ).toBe(false);
  });
});

describe("adoptGatewayRefundCreated", () => {
  it("adopts refund ID when REFUND_INITIATED has none", async () => {
    const update = jest.fn().mockResolvedValue({});
    const db = {
      gatewayPayment: {
        update,
        findUniqueOrThrow: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: null,
      }) as never,
      { refundId: "rfnd_new" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(update).toHaveBeenCalledWith({
      where: { id: "gp_test" },
      data: { refund_reference: "rfnd_new" },
    });
  });

  it("leaves existing REFUND_INITIATED refund reference unchanged", async () => {
    const update = jest.fn();
    const db = {
      gatewayPayment: { update, findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_existing",
      }) as never,
      { refundId: "rfnd_other" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(update).not.toHaveBeenCalled();
  });

  it("moves recoverable refund-failure HELD to REFUND_INITIATED", async () => {
    const payment = basePayment({
      status: GatewayPaymentStatus.HELD,
      metadata: {
        autoRefundFailed: { reason: "AMOUNT_MISMATCH", error: "timeout", at: "2026-01-01" },
        amountMismatch: { expectedSen: 100, actualSen: 99 },
      },
    });

    const update = jest.fn().mockResolvedValue({});
    const findUniqueOrThrow = jest.fn().mockResolvedValue({
      ...payment,
      status: GatewayPaymentStatus.REFUND_INITIATED,
      refund_reference: "rfnd_recovered",
    });

    const db = {
      gatewayPayment: { update, findUniqueOrThrow },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          gatewayPayment: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
            update,
          },
        }),
    };

    const status = await adoptGatewayRefundCreated(
      payment as never,
      { refundId: "rfnd_recovered" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: GatewayPaymentStatus.REFUND_INITIATED,
          refund_reference: "rfnd_recovered",
        }),
      })
    );
  });

  it("keeps currency-mismatch HELD unchanged", async () => {
    const update = jest.fn();
    const db = {
      gatewayPayment: { update, findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({
        purpose: GatewayPaymentPurpose.ISSUER_ONBOARDING_FEE,
        gatewayAccount: CurlecGatewayAccount.OPERATING,
        metadata: {
          captureMismatch: {
            mismatchType: "CURRENCY_MISMATCH",
            expectedCurrency: "MYR",
            actualCurrency: "SGD",
          },
        },
      }) as never,
      { refundId: "rfnd_unexpected" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.HELD);
    expect(update).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("keeps wallet-reversal-failure HELD unchanged", async () => {
    const update = jest.fn();
    const db = {
      gatewayPayment: { update, findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({
        refund_reference: "rfnd_already",
        metadata: {
          refundConfirmedWalletReversalFailed: {
            refundId: "rfnd_already",
            error: "insufficient balance",
          },
        },
      }) as never,
      { refundId: "rfnd_already" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.HELD);
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps unrelated HELD unchanged", async () => {
    const update = jest.fn();
    const db = {
      gatewayPayment: { update, findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({
        metadata: {
          captureMismatch: { mismatchType: "ORDER_MISMATCH" },
        },
      }) as never,
      { refundId: "rfnd_x" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.HELD);
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves REFUNDED unchanged", async () => {
    const update = jest.fn();
    const db = {
      gatewayPayment: { update, findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };

    const status = await adoptGatewayRefundCreated(
      basePayment({ status: GatewayPaymentStatus.REFUNDED, refund_reference: "rfnd_done" }) as never,
      { refundId: "rfnd_done" },
      db as never
    );

    expect(status).toBe(GatewayPaymentStatus.REFUNDED);
    expect(update).not.toHaveBeenCalled();
  });

  it("is idempotent for duplicate refund.created on recoverable HELD", async () => {
    const payment = basePayment({
      status: GatewayPaymentStatus.HELD,
      metadata: { autoRefundFailed: { reason: "NAME_MISMATCH" } },
    });

    const update = jest.fn().mockResolvedValue({});
    const db = {
      gatewayPayment: {
        update,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...payment,
          status: GatewayPaymentStatus.REFUND_INITIATED,
          refund_reference: "rfnd_dup",
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          gatewayPayment: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
            update,
          },
        }),
    };

    const first = await adoptGatewayRefundCreated(
      payment as never,
      { refundId: "rfnd_dup" },
      db as never
    );
    expect(first).toBe(GatewayPaymentStatus.REFUND_INITIATED);

    const secondDb = {
      gatewayPayment: { update: jest.fn(), findUniqueOrThrow: jest.fn() },
      $transaction: jest.fn(),
    };
    const second = await adoptGatewayRefundCreated(
      {
        ...payment,
        status: GatewayPaymentStatus.REFUND_INITIATED,
        refund_reference: "rfnd_dup",
      } as never,
      { refundId: "rfnd_dup" },
      secondDb as never
    );
    expect(second).toBe(GatewayPaymentStatus.REFUND_INITIATED);
    expect(secondDb.gatewayPayment.update).not.toHaveBeenCalled();
  });

  it("works for OPERATING fee payments with recoverable hold", async () => {
    const payment = basePayment({
      purpose: GatewayPaymentPurpose.APPLICATION_PROCESSING_FEE,
      gatewayAccount: CurlecGatewayAccount.OPERATING,
      metadata: { autoRefundFailed: { reason: "AMOUNT_MISMATCH" } },
    });

    const update = jest.fn().mockResolvedValue({});
    const db = {
      gatewayPayment: {
        update,
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...payment,
          status: GatewayPaymentStatus.REFUND_INITIATED,
          refund_reference: "rfnd_op",
        }),
      },
      $transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
          gatewayPayment: {
            findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
            update,
          },
        }),
    };

    const status = await adoptGatewayRefundCreated(
      payment as never,
      { refundId: "rfnd_op" },
      db as never
    );
    expect(status).toBe(GatewayPaymentStatus.REFUND_INITIATED);
  });
});

describe("extractRefundRefs refund.created", () => {
  it("extracts refund and payment ids for refund.created", () => {
    const refs = extractRefundRefs({
      event: "refund.created",
      payload: {
        refund: {
          entity: {
            id: "rfnd_1",
            payment_id: "pay_1",
            status: "pending",
          },
        },
      },
    });
    expect(refs).toEqual({
      refundId: "rfnd_1",
      paymentId: "pay_1",
      status: "pending",
    });
  });
});
