/**
 * Tests for application summary PDF download.
 * GET /v1/applications/:id/summary-pdf
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
}));

describe("Application summary PDF download", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/applications", createApplicationRouter());
    app.use((err: Error & { statusCode?: number; code?: string }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({
        success: false,
        error: { code: err.code ?? "ERROR", message: err.message },
      });
    });
    jest.clearAllMocks();
  });

  it("returns an attachment PDF", async () => {
    (applicationService.getApplicationSummaryPdf as jest.Mock).mockResolvedValue({
      buffer: Buffer.from("%PDF-1.4 summary"),
      filename: "application-summary-APP-ARF-2026-0001.pdf",
    });

    const response = await request(app).get(
      "/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/summary-pdf"
    );

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/pdf/);
    expect(response.headers["content-disposition"]).toBe(
      'attachment; filename="application-summary-APP-ARF-2026-0001.pdf"'
    );
    expect(response.body).toBeInstanceOf(Buffer);
    expect(applicationService.getApplicationSummaryPdf).toHaveBeenCalledWith(
      "clh8x7y6z5w4v3u2t1s0r9q",
      "user-issuer-1"
    );
  });

  it("forwards the service error envelope", async () => {
    const err = Object.assign(new Error("Application not found"), {
      statusCode: 404,
      code: "APPLICATION_NOT_FOUND",
    });
    (applicationService.getApplicationSummaryPdf as jest.Mock).mockRejectedValue(err);

    const response = await request(app).get(
      "/v1/applications/clh8x7y6z5w4v3u2t1s0r9q/summary-pdf"
    );

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: { code: "APPLICATION_NOT_FOUND", message: "Application not found" },
    });
  });
});
