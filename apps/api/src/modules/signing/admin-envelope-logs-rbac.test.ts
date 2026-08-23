import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { createSigningAdminRouter } from "./controller";
import { signingService } from "./service";

jest.mock("./service", () => ({
  signingService: {
    listEnvelopeLogs: jest.fn(),
  },
}));

jest.mock("../../lib/auth/middleware", () => {
  const actual = jest.requireActual("../../lib/auth/middleware");
  return {
    ...actual,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => next(),
  };
});

describe("GET /v1/admin/signing/envelopes/:id/logs RBAC", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const permission = req.headers["x-test-permission"];
      req.user = { user_id: "admin-1", roles: [UserRole.ADMIN] } as Request["user"];
      req.admin = { user_id: "admin-1" } as Request["admin"];
      req.adminPermissions =
        permission === "applications.view"
          ? (["applications.view"] as Request["adminPermissions"])
          : [];
      next();
    });
    app.use("/v1/admin/signing", createSigningAdminRouter());
    app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
    });
    jest.clearAllMocks();
  });

  it("allows an admin with applications.view", async () => {
    (signingService.listEnvelopeLogs as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get("/v1/admin/signing/envelopes/env-1/logs")
      .set("x-test-permission", "applications.view");
    expect(res.status).toBe(200);
    expect(signingService.listEnvelopeLogs).toHaveBeenCalledWith("env-1");
  });

  it("rejects an admin without applications.view", async () => {
    const res = await request(app).get("/v1/admin/signing/envelopes/env-1/logs");
    expect(res.status).toBe(403);
    expect(signingService.listEnvelopeLogs).not.toHaveBeenCalled();
  });
});
