import { readFileSync } from "fs";
import { join } from "path";
import request from "supertest";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { ensureAdminRoleCatalog } from "../../lib/auth/rbac";
import { registerRoutes } from "../../routes";
import { notFoundHandler } from "../../lib/http/not-found";
import { errorHandler } from "../../lib/http/error-handler";

describe("SiteDocument / DocumentLog removal verification", () => {
  it("routes.ts does not mount removed document APIs", () => {
    const source = readFileSync(join(__dirname, "../../routes.ts"), "utf8");
    expect(source).not.toMatch(/site-documents/);
    expect(source).not.toMatch(/document-logs/);
    expect(source).not.toMatch(/modules\/site-documents/);
    expect(source).not.toMatch(/["']\/documents["']/);
    expect(source).toMatch(/admin\/legal-documents/);
    expect(source).toMatch(/admin\/legal-document-acceptances/);
    expect(source).toMatch(/legal-documents/);
  });

  it("removed document routes return 404 (not 500)", async () => {
    const app = express();
    registerRoutes(app);
    app.use(notFoundHandler);
    app.use(errorHandler);

    for (const path of ["/v1/documents", "/v1/documents/account", "/v1/documents/type/PRODUCT_TERMS"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(res.body?.error?.code).toBe("NOT_FOUND");
    }

    // Admin mount authenticates before 404. Unauthenticated probes must not 500.
    for (const path of ["/v1/admin/site-documents", "/v1/admin/document-logs", "/v1/admin/zzz-missing"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.status).not.toBe(500);
    }

    const legalAccount = await request(app).get("/v1/legal-documents/account");
    expect(legalAccount.status).toBe(401);

    const legalAdmin = await request(app).get("/v1/admin/legal-documents");
    expect(legalAdmin.status).toBe(401);

    const acceptances = await request(app).get("/v1/admin/legal-document-acceptances");
    expect(acceptances.status).toBe(401);
  });

  it("authenticated admin: removed site-document routes 404; legal routes exist", async () => {
    const previousDisableAuth = process.env.DISABLE_AUTH;
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.DISABLE_AUTH = "true";
    process.env.NODE_ENV = "development";

    jest.resetModules();
    const { registerRoutes: registerWithBypass } = require("../../routes") as typeof import("../../routes");
    const { notFoundHandler: notFound } = require("../../lib/http/not-found") as typeof import("../../lib/http/not-found");
    const { errorHandler: errors } = require("../../lib/http/error-handler") as typeof import("../../lib/http/error-handler");

    const app = express();
    registerWithBypass(app);
    app.use(notFound);
    app.use(errors);

    try {
      const removedSiteDocs = await request(app).get("/v1/admin/site-documents");
      expect(removedSiteDocs.status).toBe(404);
      expect(removedSiteDocs.status).not.toBe(500);

      const removedLogs = await request(app).get("/v1/admin/document-logs");
      expect(removedLogs.status).toBe(404);

      const legalDocs = await request(app).get("/v1/admin/legal-documents");
      expect([200, 400]).toContain(legalDocs.status);

      const legalAcceptances = await request(app).get("/v1/admin/legal-document-acceptances");
      expect([200, 400]).toContain(legalAcceptances.status);
    } finally {
      if (previousDisableAuth === undefined) delete process.env.DISABLE_AUTH;
      else process.env.DISABLE_AUTH = previousDisableAuth;
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("sync strips audit.document.view from admin role configs", async () => {
    const prisma = new PrismaClient();
    try {
      await ensureAdminRoleCatalog(prisma);
      const roles = await prisma.adminRoleConfig.findMany({
        select: { key: true, permissions: true },
      });
      const stale = roles.filter((role) =>
        (role.permissions ?? []).includes("audit.document.view")
      );
      expect(stale).toEqual([]);
      const superAdmin = roles.find((role) => role.key === "SUPER_ADMIN");
      expect(superAdmin?.permissions).toContain("document_management.view");
      expect(superAdmin?.permissions).toContain("document_management.manage");
      expect(superAdmin?.permissions).not.toContain("audit.document.view");
    } finally {
      await prisma.$disconnect();
    }
  });
});
