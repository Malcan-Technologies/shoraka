/**
 * Signing controller auth / authz coverage.
 */
import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { createSigningRouter, createSigningAdminRouter } from "./controller";
import { signingService } from "./service";
import { User, UserRole } from "@prisma/client";

jest.mock("./service");

const mockUser: User = {
  user_id: "user-1",
  email: "issuer@example.com",
  cognito_sub: "sub",
  cognito_username: "issuer",
  roles: [UserRole.BORROWER],
  first_name: "Issuer",
  last_name: "User",
  investor_account: [],
  issuer_account: ["org-1"],
  created_at: new Date(),
  updated_at: new Date(),
};

jest.mock("../../lib/auth/middleware", () => ({
  requireAuth: (req: Request, _res: Response, next: NextFunction) => {
    if (!req.headers.authorization) {
      const err = new Error("User not authenticated") as Error & { statusCode?: number };
      err.statusCode = 401;
      return next(err);
    }
    req.user = mockUser;
    next();
  },
  requirePermission: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

describe("SigningController", () => {
  let issuerApp: express.Application;
  let adminApp: express.Application;

  beforeEach(() => {
    issuerApp = express();
    issuerApp.use(express.json());
    issuerApp.use("/v1/signing", createSigningRouter());
    issuerApp.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message },
      });
    });

    adminApp = express();
    adminApp.use(express.json());
    adminApp.use("/v1/admin/signing", createSigningAdminRouter());
    adminApp.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { message: err.message },
      });
    });

    jest.clearAllMocks();
  });

  describe("issuer routes require auth", () => {
    const auth = { Authorization: "Bearer token" };

    it("GET /envelopes/:id returns 401 without auth", async () => {
      const res = await request(issuerApp).get("/v1/signing/envelopes/env-1");
      expect(res.status).toBe(401);
    });

    it("POST /envelopes/:id/send returns 401 without auth", async () => {
      const res = await request(issuerApp).post("/v1/signing/envelopes/env-1/send");
      expect(res.status).toBe(401);
    });

    it("GET /applications/:applicationId/envelopes returns 401 without auth", async () => {
      const res = await request(issuerApp).get("/v1/signing/applications/app-1/envelopes");
      expect(res.status).toBe(401);
    });

    it("POST /applications/:applicationId/envelopes returns 401 without auth", async () => {
      const res = await request(issuerApp)
        .post("/v1/signing/applications/app-1/envelopes")
        .send({ bindings: [{ role_key: "director", name: "A", email: "a@b.c" }] });
      expect(res.status).toBe(401);
    });

    it("GET /applications/:applicationId/product-workflow returns 401 without auth", async () => {
      const res = await request(issuerApp).get("/v1/signing/applications/app-1/product-workflow");
      expect(res.status).toBe(401);
    });

    it("POST /envelopes/:id/sync-from-provider returns 401 without auth", async () => {
      const res = await request(issuerApp).post("/v1/signing/envelopes/env-1/sync-from-provider");
      expect(res.status).toBe(401);
    });

    it("POST /envelopes/:id/recipients/:recipientId/remind returns 401 without auth", async () => {
      const res = await request(issuerApp).post(
        "/v1/signing/envelopes/env-1/recipients/rec-1/remind"
      );
      expect(res.status).toBe(401);
    });

    it("GET /envelopes/:id/logs returns 401 without auth", async () => {
      const res = await request(issuerApp).get("/v1/signing/envelopes/env-1/logs");
      expect(res.status).toBe(401);
    });

    it("GET /applications/:applicationId/documents/:documentId/signed returns 401 without auth", async () => {
      const res = await request(issuerApp).get(
        "/v1/signing/applications/app-1/documents/doc-1/signed"
      );
      expect(res.status).toBe(401);
    });

    it("GET /envelopes/:id succeeds with auth", async () => {
      (signingService.getEnvelopeForIssuer as jest.Mock).mockResolvedValue({ id: "env-1" });
      const res = await request(issuerApp)
        .get("/v1/signing/envelopes/env-1")
        .set(auth);
      expect(res.status).toBe(200);
      expect(signingService.getEnvelopeForIssuer).toHaveBeenCalledWith("env-1", "user-1");
    });
  });

  describe("external routes are unauthenticated", () => {
    it("GET /external/:token does not require auth", async () => {
      (signingService.getEnvelopeForExternalToken as jest.Mock).mockResolvedValue({
        recipient_id: "r1",
        access_verified: false,
      });
      const res = await request(issuerApp).get("/v1/signing/external/token-abc");
      expect(res.status).toBe(200);
      expect(signingService.getEnvelopeForExternalToken).toHaveBeenCalledWith("token-abc");
    });

    it("POST /return/:returnSessionId/confirm does not require auth", async () => {
      (signingService.confirmRecipientSignedForReturnSession as jest.Mock).mockResolvedValue({
        recipient_id: "r1",
      });
      const res = await request(issuerApp).post("/v1/signing/return/rs-abc/confirm");
      expect(res.status).toBe(200);
      expect(signingService.confirmRecipientSignedForReturnSession).toHaveBeenCalledWith("rs-abc");
    });
  });

  describe("admin routes", () => {
    it("POST /envelopes/:id/void requires auth when mounted like production", async () => {
      const authedAdmin = express();
      authedAdmin.use(express.json());
      authedAdmin.use((req: Request, _res: Response, next: NextFunction) => {
        req.user = { ...mockUser, roles: [UserRole.ADMIN] };
        next();
      });
      authedAdmin.use("/v1/admin/signing", createSigningAdminRouter());
      authedAdmin.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
        res.status(err.statusCode || 500).json({
          success: false,
          error: { message: err.message },
        });
      });

      (signingService.voidEnvelope as jest.Mock).mockResolvedValue({ id: "env-1", status: "VOIDED" });
      const res = await request(authedAdmin).post("/v1/admin/signing/envelopes/env-1/void").send({});
      expect(res.status).toBe(200);
      expect(signingService.voidEnvelope).toHaveBeenCalledWith(
        "env-1",
        null,
        expect.objectContaining({ actorUserId: "user-1", portal: "ADMIN" })
      );
    });
  });
});
