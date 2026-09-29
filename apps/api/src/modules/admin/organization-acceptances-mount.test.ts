/**
 * The organization acceptances routes are reachable through the real admin router,
 * behind its /organizations organizations.view gate.
 */
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import type { AdminPermission } from "@cashsouk/types";

const mockList = jest.fn();

jest.mock("../legal-documents/acceptance-admin-service", () => ({
  legalDocumentAcceptanceAdminService: {
    listAcceptances: (...args: unknown[]) => mockList(...args),
  },
}));

import { adminRouter } from "./controller";

const ROUTE = "/v1/admin/organizations/issuer/org-1/legal-acceptances?organizationId=org-2";

function appWith(permissions: AdminPermission[]) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-1", roles: ["ADMIN"] } as unknown as Request["user"];
    req.admin = { user_id: "user-1" } as unknown as Request["admin"];
    req.adminRoleKey = "TEST_ROLE" as Request["adminRoleKey"];
    req.adminPermissions = permissions;
    next();
  });
  app.use("/v1/admin", adminRouter);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

describe("admin router mounts organization acceptances", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList.mockResolvedValue({ acceptances: [], pagination: {} });
  });

  it("serves the list with organizations.view alone, scoped to the URL", async () => {
    const res = await request(appWith(["organizations.view"])).get(ROUTE);
    expect(res.status).toBe(200);
    expect(mockList.mock.calls[0][0]).toMatchObject({ organizationId: "org-1", audience: "ISSUER" });
  });

  it.each([
    [["document_management.view"]],
    [["audit.legal_acceptances.view"]],
  ] as AdminPermission[][][])("denies %j", async (permissions) => {
    expect((await request(appWith(permissions)).get(ROUTE)).status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });
});
