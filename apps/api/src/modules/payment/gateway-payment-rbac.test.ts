import request from "supertest";
import express, { NextFunction, Request, Response } from "express";
import { Admin, User, UserRole } from "@prisma/client";
import type { AdminPermission } from "@cashsouk/types";
import { AppError, errorHandler } from "../../lib/http/error-handler";
import { gatewayPaymentsAdminRouter } from "./admin-controller";
import { gatewayReconAdminRouter } from "./recon-controller";

jest.mock("./admin-service", () => ({
  listGatewayPayments: jest.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  getGatewayPaymentsExceptionCount: jest.fn(async () => ({ count: 0 })),
  getGatewayPaymentDetail: jest.fn(async () => ({ id: "pay_test", status: "COMPLETED" })),
  retryHeldDepositRefund: jest.fn(async () => ({ id: "pay_test", status: "REFUNDING" })),
  initiateCompletedDepositRefund: jest.fn(async () => ({ id: "pay_test", status: "REFUNDING" })),
  approveNameCheck: jest.fn(async () => ({ id: "pay_test", status: "COMPLETED" })),
  rejectNameCheck: jest.fn(async () => ({ id: "pay_test", status: "REFUNDING" })),
}));

jest.mock("./recon-service", () => ({
  listReconRuns: jest.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })),
  getReconRunDetail: jest.fn(async () => ({ id: "run_test", status: "COMPLETED" })),
  listReconExceptions: jest.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 50 })),
  getUnresolvedReconExceptionsCount: jest.fn(async () => ({ count: 0 })),
  triggerReconRun: jest.fn(async () => ({ id: "run_test", status: "COMPLETED" })),
  resolveReconException: jest.fn(async () => ({
    id: "exc_test",
    resolvedAt: new Date().toISOString(),
  })),
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
  app.use("/admin/gateway-payments", gatewayPaymentsAdminRouter);
  app.use("/admin/gateway-recon", gatewayReconAdminRouter);
  app.use(errorHandler);
  return app;
}

describe("gateway payment admin RBAC", () => {
  it("allows list and detail with gateway_payments.view", async () => {
    const app = createAdminApp(["gateway_payments.view"]);

    const listResponse = await request(app).get("/admin/gateway-payments");
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);

    const detailResponse = await request(app).get("/admin/gateway-payments/pay_test");
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.success).toBe(true);
  });

  it("denies payment routes without gateway_payments.view", async () => {
    const app = createAdminApp([]);

    const listResponse = await request(app).get("/admin/gateway-payments");
    expect(listResponse.status).toBe(403);
    expect(listResponse.body.error.code).toBe("FORBIDDEN");

    const detailResponse = await request(app).get("/admin/gateway-payments/pay_test");
    expect(detailResponse.status).toBe(403);
  });

  it("denies payment mutations without gateway_payments.manage", async () => {
    const app = createAdminApp(["gateway_payments.view"]);

    const retryResponse = await request(app).post("/admin/gateway-payments/pay_test/retry-refund");
    expect(retryResponse.status).toBe(403);

    const refundResponse = await request(app)
      .post("/admin/gateway-payments/pay_test/refund")
      .send({ reason: "test" });
    expect(refundResponse.status).toBe(403);
  });

  it("allows payment mutations with gateway_payments.manage", async () => {
    const app = createAdminApp(["gateway_payments.view", "gateway_payments.manage"]);

    const retryResponse = await request(app).post("/admin/gateway-payments/pay_test/retry-refund");
    expect(retryResponse.status).toBe(200);
    expect(retryResponse.body.success).toBe(true);
  });
});

describe("gateway reconciliation admin RBAC", () => {
  it("allows read routes with gateway_reconciliation.view", async () => {
    const app = createAdminApp(["gateway_reconciliation.view"]);

    const runsResponse = await request(app).get("/admin/gateway-recon/runs");
    expect(runsResponse.status).toBe(200);

    const exceptionsResponse = await request(app).get("/admin/gateway-recon/exceptions");
    expect(exceptionsResponse.status).toBe(200);
  });

  it("denies reconciliation routes without gateway_reconciliation.view", async () => {
    const app = createAdminApp([]);

    const runsResponse = await request(app).get("/admin/gateway-recon/runs");
    expect(runsResponse.status).toBe(403);
  });

  it("does not grant reconciliation access from gateway_payments.view alone", async () => {
    const app = createAdminApp(["gateway_payments.view"]);

    const runsResponse = await request(app).get("/admin/gateway-recon/runs");
    expect(runsResponse.status).toBe(403);
  });

  it("denies reconciliation mutations without gateway_reconciliation.manage", async () => {
    const app = createAdminApp(["gateway_reconciliation.view"]);

    const runResponse = await request(app)
      .post("/admin/gateway-recon/run")
      .send({ gatewayAccount: "OPERATING" });
    expect(runResponse.status).toBe(403);

    const resolveResponse = await request(app)
      .post("/admin/gateway-recon/exceptions/exc_test/resolve")
      .send({ reason: "verified" });
    expect(resolveResponse.status).toBe(403);
  });

  it("allows reconciliation mutations with gateway_reconciliation.manage", async () => {
    const app = createAdminApp(["gateway_reconciliation.view", "gateway_reconciliation.manage"]);

    const runResponse = await request(app)
      .post("/admin/gateway-recon/run")
      .send({ gatewayAccount: "OPERATING" });
    expect(runResponse.status).toBe(200);
    expect(runResponse.body.success).toBe(true);
  });

  it("does not grant reconciliation manage from gateway_payments.manage alone", async () => {
    const app = createAdminApp(["gateway_payments.view", "gateway_payments.manage"]);

    const runResponse = await request(app)
      .post("/admin/gateway-recon/run")
      .send({ gatewayAccount: "OPERATING" });
    expect(runResponse.status).toBe(403);
  });
});

describe("gateway admin RBAC authorization guard", () => {
  it("returns unauthorized when admin user is missing on request", async () => {
    const app = express();
    app.use(express.json());
    app.use((req: Request, _res: Response, next: NextFunction) => {
      req.user = { user_id: "ADMIN1", roles: [UserRole.ADMIN] } as User;
      next();
    });
    app.use("/admin/gateway-payments", gatewayPaymentsAdminRouter);
    app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({
          success: false,
          error: { code: err.code, message: err.message },
          correlationId: "test",
        });
        return;
      }
      res.status(500).json({ success: false, error: { message: err.message } });
    });

    const response = await request(app).get("/admin/gateway-payments");
    expect(response.status).toBe(403);
  });
});
