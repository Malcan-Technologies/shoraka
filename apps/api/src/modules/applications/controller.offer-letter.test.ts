/**
 * Tests for signed offer letter download endpoints.
 * GET /v1/applications/:id/offers/contracts/signed-letter
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { createApplicationRouter } from "./controller";
import { applicationService } from "./service";
import { User } from "@prisma/client";

jest.mock("./service");
jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-issuer-1" } as User;
    next();
  },
  // Admin financial-statement routes use this guard; these tests do not exercise them.
  requireAnyPermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

describe("Signed offer letter download", () => {
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

  describe("GET /v1/applications/:id/offers/contracts/signed-letter", () => {
    it("returns PDF buffer when signed letter exists", async () => {
      const buf = Buffer.from("%PDF-1.4 signed");
      (applicationService.getSignedContractOfferLetterBuffer as jest.Mock).mockResolvedValue({
        buffer: buf,
        filename: "signed-contract-offer-x.pdf",
      });

      const response = await request(app)
        .get("/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/offers/contracts/signed-letter");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toMatch(/application\/pdf/);
      expect(response.body).toBeInstanceOf(Buffer);
    });
  });
});
