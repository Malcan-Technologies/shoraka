import express from "express";
import request from "supertest";
import { CurlecGatewayAccount, PrismaClient } from "@prisma/client";
import { computeCurlecWebhookSignature } from "./curlec-signature";
import { curlecWebhookRouter } from "./webhook-controller";

const prisma = new PrismaClient();

const TEST_WEBHOOK_SECRET_BY_ACCOUNT: Record<CurlecGatewayAccount, string> = {
  LEGACY_DEFAULT: "whsec_m3_legacy",
  OPERATING: "whsec_m3_operating",
  INVESTOR_POOL: "whsec_m3_investor_pool",
};

jest.mock("../../config/curlec", () => {
  const actual = jest.requireActual<typeof import("../../config/curlec")>("../../config/curlec");
  return {
    ...actual,
    getCurlecConfig: jest.fn((gatewayAccount: CurlecGatewayAccount = "LEGACY_DEFAULT") => ({
      gatewayAccount,
      keyId: `rzp_test_${gatewayAccount.toLowerCase()}`,
      keySecret: "rzp_test_secret",
      webhookSecret: TEST_WEBHOOK_SECRET_BY_ACCOUNT[gatewayAccount],
      apiBaseUrl: "https://api.razorpay.com",
      environment: "sandbox" as const,
    })),
  };
});

function buildTestApp() {
  const app = express();
  app.use("/v1/webhooks", curlecWebhookRouter);
  return app;
}

async function gatewayTablesMigrated(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1 FROM gateway_webhook_events LIMIT 1`;
    return true;
  } catch {
    return false;
  }
}

function signedWebhookRequest(
  app: express.Application,
  params: {
    rawBody: string;
    eventId: string;
    routePath: string;
    signature?: string;
  }
) {
  const req = request(app)
    .post(params.routePath)
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Event-Id", params.eventId);

  if (params.signature !== undefined) {
    req.set("X-Razorpay-Signature", params.signature);
  }

  // Send the exact UTF-8 string — supertest JSON-serializes Buffer objects, which breaks HMAC.
  return req.send(params.rawBody);
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("POST /v1/webhooks/curlec/*", () => {
  let migrated = false;
  const createdEventIds: string[] = [];

  beforeAll(async () => {
    migrated = await gatewayTablesMigrated();
  });

  afterAll(async () => {
    if (createdEventIds.length > 0) {
      await prisma.gatewayWebhookEvent.deleteMany({
        where: { event_id: { in: createdEventIds } },
      });
    }
    await prisma.$disconnect();
  });

  it("stores a valid signed webhook event", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_valid_${Date.now()}`;
    createdEventIds.push(eventId);
    const routePath = "/v1/webhooks/curlec/legacy";
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test" } } },
    });
    const signature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath,
      signature,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(false);
    expect(response.body.data.eventId).toBe(eventId);

    const stored = await prisma.gatewayWebhookEvent.findFirst({
      where: { event_id: eventId, gatewayAccount: CurlecGatewayAccount.LEGACY_DEFAULT },
    });
    expect(stored?.event_type).toBe("payment.captured");
    expect(stored?.signature_valid).toBe(true);
    expect(stored?.gatewayAccount).toBe(CurlecGatewayAccount.LEGACY_DEFAULT);
  });

  it("operating route verifies only operating secret", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_operating_${Date.now()}`;
    createdEventIds.push(eventId);
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const signature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.OPERATING
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/operating",
      signature,
    });

    expect(response.status).toBe(200);
    const stored = await prisma.gatewayWebhookEvent.findFirst({
      where: { event_id: eventId, gatewayAccount: CurlecGatewayAccount.OPERATING },
    });
    expect(stored).not.toBeNull();
    expect(stored?.gatewayAccount).toBe(CurlecGatewayAccount.OPERATING);
  });

  it("investor-pool route verifies only investor-pool secret", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_pool_${Date.now()}`;
    createdEventIds.push(eventId);
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const signature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.INVESTOR_POOL
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/investor-pool",
      signature,
    });

    expect(response.status).toBe(200);
    const stored = await prisma.gatewayWebhookEvent.findFirst({
      where: { event_id: eventId, gatewayAccount: CurlecGatewayAccount.INVESTOR_POOL },
    });
    expect(stored).not.toBeNull();
    expect(stored?.gatewayAccount).toBe(CurlecGatewayAccount.INVESTOR_POOL);
  });

  it("operating route rejects payload signed with investor-pool secret", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_bad_operating_${Date.now()}`;
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const wrongSignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.INVESTOR_POOL
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/operating",
      signature: wrongSignature,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("investor-pool route rejects payload signed with legacy secret", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_bad_pool_${Date.now()}`;
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const wrongSignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/investor-pool",
      signature: wrongSignature,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("transitional /curlec route accepts legacy secret only", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_legacy_alias_${Date.now()}`;
    createdEventIds.push(eventId);
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const legacySignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec",
      signature: legacySignature,
    });

    expect(response.status).toBe(200);
    const stored = await prisma.gatewayWebhookEvent.findFirst({
      where: { event_id: eventId, gatewayAccount: CurlecGatewayAccount.LEGACY_DEFAULT },
    });
    expect(stored).not.toBeNull();
  });

  it("transitional /curlec route rejects non-legacy secret", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_legacy_alias_bad_${Date.now()}`;
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: {} } } });
    const nonLegacySignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.OPERATING
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec",
      signature: nonLegacySignature,
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
  });

  it("returns 401 for malformed signature", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_bad_sig_${Date.now()}`;
    const rawBody = JSON.stringify({ event: "payment.captured" });

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/legacy",
      signature: "deadbeef".repeat(8),
    });

    const stored = await prisma.gatewayWebhookEvent.findUnique({
      where: { gatewayAccount_event_id: { gatewayAccount: "LEGACY_DEFAULT", event_id: eventId } },
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");
    expect(stored).toBeNull();
  });

  it("dedupes duplicate event_id within same account and accepts same event_id across accounts", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_dup_${Date.now()}`;
    createdEventIds.push(eventId);
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const legacySignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );
    const operatingSignature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.OPERATING
    );
    const app = buildTestApp();

    const first = await signedWebhookRequest(app, {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/legacy",
      signature: legacySignature,
    });
    const second = await signedWebhookRequest(app, {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/legacy",
      signature: legacySignature,
    });
    const third = await signedWebhookRequest(app, {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/operating",
      signature: operatingSignature,
    });

    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(third.status).toBe(200);
    expect(third.body.data.duplicate).toBe(false);

    const totalCount = await prisma.gatewayWebhookEvent.count({
      where: { event_id: eventId },
    });
    expect(totalCount).toBe(2);
  });

  it("returns 400 for malformed JSON body", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_malformed_${Date.now()}`;
    const rawBody = "{not-json";
    const signature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/legacy",
      signature,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK");
  });

  it("returns 400 when payload fails schema validation", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_invalid_payload_${Date.now()}`;
    const rawBody = JSON.stringify({ payload: {} });
    const signature = computeCurlecWebhookSignature(
      rawBody,
      TEST_WEBHOOK_SECRET_BY_ACCOUNT.LEGACY_DEFAULT
    );

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      routePath: "/v1/webhooks/curlec/legacy",
      signature,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK");
  });
});
