import request from "supertest";
import express, { Request, Response, NextFunction } from "express";
import { UserRole } from "@prisma/client";
import { createApplicationRouter } from "./controller";
import { applicationService } from "./service";

jest.mock("./service", () => ({
  applicationService: {
    getApplicationLogs: jest.fn(),
  },
}));

jest.mock("../../lib/auth/middleware", () => {
  const actual = jest.requireActual("../../lib/auth/middleware");
  return {
    ...actual,
    requireAuth: (req: Request, _res: Response, next: NextFunction) => {
      if (!req.headers.authorization) {
        return next(Object.assign(new Error("User not authenticated"), { statusCode: 401 }));
      }
      next();
    },
  };
});

function attachUser(
  req: Request,
  user: { user_id: string; roles: UserRole[]; permissions?: string[]; roleKey?: string }
) {
  req.user = {
    user_id: user.user_id,
    roles: user.roles,
  } as Request["user"];
  req.adminPermissions = (user.permissions ?? []) as Request["adminPermissions"];
  req.adminRoleKey = user.roleKey as Request["adminRoleKey"];
  if (user.roles.includes(UserRole.ADMIN)) {
    req.admin = { user_id: user.user_id } as Request["admin"];
  }
}

describe("GET /v1/applications/:id/logs RBAC", () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const role = req.headers["x-test-role"];
      const permission = req.headers["x-test-permission"];
      if (role === "ADMIN") {
        attachUser(req, {
          user_id: "admin-1",
          roles: [UserRole.ADMIN],
          permissions: permission === "applications.view" ? ["applications.view"] : [],
        });
      } else if (role === "ISSUER") {
        attachUser(req, { user_id: "issuer-1", roles: [UserRole.ISSUER] });
      }
      next();
    });
    app.use("/v1/applications", createApplicationRouter());
    app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
      res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
    });
    jest.clearAllMocks();
  });

  it("allows an admin with applications.view", async () => {
    (applicationService.getApplicationLogs as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get("/v1/applications/clexampletestid000000001/logs")
      .set("Authorization", "Bearer token")
      .set("x-test-role", "ADMIN")
      .set("x-test-permission", "applications.view");
    expect(res.status).toBe(200);
    expect(applicationService.getApplicationLogs).toHaveBeenCalledWith(
      "clexampletestid000000001",
      "admin-1",
      { asAdmin: true }
    );
  });

  it("rejects an admin without applications.view", async () => {
    const res = await request(app)
      .get("/v1/applications/clexampletestid000000001/logs")
      .set("Authorization", "Bearer token")
      .set("x-test-role", "ADMIN");
    expect(res.status).toBe(403);
    expect(applicationService.getApplicationLogs).not.toHaveBeenCalled();
  });

  it("keeps issuer ownership checks on the shared endpoint", async () => {
    (applicationService.getApplicationLogs as jest.Mock).mockResolvedValue([]);
    const res = await request(app)
      .get("/v1/applications/clexampletestid000000001/logs")
      .set("Authorization", "Bearer token")
      .set("x-test-role", "ISSUER");
    expect(res.status).toBe(200);
    expect(applicationService.getApplicationLogs).toHaveBeenCalledWith(
      "clexampletestid000000001",
      "issuer-1",
      { asAdmin: false }
    );
  });
});
