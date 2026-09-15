import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { signingService } from "../signing/service";
import { signingCloudWebhookRouter } from "./webhook-controller";
import { encryptPayload } from "../../lib/signingcloud/crypto";
import { errorHandler, AppError } from "../../lib/http/error-handler";

jest.mock("../signing/service", () => ({
  signingService: {
    applyProviderContractSigned: jest.fn(),
  },
}));

const applyProvider = signingService.applyProviderContractSigned as jest.MockedFunction<
  typeof signingService.applyProviderContractSigned
>;

function buildApp() {
  const app = express();
  app.use("/v1/webhooks/signingcloud", signingCloudWebhookRouter);
  app.use((err: Error, req: Request, res: Response, next: NextFunction) =>
    errorHandler(err, req, res, next)
  );
  return app;
}

describe("SigningCloud webhook", () => {
  const prev = {
    secret: process.env.SC_WEBHOOK_SECRET,
    base: process.env.SC_BASE_URL,
    key: process.env.SC_API_KEY,
    apiSecret: process.env.SC_API_SECRET,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SC_WEBHOOK_SECRET = "webhook-secret";
    process.env.SC_BASE_URL = "https://sc.example";
    process.env.SC_API_KEY = "key";
    process.env.SC_API_SECRET = "api-secret";
    applyProvider.mockResolvedValue({ skipped: false });
  });

  afterAll(() => {
    process.env.SC_WEBHOOK_SECRET = prev.secret;
    process.env.SC_BASE_URL = prev.base;
    process.env.SC_API_KEY = prev.key;
    process.env.SC_API_SECRET = prev.apiSecret;
  });

  it("accepts an encrypted MAC-valid callback without the custom header", async () => {
    const { data, mac } = encryptPayload(JSON.stringify({ contractnum: "SC-123" }), "api-secret");
    const res = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .send({ result: 0, message: "ok", data, mac });
    expect(res.status).toBe(200);
    expect(applyProvider).toHaveBeenCalledWith("SC-123");
  });

  it("rejects an encrypted callback with a bad MAC", async () => {
    const { data } = encryptPayload(JSON.stringify({ contractnum: "SC-123" }), "api-secret");
    const res = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .send({ result: 0, message: "ok", data, mac: "deadbeef" });
    expect(res.status).toBe(400);
    expect(applyProvider).not.toHaveBeenCalled();
  });

  it("requires the shared secret for plaintext callbacks", async () => {
    const unauth = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .send({ contractnum: "SC-123" });
    expect(unauth.status).toBe(401);

    const ok = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .set("x-signingcloud-secret", "webhook-secret")
      .send({ contractnum: "SC-123" });
    expect(ok.status).toBe(200);
    expect(applyProvider).toHaveBeenCalledWith("SC-123");
  });

  it("returns 200 when the contract is unknown so junk callbacks stop", async () => {
    applyProvider.mockResolvedValue({ skipped: true });
    const res = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .set("x-signingcloud-secret", "webhook-secret")
      .send({ contractnum: "missing-contract" });
    expect(res.status).toBe(200);
  });

  it("returns 502 when a known contract cannot be synchronized", async () => {
    applyProvider.mockRejectedValue(
      new AppError(502, "SIGNING_PROVIDER_SYNC_FAILED", "Could not sync signing status from the provider.")
    );
    const res = await request(buildApp())
      .post("/v1/webhooks/signingcloud/callback")
      .set("x-signingcloud-secret", "webhook-secret")
      .send({ contractnum: "SC-123" });
    expect(res.status).toBe(502);
  });
});
