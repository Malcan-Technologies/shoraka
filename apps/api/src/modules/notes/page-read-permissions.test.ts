/**
 * Page-ownership reads on Note detail: note-scoped panels use notes.view with the note (and purpose)
 * forced from the URL. The module routes keep their own permissions.
 */
import request from "supertest";
import express, { NextFunction, Request, Response } from "express";

const mockListAdminInvestments = jest.fn();
const mockListGatewayPayments = jest.fn();
const mockGetShorakaState = jest.fn();

jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("./service", () => ({
  noteService: {
    listAdminInvestments: (...args: unknown[]) => mockListAdminInvestments(...args),
  },
}));
jest.mock("../payment/admin-service", () => ({
  listGatewayPayments: (...args: unknown[]) => mockListGatewayPayments(...args),
}));
jest.mock("../shoraka-stp/shoraka-stp-service", () => ({
  shorakaStpService: {
    getStateForWithdrawal: (...args: unknown[]) => mockGetShorakaState(...args),
  },
}));
jest.mock("../paymaster/controller", () => ({
  registerNoteAssignmentNoticeRoutes: jest.fn(),
}));

import { adminInvestmentsRouter, adminNotesRouter, withdrawalsRouter } from "./controller";

function appWith(permissions: string[]) {
  const app = express();
  app.use(express.json());
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.user = { user_id: "admin-1", roles: ["ADMIN"] } as unknown as Request["user"];
    req.admin = { id: "admin-row-1" } as unknown as Request["admin"];
    req.adminRoleKey = "TEST_ROLE" as Request["adminRoleKey"];
    req.adminPermissions = permissions as Request["adminPermissions"];
    res.locals.correlationId = "test";
    next();
  });
  app.use("/v1/admin/notes", adminNotesRouter);
  app.use("/v1/admin/investments", adminInvestmentsRouter);
  app.use("/v1/admin/withdrawals", withdrawalsRouter);
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode || 500).json({ success: false, error: { message: err.message } });
  });
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListAdminInvestments.mockResolvedValue({ items: [], pagination: { totalCount: 0 } });
  mockListGatewayPayments.mockResolvedValue({ items: [], pagination: { totalCount: 0 } });
  mockGetShorakaState.mockResolvedValue(null);
});

describe("GET /admin/notes/:id/investments (Note detail Investors panel)", () => {
  it("allows notes.view and forces noteId from the URL", async () => {
    const res = await request(appWith(["notes.view"]))
      .get("/v1/admin/notes/note-1/investments?page=2&pageSize=10&noteId=other-note")
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(mockListAdminInvestments).toHaveBeenCalledWith(
      { noteId: "note-1", page: 2, pageSize: 10 }
    );
  });

  it("denies without notes.view, even with investments.view", async () => {
    await request(appWith(["investments.view"]))
      .get("/v1/admin/notes/note-1/investments")
      .expect(403);
    expect(mockListAdminInvestments).not.toHaveBeenCalled();
  });

  it("keeps GET /admin/investments on investments.view (not broadened to notes.view)", async () => {
    await request(appWith(["notes.view"])).get("/v1/admin/investments?noteId=note-1").expect(403);
    await request(appWith(["investments.view"])).get("/v1/admin/investments").expect(200);
  });
});

describe("GET /admin/notes/:id/excess-late-charge-payments (Note detail excess late charge panel)", () => {
  it("allows notes.view and forces noteId and purpose from the URL", async () => {
    await request(appWith(["notes.view"]))
      .get(
        "/v1/admin/notes/note-1/excess-late-charge-payments?page=1&pageSize=20&noteId=other&purpose=DEPOSIT"
      )
      .expect(200);
    expect(mockListGatewayPayments).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      purpose: "EXCESS_LATE_CHARGES",
      noteId: "note-1",
    });
  });

  it("denies without notes.view, even with gateway_payments.view", async () => {
    await request(appWith(["gateway_payments.view"]))
      .get("/v1/admin/notes/note-1/excess-late-charge-payments")
      .expect(403);
    expect(mockListGatewayPayments).not.toHaveBeenCalled();
  });
});

describe("GET /admin/withdrawals/:id/shoraka (read-only Shoraka STP state)", () => {
  it("allows notes.view", async () => {
    await request(appWith(["notes.view"])).get("/v1/admin/withdrawals/wd-1/shoraka").expect(200);
    expect(mockGetShorakaState).toHaveBeenCalledWith("wd-1");
  });

  // Only Note detail calls this route; disbursements.view controls the Issuer Payouts page only.
  it("denies an admin with disbursements.view only", async () => {
    await request(appWith(["disbursements.view"]))
      .get("/v1/admin/withdrawals/wd-1/shoraka")
      .expect(403);
    expect(mockGetShorakaState).not.toHaveBeenCalled();
  });

  it("denies an admin without notes.view", async () => {
    await request(appWith(["applications.view"]))
      .get("/v1/admin/withdrawals/wd-1/shoraka")
      .expect(403);
    expect(mockGetShorakaState).not.toHaveBeenCalled();
  });

  it("keeps Shoraka STP actions on notes.disbursement.manage", async () => {
    await request(appWith(["notes.view", "disbursements.view"]))
      .post("/v1/admin/withdrawals/wd-1/shoraka/submit-order")
      .expect(403);
  });
});
