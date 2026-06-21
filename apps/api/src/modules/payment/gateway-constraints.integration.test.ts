import {
  GatewayOrganizationType,
  GatewayPaymentPurpose,
  Prisma,
  PrismaClient,
} from "@prisma/client";

const prisma = new PrismaClient();

async function gatewayTablesMigrated(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_payments LIMIT 1`;
    await prisma.$queryRaw`SELECT 1 FROM gateway_webhook_events LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

const basePaymentInput = {
  purpose: GatewayPaymentPurpose.INVESTOR_DEPOSIT,
  organization_type: GatewayOrganizationType.INVESTOR,
  amount: new Prisma.Decimal("100.000000"),
  curlec_order_id: "order_test_unique",
  idempotency_key: "gateway-payment:test-unique",
};

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("Gateway payment schema unique constraints", () => {
  let migrated = false;
  const createdPaymentIds: string[] = [];
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
  });

  afterAll(async () => {
    if (createdPaymentIds.length > 0) {
      await prisma.gatewayPayment.deleteMany({ where: { id: { in: createdPaymentIds } } });
    }
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({ where: { id: { in: createdEventIds } } });
    }
    await prisma.$disconnect();
  });

  it("rejects duplicate curlec_order_id", async () => {
    if (!migrated) {
      console.warn("Skipping: run prisma migrate dev --name add_gateway_payment_models first");
      return;
    }

    const suffix = `${Date.now()}`;
    const payment = await prisma.gatewayPayment.create({
      data: {
        ...basePaymentInput,
        curlec_order_id: `order_dup_order_${suffix}`,
        idempotency_key: `gateway-payment:order-${suffix}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await expect(
      prisma.gatewayPayment.create({
        data: {
          ...basePaymentInput,
          curlec_order_id: `order_dup_order_${suffix}`,
          idempotency_key: `gateway-payment:other-${suffix}`,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects duplicate idempotency_key", async () => {
    if (!migrated) {
      console.warn("Skipping: run prisma migrate dev --name add_gateway_payment_models first");
      return;
    }

    const suffix = `${Date.now()}`;
    const payment = await prisma.gatewayPayment.create({
      data: {
        ...basePaymentInput,
        curlec_order_id: `order_dup_key_${suffix}`,
        idempotency_key: `gateway-payment:dup-key-${suffix}`,
      },
    });
    createdPaymentIds.push(payment.id);

    await expect(
      prisma.gatewayPayment.create({
        data: {
          ...basePaymentInput,
          curlec_order_id: `order_other_${suffix}`,
          idempotency_key: `gateway-payment:dup-key-${suffix}`,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects duplicate gateway webhook event_id", async () => {
    if (!migrated) {
      console.warn("Skipping: run prisma migrate dev --name add_gateway_payment_models first");
      return;
    }

    const suffix = `${Date.now()}`;
    const event = await prisma.gatewayWebhookEvent.create({
      data: {
        event_id: `evt_dup_${suffix}`,
        event_type: "payment.captured",
        payload: { id: `pay_${suffix}` },
        signature_valid: true,
      },
    });
    createdEventIds.push(event.id);

    await expect(
      prisma.gatewayWebhookEvent.create({
        data: {
          event_id: `evt_dup_${suffix}`,
          event_type: "payment.captured",
          payload: { id: `pay_other_${suffix}` },
          signature_valid: true,
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});
