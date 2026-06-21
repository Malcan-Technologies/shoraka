import { Prisma } from "@prisma/client";
import { resetCurlecConfigCache } from "../../config/curlec";
import { computeCurlecWebhookSignature } from "./curlec-signature";
import { ingestCurlecWebhook } from "./webhook-service";

const TEST_WEBHOOK_SECRET = "whsec_m3_unit_test";

describe("ingestCurlecWebhook", () => {
  const db = {
    gatewayWebhookEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    resetCurlecConfigCache();
    process.env.CURLEC_KEY_ID = "rzp_test_key";
    process.env.CURLEC_KEY_SECRET = "rzp_test_secret";
    process.env.CURLEC_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    resetCurlecConfigCache();
  });

  afterEach(() => {
    resetCurlecConfigCache();
    delete process.env.CURLEC_KEY_ID;
    delete process.env.CURLEC_KEY_SECRET;
    delete process.env.CURLEC_WEBHOOK_SECRET;
  });

  it("stores a new event when signature is valid", async () => {
    const rawBody = JSON.stringify({ event: "payment.captured" });
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);

    (db.gatewayWebhookEvent.create as jest.Mock).mockResolvedValue({ id: "row_1" });

    const result = await ingestCurlecWebhook(
      {
        rawBody,
        signature,
        eventId: "evt_1",
      },
      db as never
    );

    expect(result.duplicate).toBe(false);
    expect(db.gatewayWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event_id: "evt_1",
        event_type: "payment.captured",
        signature_valid: true,
      }),
    });
  });

  it("returns duplicate=true on unique constraint without throwing", async () => {
    const rawBody = JSON.stringify({ event: "payment.failed" });
    const signature = computeCurlecWebhookSignature(rawBody, TEST_WEBHOOK_SECRET);

    (db.gatewayWebhookEvent.create as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      })
    );

    const result = await ingestCurlecWebhook(
      {
        rawBody,
        signature,
        eventId: "evt_dup",
      },
      db as never
    );

    expect(result.duplicate).toBe(true);
    expect(result.eventId).toBe("evt_dup");
  });
});
