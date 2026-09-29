/**
 * Permission guards for the Admin Audit page tabs.
 * Each tab's routes require that tab's own audit.* permission. The only shared
 * routes are notification types/groups (Notifications settings page).
 * Organization detail Acceptances has its own organization-scoped routes.
 */
import * as fs from "fs";
import * as path from "path";
import request from "supertest";
import express, { NextFunction, Request, Response, Router } from "express";
import { ADMIN_PERMISSIONS, AdminRole, type AdminPermission } from "@cashsouk/types";

jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../../lib/auth/middleware", () => {
  const actual = jest.requireActual("../../lib/auth/middleware");
  return {
    ...actual,
    // The test app sets the caller; route-level requireAuth must not replace it.
    requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  };
});
jest.mock("../products/service", () => ({
  productService: {
    getProductLogs: jest.fn().mockResolvedValue({ logs: [], pagination: {} }),
    exportProductLogs: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("../legal-documents/audit-admin-service", () => ({
  legalDocumentAuditAdminService: {
    list: jest.fn().mockResolvedValue({ logs: [] }),
    export: jest.fn().mockResolvedValue([]),
  },
}));
jest.mock("../legal-documents/acceptance-admin-service", () => ({
  legalDocumentAcceptanceAdminService: {
    listAcceptances: jest.fn().mockResolvedValue({ acceptances: [] }),
    exportAcceptances: jest.fn().mockResolvedValue([]),
    getAcceptanceById: jest.fn().mockResolvedValue({ id: "acc-1" }),
    getAcceptedVersionDownloadUrl: jest.fn().mockResolvedValue({ url: "https://example.test" }),
  },
}));
jest.mock("../legal-documents/external-acceptance-admin-service", () => ({
  legalExternalAcceptanceAdminService: {
    listAcceptances: jest.fn().mockResolvedValue({ acceptances: [] }),
    exportAcceptances: jest.fn().mockResolvedValue([]),
    getAcceptanceById: jest.fn().mockResolvedValue({ id: "ext-1" }),
  },
}));
jest.mock("../notification/service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    getAdminLogs: jest.fn().mockResolvedValue({ items: [], pagination: {} }),
    getAllNotificationTypes: jest.fn().mockResolvedValue([]),
    getAllNotificationGroups: jest.fn().mockResolvedValue([]),
  })),
}));

import { productLogRouter } from "../products/log/controller";
import { legalDocumentAuditAdminRouter } from "../legal-documents/audit-admin-controller";
import { legalDocumentAcceptanceAdminRouter } from "../legal-documents/acceptance-admin-controller";
import { legalExternalAcceptanceAdminRouter } from "../legal-documents/external-acceptance-admin-controller";
import { notificationRouter } from "../notification/controller";

const ADMIN_CONTROLLER = fs.readFileSync(path.join(__dirname, "controller.ts"), "utf8");

type Caller = {
  permissions?: AdminPermission[];
  roleKey?: string;
  roles?: string[];
  admin?: boolean;
};

function appWith({ permissions = [], roleKey = "TEST_ROLE", roles = ["ADMIN"], admin = true }: Caller) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "user-1", roles } as unknown as Request["user"];
    req.admin = admin ? ({ user_id: "user-1" } as unknown as Request["admin"]) : null;
    req.adminRoleKey = roleKey as Request["adminRoleKey"];
    req.adminPermissions = permissions;
    next();
  });
  const mounts: Array<[string, Router]> = [
    ["/v1/admin/product-logs", productLogRouter],
    ["/v1/admin/legal-document-audit-logs", legalDocumentAuditAdminRouter],
    ["/v1/admin/legal-document-acceptances", legalDocumentAcceptanceAdminRouter],
    ["/v1/admin/legal-external-acceptances", legalExternalAcceptanceAdminRouter],
    ["/v1/notifications", notificationRouter],
  ];
  for (const [mountPath, router] of mounts) app.use(mountPath, router);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

async function statusOf(caller: Caller, route: string): Promise<number> {
  return (await request(appWith(caller)).get(route)).status;
}

/** Routes that accept exactly one permission. */
const STRICT_ROUTES: Array<{ tab: string; permission: AdminPermission; routes: string[] }> = [
  {
    tab: "Products",
    permission: "audit.product.view",
    routes: ["/v1/admin/product-logs", "/v1/admin/product-logs/export?format=json"],
  },
  {
    tab: "Legal Documents",
    permission: "audit.legal_documents.view",
    routes: [
      "/v1/admin/legal-document-audit-logs",
      "/v1/admin/legal-document-audit-logs/export?format=json",
    ],
  },
  {
    tab: "Legal Acceptances",
    permission: "audit.legal_acceptances.view",
    routes: [
      "/v1/admin/legal-document-acceptances",
      "/v1/admin/legal-document-acceptances/export?format=json",
      "/v1/admin/legal-document-acceptances/acc-1",
      "/v1/admin/legal-document-acceptances/acc-1/download",
    ],
  },
  {
    tab: "External Acceptances",
    permission: "audit.external_acceptances.view",
    routes: [
      "/v1/admin/legal-external-acceptances",
      "/v1/admin/legal-external-acceptances/export?format=json",
      "/v1/admin/legal-external-acceptances/ext-1",
    ],
  },
  {
    tab: "Notifications",
    permission: "audit.notifications.view",
    routes: ["/v1/notifications/admin/logs"],
  },
];

