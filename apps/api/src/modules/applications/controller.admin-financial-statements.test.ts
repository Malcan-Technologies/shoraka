/**
 * Permission guard for admin financial statement edits.
 * PATCH /v1/applications/:id/admin-financial-statements/{fallback,field}
 */
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { User, UserRole } from "@prisma/client";
import { createApplicationRouter } from "./controller";
import { applicationService } from "./service";

jest.mock("./service");
jest.mock("../../lib/auth/middleware", () => {
  const actual = jest.requireActual("../../lib/auth/middleware");
  return {
    ...actual,
    // Tests set the caller's roles/permissions through headers.
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      const roles = String(req.headers["x-test-roles"] ?? "ADMIN").split(",").filter(Boolean);
      req.user = { user_id: "admin-1", roles } as unknown as User;
      req.adminRoleKey = "TEST_ROLE";
      req.adminPermissions = String(req.headers["x-test-permissions"] ?? "")
        .split(",")
        .filter(Boolean) as Request["adminPermissions"];
      next();
    },
  };
});

const APP_ID = "clh8x7y6z5w4v3u2t1s0r9q";
const ROUTES = [
  `/v1/applications/${APP_ID}/admin-financial-statements/fallback`,
  `/v1/applications/${APP_ID}/admin-financial-statements/field`,
];

describe("admin financial statement edit permissions", () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    (applicationService.upsertAdminFinancialField as jest.Mock).mockResolvedValue({ ok: true });
    (applicationService.upsertAdminFinancialStatementFallbackYear as jest.Mock).mockResolvedValue({
      ok: true,
    });
    app = express();
    app.use(express.json());
    app.use("/v1/applications", createApplicationRouter());
    app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
    });
  });

  it.each(ROUTES)("denies %s for an admin without financial or notes manage", async (route) => {
    const res = await request(app)
      .patch(route)
      .set("x-test-permissions", "applications.view,applications.manage,notes.view")
      .send({});
    expect(res.status).toBe(403);
    expect(applicationService.upsertAdminFinancialField).not.toHaveBeenCalled();
    expect(applicationService.upsertAdminFinancialStatementFallbackYear).not.toHaveBeenCalled();
  });

  it.each(ROUTES)("denies %s for a non-admin caller", async (route) => {
    const res = await request(app)
      .patch(route)
      .set("x-test-roles", UserRole.INVESTOR)
      .set("x-test-permissions", "")
      .send({});
    expect(res.status).toBe(403);
  });

  it.each([["applications.financial.manage"], ["notes.manage"]])(
    "allows %s to save admin financial statements",
    async (permission) => {
      const fallback = await request(app)
        .patch(ROUTES[0])
        .set("x-test-permissions", permission)
        .send({ financialYear: 2024, statementType: "AUDITED", rawFinancialInputs: {} });
      expect(fallback.status).toBe(200);
      const field = await request(app)
        .patch(ROUTES[1])
        .set("x-test-permissions", permission)
        .send({ financialYear: 2024, fieldKey: "revenue", value: 100 });
      expect(field.status).toBe(200);
      expect(applicationService.upsertAdminFinancialStatementFallbackYear).toHaveBeenCalledTimes(1);
      expect(applicationService.upsertAdminFinancialField).toHaveBeenCalledTimes(1);
    }
  );
});
