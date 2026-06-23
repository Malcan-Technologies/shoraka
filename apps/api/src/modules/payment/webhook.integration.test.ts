import express from "express";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { computeCurlecWebhookSignature } from "./curlec-signature";
import { curlecWebhookRouter } from "./webhook-controller";

const prisma = new PrismaClient();

/** Fixed secret for HTTP integration tests — isolated from apps/api/.env */
const TEST_WEBHOOK_SECRET = "whsec_m3_integration_test";

jest.mock("../../config/curlec", () => {
  const actual = jest.requireActual<typeof import("../../config/curlec")>("../../config/curlec");
  return {
    ...actual,
    getCurlecConfig: jest.fn(() => ({
      keyId: "rzp_test_key",
      keySecret: "rzp_test_secret",
      webhookSecret: "whsec_m3_integration_test",
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
    signature?: string;
  }
) {
  const req = request(app)
    .post("/v1/webhooks/curlec")
    .set("Content-Type", "application/json")
    .set("X-Razorpay-Event-Id", params.eventId);

  if (params.signature !== undefined) {
    req.set("X-Razorpay-Signature", params.signature);
  }

  // Send the exact UTF-8 string — supertest JSON-serializes Buffer objects, which breaks HMAC.
  return req.send(params.rawBody);
}

const describeIntegration = process.env.DATABASE_URL ? describe : describe.skip;

describeIntegration("POST /v1/webhooks/curlec", () => {
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
    const rawBody = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_test" } } },
    });
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      signature,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.duplicate).toBe(false);
    expect(response.body.data.eventId).toBe(eventId);

    const stored = await prisma.gatewayWebhookEvent.findUnique({
      where: { event_id: eventId },
    });
    expect(stored?.event_type).toBe("payment.captured");
    expect(stored?.signature_valid).toBe(true);
  });

  it("returns 401 for an invalid signature", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_bad_sig_${Date.now()}`;
    const rawBody = JSON.stringify({ event: "payment.captured" });

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      signature: "deadbeef".repeat(8),
    });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_SIGNATURE");

    const stored = await prisma.gatewayWebhookEvent.findUnique({
      where: { event_id: eventId },
    });
    expect(stored).toBeNull();
  });

  it("dedupes duplicate event_id and still returns 200", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_dup_${Date.now()}`;
    createdEventIds.push(eventId);
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);
    const app = buildTestApp();

    const first = await signedWebhookRequest(app, { rawBody, eventId, signature });
    const second = await signedWebhookRequest(app, { rawBody, eventId, signature });

    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);

    const count = await prisma.gatewayWebhookEvent.count({
      where: { event_id: eventId },
    });
    expect(count).toBe(1);
  });

  it("returns 400 for malformed JSON body", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_malformed_${Date.now()}`;
    const rawBody = "{not-json";
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      signature,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK");
  });

  it("returns 400 when payload fails schema validation", async () => {
    if (!migrated) return;

    const eventId = `evt_m3_invalid_payload_${Date.now()}`;
    const rawBody = JSON.stringify({ payload: {} });
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);

    const response = await signedWebhookRequest(buildTestApp(), {
      rawBody,
      eventId,
      signature,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_WEBHOOK");
  });
});