/** Routes shared with a non-Audit page, which accept either permission. */
const SHARED_ROUTES: Array<{ name: string; permissions: AdminPermission[]; routes: string[] }> = [
  {
    name: "Notification types/groups (Notifications settings)",
    permissions: ["audit.notifications.view", "notifications.view"],
    routes: ["/v1/notifications/admin/types", "/v1/notifications/admin/groups"],
  },
];

describe("Audit tab routes (one permission each)", () => {
  describe.each(STRICT_ROUTES)("$tab", ({ permission, routes }) => {
    const everythingElse = ADMIN_PERMISSIONS.filter((candidate) => candidate !== permission);

    it.each(routes)(`allows ${permission} on %s`, async (route) => {
      expect(await statusOf({ permissions: [permission] }, route)).toBe(200);
    });

    it.each(routes)("denies every other permission combined on %s", async (route) => {
      expect(await statusOf({ permissions: everythingElse }, route)).toBe(403);
    });

    it.each(routes)("allows Super Admin on %s", async (route) => {
      expect(await statusOf({ roleKey: AdminRole.SUPER_ADMIN }, route)).toBe(200);
    });

    it.each(routes)("denies a non-admin caller holding the permission on %s", async (route) => {
      expect(await statusOf({ permissions: [permission], roles: ["INVESTOR"] }, route)).toBe(403);
      expect(await statusOf({ permissions: [permission], admin: false }, route)).toBe(403);
    });
  });
});

describe("Shared routes (compatibility)", () => {
  describe.each(SHARED_ROUTES)("$name", ({ permissions, routes }) => {
    const everythingElse = ADMIN_PERMISSIONS.filter(
      (candidate) => !permissions.includes(candidate)
    );

    it.each(routes)("allows either permission on %s", async (route) => {
      for (const permission of permissions) {
        expect(await statusOf({ permissions: [permission] }, route)).toBe(200);
      }
    });

    it.each(routes)("denies every other permission combined on %s", async (route) => {
      expect(await statusOf({ permissions: everythingElse }, route)).toBe(403);
    });

    it.each(routes)("denies non-admin callers and full-access keys without Admin context on %s", async (route) => {
      expect(await statusOf({ permissions, roles: ["INVESTOR"] }, route)).toBe(403);
      expect(await statusOf({ permissions, admin: false }, route)).toBe(403);
      expect(
        await statusOf({ roleKey: AdminRole.SUPER_ADMIN, roles: ["INVESTOR"], admin: false }, route)
      ).toBe(403);
    });
  });

  it("does not let document_management.view reach any Audit legal route", async () => {
    const caller = {
      permissions: [
        "organizations.view",
        "document_management.view",
        "document_management.manage",
      ] as AdminPermission[],
    };
    expect(await statusOf(caller, "/v1/admin/legal-document-acceptances")).toBe(403);
    expect(await statusOf(caller, "/v1/admin/legal-document-acceptances/export?format=json")).toBe(403);
    expect(await statusOf(caller, "/v1/admin/legal-document-acceptances/acc-1")).toBe(403);
    expect(await statusOf(caller, "/v1/admin/legal-document-acceptances/acc-1/download")).toBe(403);
    expect(await statusOf(caller, "/v1/admin/legal-document-audit-logs")).toBe(403);
    expect(await statusOf(caller, "/v1/admin/legal-external-acceptances")).toBe(403);
  });

  it("does not let notifications.view read notification audit logs", async () => {
    const caller = { permissions: ["notifications.view", "notifications.manage"] as AdminPermission[] };
    expect(await statusOf(caller, "/v1/notifications/admin/logs")).toBe(403);
  });
});

describe("Audit Legal Acceptances routes accept one permission", () => {
  const controller = fs.readFileSync(
    path.join(__dirname, "../legal-documents/acceptance-admin-controller.ts"),
    "utf8"
  );

  it("has no any-of guard", () => {
    expect(controller).not.toContain("requireAnyPermission");
  });
});

describe("Access and Security tab routes", () => {
  /** Source of a `router.get("<route>", ...)` registration up to the next route. */
  function getRouteBlock(route: string): string {
    const idx = ADMIN_CONTROLLER.indexOf(`router.get(\n  "${route}",`);
    expect(idx).toBeGreaterThan(-1);
    const end = ADMIN_CONTROLLER.indexOf("\nrouter.", idx + 1);
    return ADMIN_CONTROLLER.slice(idx, end === -1 ? undefined : end);
  }

  it.each(["/access-logs", "/access-logs/export", "/access-logs/:id"])(
    "%s requires audit.access.view",
    (route) => {
      expect(getRouteBlock(route)).toContain(
        `"${route}",\n  requirePermission("audit.access.view"),`
      );
    }
  );

  it.each(["/security-logs", "/security-logs/export"])(
    "%s requires audit.security.view",
    (route) => {
      expect(getRouteBlock(route)).toContain(
        `"${route}",\n  requirePermission("audit.security.view"),`
      );
    }
  );
});
