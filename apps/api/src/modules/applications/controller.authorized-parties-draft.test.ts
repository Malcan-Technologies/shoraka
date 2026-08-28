/**
 * POST /v1/applications/:id/offers/contracts/acceptance/authorized-parties-draft
 */

import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
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
const BODY = {
  authorized_parties: {
    parties: [
      {
        key: "issuer",
        entity_kind: "ISSUER",
        representatives: [
          {
            name: "Ali Bin Abu",
            email: "ali@co.my",
            ic_number: "820508105871",
            capacity: "director",
            person_match_key: "820508105871",
          },
        ],
      },
    ],
  },
};

describe("POST contract authorised-parties draft", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use("/v1/applications", createApplicationRouter());
    app.use(
      (
        err: Error & { statusCode?: number; code?: string },
        _req: Request,
        res: Response,
        _next: NextFunction
      ) => {
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
      }
    );
    jest.clearAllMocks();
  });

  it("saves the draft without calling final acceptance submit", async () => {
    (applicationService.saveContractAuthorizedPartiesDraft as jest.Mock).mockResolvedValue({
      id: APP_ID,
    });

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/contracts/acceptance/authorized-parties-draft`)
      .send(BODY);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(applicationService.saveContractAuthorizedPartiesDraft).toHaveBeenCalledWith(
      APP_ID,
      "user-issuer-1",
      BODY.authorized_parties
    );
    expect(applicationService.submitContractOfferAcceptance).not.toHaveBeenCalled();
  });

  it("returns INVALID_STATE when the offer is not editable", async () => {
    (applicationService.saveContractAuthorizedPartiesDraft as jest.Mock).mockRejectedValue(
      Object.assign(new Error("Offer acceptance has already been submitted or is not editable."), {
        statusCode: 400,
        code: "INVALID_STATE",
      })
    );

    const response = await request(app)
      .post(`/v1/applications/${APP_ID}/offers/contracts/acceptance/authorized-parties-draft`)
      .send(BODY);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_STATE");
  });
});
