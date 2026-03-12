/**
 * Tests for offer letter download endpoints.
 * GET /v1/applications/:id/offers/contracts/letter
 * GET /v1/applications/:id/offers/invoices/:invoiceId/letter
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { createApplicationRouter } from "./controller";
import { applicationService } from "./service";
import { User } from "@prisma/client";
import { Readable } from "stream";

jest.mock("./service");
jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-issuer-1" } as User;
    next();
  },
}));

function mockPdfStream(): Readable {
  const stream = new Readable();
  stream.push("%PDF-1.4 mock content");
  stream.push(null);
  return stream;
}

describe("Offer letter download", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/applications", createApplicationRouter());
    app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message },
      });
    });
    jest.clearAllMocks();
  });

  describe("GET /v1/applications/:id/offers/contracts/letter", () => {
    it("returns PDF when offer is valid", async () => {
      const mockStream = mockPdfStream();
      (applicationService.getContractOfferLetter as jest.Mock).mockResolvedValue({
        stream: mockStream,
        filename: "contract-offer-clh8x7y6z5w4v3u2t1s0r9q.pdf",
      });

      const response = await request(app)
        .get("/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/offers/contracts/letter");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/pdf/);
      expect(response.headers["content-disposition"]).toContain("contract-offer-clh8x7y6z5w4v3u2t1s0r9q");
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it("returns 400 when no pending offer", async () => {
      const err = new Error("No pending contract offer") as Error & { statusCode?: number };
      err.statusCode = 400;
      (applicationService.getContractOfferLetter as jest.Mock).mockRejectedValue(err);

      const response = await request(app)
        .get("/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/offers/contracts/letter");

      expect(response.status).toBe(400);
    });
  });

  describe("GET /v1/applications/:id/offers/invoices/:invoiceId/letter", () => {
    it("returns PDF when invoice offer is valid", async () => {
      const mockStream = mockPdfStream();
      (applicationService.getInvoiceOfferLetter as jest.Mock).mockResolvedValue({
        stream: mockStream,
        filename: "invoice-offer-clh9a8b7c6d5e4f3g2h1i0j9k.pdf",
      });

      const response = await request(app)
        .get("/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/offers/invoices/clh9a8b7c6d5e4f3g2h1i0j9k/letter");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/pdf/);
      expect(response.headers["content-disposition"]).toContain("invoice-offer-clh9a8b7c6d5e4f3g2h1i0j9k");
      expect(response.body).toBeInstanceOf(Buffer);
    });
  });
});
