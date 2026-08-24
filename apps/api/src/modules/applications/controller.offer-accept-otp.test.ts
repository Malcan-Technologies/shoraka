/**
 * Invoice offer accept OTP eligibility is enforced before the required OTP body.
 * POST /v1/applications/:id/offers/invoices/:invoiceId/accept
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { UTILISATION_OFFER_CONSENT_IDS } from "@cashsouk/types";
import { ZodError } from "zod";
import { createApplicationRouter } from "./controller";
import { applicationService } from "./service";
import { User } from "@prisma/client";

jest.mock("./service");
jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-issuer-1" } as User;
    next();
  },
}));

const APP_ID = "clh8x7y6z5w4v3u2t1s0r9q";
const INVOICE_ID = "clh9a8b7c6d5e4f3g2h1i0j9k";
const CHALLENGE_ID = "clh7otpchallenge000000001";

describe("POST invoice offer accept OTP eligibility", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/applications", createApplicationRouter());
    app.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: { code: "VALIDATION_ERROR", message: err.message },
        });
        return;
      }
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code ?? "ERROR", message: err.message },
      });
    });
    jest.clearAllMocks();
  });

  it("returns CONTRACT_SIGNING_INCOMPLETE for an empty body before OTP validation", async () => {
    (applicationService.assertInvoiceOfferAcceptAllowed as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Finish facility signing before accepting this invoice offer."), {
        statusCode: 400,
        code: "CONTRACT_SIGNING_INCOMPLETE",
      })
    );

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/invoices/${INVOICE_ID}/accept`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("CONTRACT_SIGNING_INCOMPLETE");
    expect(applicationService.respondToInvoiceOffer).not.toHaveBeenCalled();
  });

  it("returns USE_SIGNING_FLOW for invoice-only accept before OTP validation", async () => {
    (applicationService.assertInvoiceOfferAcceptAllowed as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Complete signing via the signing envelope before accepting this offer."), {
        statusCode: 400,
        code: "USE_SIGNING_FLOW",
      })
    );

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/invoices/${INVOICE_ID}/accept`)
      .send({ challenge_id: "not-a-cuid", otp_code: "12" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("USE_SIGNING_FLOW");
    expect(applicationService.respondToInvoiceOffer).not.toHaveBeenCalled();
  });

  it("still requires a 6-digit OTP body after eligibility passes", async () => {
    (applicationService.assertInvoiceOfferAcceptAllowed as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/invoices/${INVOICE_ID}/accept`)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(applicationService.assertInvoiceOfferAcceptAllowed).toHaveBeenCalledWith(
      APP_ID,
      INVOICE_ID,
      "user-issuer-1"
    );
    expect(applicationService.respondToInvoiceOffer).not.toHaveBeenCalled();
  });

  it("rejects a valid OTP body that is missing utilisation consents", async () => {
    (applicationService.assertInvoiceOfferAcceptAllowed as jest.Mock).mockResolvedValue(undefined);

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/invoices/${INVOICE_ID}/accept`)
      .send({ challenge_id: CHALLENGE_ID, otp_code: "123456" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(applicationService.respondToInvoiceOffer).not.toHaveBeenCalled();
  });

  it("forwards a valid OTP body once the invoice is eligible for direct accept", async () => {
    (applicationService.assertInvoiceOfferAcceptAllowed as jest.Mock).mockResolvedValue(undefined);
    (applicationService.respondToInvoiceOffer as jest.Mock).mockResolvedValue({ id: APP_ID });

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/invoices/${INVOICE_ID}/accept`)
      .send({
        challenge_id: CHALLENGE_ID,
        otp_code: "123456",
        consent_ids: [...UTILISATION_OFFER_CONSENT_IDS],
      });

    expect(response.status).toBe(200);
    expect(applicationService.respondToInvoiceOffer).toHaveBeenCalledWith(
      APP_ID,
      INVOICE_ID,
      "accept",
      "user-issuer-1",
      undefined,
      {
        otp: { challengeId: CHALLENGE_ID, otpCode: "123456" },
        consent_ids: [...UTILISATION_OFFER_CONSENT_IDS],
      }
    );
  });
});
