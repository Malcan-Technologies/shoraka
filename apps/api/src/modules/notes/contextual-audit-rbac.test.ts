import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { Admin, User, UserRole } from "@prisma/client";
import type { AdminPermission } from "@cashsouk/types";
import { errorHandler } from "../../lib/http/error-handler";
import { platformFinanceSettingsRouter, withdrawalsRouter } from "./controller";

jest.mock("./service", () => ({
  noteService: {
    listTrusteeSignatureAudit: jest.fn(async () => [
      { id: "na_1", eventType: "TRUSTEE_SIGNATURE_UPDATED" },
    ]),
    listInvestorWithdrawalEvents: jest.fn(async () => [
      { id: "pa_1", eventType: "INVESTOR_WITHDRAWAL_REQUESTED" },
    ]),
    getPlatformFinanceSettings: jest.fn(async () => ({ key: "DEFAULT" })),
    getInvestorWithdrawal: jest.fn(async () => ({ id: "wdl_test" })),
    listInvestorWithdrawals: jest.fn(async () => ({ items: [], count: 0 })),
    getPendingInvestorWithdrawalsCount: jest.fn(async () => ({ count: 0 })),
    listPendingIssuerPayouts: jest.fn(async () => []),
  },
}));

jest.mock("../shoraka-stp/shoraka-stp-service", () => ({
  shorakaStpService: {},
}));

jest.mock("../../lib/prisma", () => ({
  prisma: {},
}));

function createAdminApp(permissions: AdminPermission[]) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.user = { user_id: "ADMIN1", roles: [UserRole.ADMIN] } as User;
    req.admin = { id: "admin1", user_id: "ADMIN1" } as Admin;
    req.adminPermissions = permissions;
    next();
  });
  app.use("/admin/platform-finance-settings", platformFinanceSettingsRouter);
  app.use("/admin/withdrawals", withdrawalsRouter);
  app.use(errorHandler);
  return app;
}

describe("trustee signature audit RBAC", () => {
  it("allows trustee audit with platform_settings.view", async () => {
    const app = createAdminApp(["platform_settings.view"]);
    const response = await request(app).get(
      "/admin/platform-finance-settings/trustee-signature/audit"
    );
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data[0].eventType).toBe("TRUSTEE_SIGNATURE_UPDATED");
  });

  it("denies trustee audit without platform_settings.view", async () => {
    const app = createAdminApp(["notes.view"]);
    const response = await request(app).get(
      "/admin/platform-finance-settings/trustee-signature/audit"
    );
    expect(response.status).toBe(403);
  });
});

describe("investor withdrawal audit RBAC", () => {
  it("allows withdrawal events with investor_withdrawals.view", async () => {
    const app = createAdminApp(["investor_withdrawals.view"]);
    const response = await request(app).get("/admin/withdrawals/wdl_test/events");
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data[0].eventType).toBe("INVESTOR_WITHDRAWAL_REQUESTED");
  });

  it("denies withdrawal events without investor_withdrawals.view", async () => {
    const app = createAdminApp(["notes.view"]);
    const response = await request(app).get("/admin/withdrawals/wdl_test/events");
    expect(response.status).toBe(403);
  });
});
