/**
 * Organization detail Acceptances tab routes.
 * GET /v1/admin/organizations/:portal/:id/legal-acceptances[/:acceptanceId[/download]]
 * Organization and audience always come from the URL.
 */
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { AdminRole, type AdminPermission } from "@cashsouk/types";
import { AppError } from "../../lib/http/error-handler";

const mockList = jest.fn();
const mockGetById = jest.fn();
const mockDownload = jest.fn();

jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("./acceptance-admin-service", () => ({
  legalDocumentAcceptanceAdminService: {
    listAcceptances: (...args: unknown[]) => mockList(...args),
    exportAcceptances: jest.fn().mockResolvedValue([]),
    getAcceptanceById: (...args: unknown[]) => mockGetById(...args),
    getAcceptedVersionDownloadUrl: (...args: unknown[]) => mockDownload(...args),
  },
}));

import { organizationLegalAcceptanceRouter } from "./acceptance-admin-controller";

type Caller = {
  permissions?: AdminPermission[];
  roleKey?: string;
  roles?: string[];
  admin?: boolean;
};

const ORG_PERMISSIONS: AdminPermission[] = ["organizations.view", "document_management.view"];
const BASE = "/v1/admin/organizations/investor/org-1/legal-acceptances";
const ROUTES = [BASE, `${BASE}/acc-1`, `${BASE}/acc-1/download`];

function appWith({ permissions = [], roleKey = "TEST_ROLE", roles = ["ADMIN"], admin = true }: Caller) {
  const app = express();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-1", roles } as unknown as Request["user"];
    req.admin = admin ? ({ user_id: "user-1" } as unknown as Request["admin"]) : null;
    req.adminRoleKey = roleKey as Request["adminRoleKey"];
    req.adminPermissions = permissions;
    next();
  });
  app.use("/v1/admin/organizations/:portal/:id/legal-acceptances", organizationLegalAcceptanceRouter);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

async function statusOf(caller: Caller, route: string): Promise<number> {
  return (await request(appWith(caller)).get(route)).status;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockList.mockResolvedValue({ acceptances: [], pagination: {} });
  mockGetById.mockResolvedValue({ id: "acc-1" });
  mockDownload.mockResolvedValue({ downloadUrl: "https://example.test", fileName: "a.pdf" });
});

describe("Organization acceptances permissions", () => {
  it.each(ROUTES)("allows organizations.view + document_management.view on %s", async (route) => {
    expect(await statusOf({ permissions: ORG_PERMISSIONS }, route)).toBe(200);
  });

  it.each(ROUTES)("allows Super Admin on %s", async (route) => {
    expect(await statusOf({ roleKey: AdminRole.SUPER_ADMIN }, route)).toBe(200);
  });

  it.each(ROUTES)("denies %s when either permission is missing", async (route) => {
    expect(await statusOf({ permissions: ["organizations.view"] }, route)).toBe(403);
    expect(await statusOf({ permissions: ["document_management.view"] }, route)).toBe(403);
    expect(await statusOf({ permissions: [] }, route)).toBe(403);
  });

  it.each(ROUTES)("denies audit.legal_acceptances.view on %s", async (route) => {
    expect(await statusOf({ permissions: ["audit.legal_acceptances.view"] }, route)).toBe(403);
    expect(
      await statusOf({ permissions: ["organizations.view", "audit.legal_acceptances.view"] }, route)
    ).toBe(403);
  });

  it.each(ROUTES)("denies non-admin callers on %s", async (route) => {
    expect(await statusOf({ permissions: ORG_PERMISSIONS, roles: ["INVESTOR"] }, route)).toBe(403);
    expect(await statusOf({ permissions: ORG_PERMISSIONS, admin: false }, route)).toBe(403);
  });

  it("does not call the service when denied", async () => {
    for (const route of ROUTES) {
      await statusOf({ permissions: ["document_management.view"] }, route);
    }
    expect(mockList).not.toHaveBeenCalled();
    expect(mockGetById).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });
});

describe("Organization acceptances scope comes from the URL", () => {
  const caller = { permissions: ORG_PERMISSIONS };

  it("ignores organizationId and audience query params on the list", async () => {
    const res = await request(appWith(caller)).get(
      `${BASE}?organizationId=org-2&audience=ISSUER&page=2&pageSize=5`
    );
    expect(res.status).toBe(200);
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList.mock.calls[0][0]).toMatchObject({
      organizationId: "org-1",
      audience: "INVESTOR",
      page: 2,
      pageSize: 5,
    });
  });

  it("maps the issuer portal to the ISSUER audience", async () => {
    await request(appWith(caller)).get(
      "/v1/admin/organizations/issuer/org-9/legal-acceptances?audience=INVESTOR"
    );
    expect(mockList.mock.calls[0][0]).toMatchObject({ organizationId: "org-9", audience: "ISSUER" });
  });

  it("passes the URL scope to detail and download", async () => {
    await request(appWith(caller)).get(`${BASE}/acc-1?organizationId=org-2`);
    await request(appWith(caller)).get(`${BASE}/acc-1/download?organizationId=org-2`);
    const scope = { organizationId: "org-1", audience: "INVESTOR" };
    expect(mockGetById).toHaveBeenCalledWith("acc-1", scope);
    expect(mockDownload).toHaveBeenCalledWith("acc-1", scope);
  });

  it.each([`${BASE}/acc-1`, `${BASE}/acc-1/download`])(
    "returns 404 on %s when the acceptance is not in this organization",
    async (route) => {
      const notFound = new AppError(404, "NOT_FOUND", "Legal document acceptance not found");
      mockGetById.mockRejectedValue(notFound);
      mockDownload.mockRejectedValue(notFound);
      expect(await statusOf(caller, route)).toBe(404);
    }
  );

  it("rejects an unknown portal", async () => {
    const base = "/v1/admin/organizations/admin/org-1/legal-acceptances";
    expect(await statusOf(caller, base)).toBe(400);
    expect(await statusOf(caller, `${base}/acc-1`)).toBe(400);
    expect(await statusOf(caller, `${base}/acc-1/download`)).toBe(400);
    expect(mockList).not.toHaveBeenCalled();
    expect(mockGetById).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
